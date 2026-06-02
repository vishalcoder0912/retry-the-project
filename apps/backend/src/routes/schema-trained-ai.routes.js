import {
  generateSchemaDashboard,
  generateSeniorAnalystDashboard,
  runExcelAnalystChat,
  runDashboardCommand,
  runSchemaChat,
  trainSchemaDashboard,
  trainSchemaRagDashboard,
} from "../services/ai-analyst/schema-trained-ai-service.js";
import { getMemoryStats, readSchemaTrainingMemory, trainManySchemaExamples } from "../services/ai-analyst/schema-training-store.js";
import { validateAndFixDashboard } from "../services/dashboard/dashboard-integrity-engine.js";
import { buildSchemaProfile } from "../services/ai-analyst/schema-fingerprint.js";
import {
  getSchemaRagStats,
  readSchemaRagMemory,
} from "../services/ai-analyst/schema-rag-store.js";
import {
  retrieveSchemaRagMemories,
  trainSchemaRagMemoryFromDataset,
} from "../services/ai-analyst/schema-rag-retriever.js";
import {
  buildSmartDashboardTrainingContext,
  explainDatasetSchemaForUser,
  trainSmartRagFromApprovedDashboard,
} from "../services/ai-analyst/smart-rag-training-service.js";
import { trainExcelAnalystRagSeeds } from "../../scripts/train-excel-analyst-rag.js";
import { trainSeniorAnalystSeeds } from "../../scripts/train-senior-analyst-rag.js";

async function readJsonBody(request) {
  try {
    if (request.body && typeof request.body === "object" && !request.readable) return request.body;
    let raw = "";
    for await (const chunk of request) raw += chunk;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

function ok(response, data, message = "OK") {
  sendJson(response, 200, { success: true, data, message });
}

function fail(response, statusCode, message, details) {
  sendJson(response, statusCode, { success: false, error: { message, details } });
}

async function tryCall(fn) {
  try { return await fn(); } catch { return null; }
}

async function loadDatasetById(datasetId, body = {}) {
  if (body.dataset?.rows) return body.dataset;
  if (Array.isArray(body.rows)) return { id: datasetId, name: body.name || datasetId, columns: body.columns || [], rows: body.rows, dictionaryRows: body.dictionaryRows || [] };

  const repo = await tryCall(() => import("../database/dataset-repository.js"));
  const localDb = await tryCall(() => import("../services/local-database-service.js"));

  const candidates = [
    repo?.getDatasetById,
    repo?.getDataset,
    repo?.datasetRepository?.getById,
    repo?.default?.getDatasetById,
    repo?.default?.getById,
    localDb?.getDatasetById,
    localDb?.getDataset,
    localDb?.default?.getDatasetById,
  ].filter(Boolean);

  for (const candidate of candidates) {
    const dataset = await tryCall(() => candidate(datasetId));
    if (dataset?.rows) return dataset;
    if (dataset?.data?.rows) return dataset.data;
  }

  return null;
}

export async function handleSchemaTrainedAIRoutes(request, response, pathname) {
  const method = request.method;

  if (method === "GET" && pathname === "/api/ai/schema-training-memory") {
    ok(response, { stats: getMemoryStats(), memory: readSchemaTrainingMemory() }, "Schema training memory loaded");
    return true;
  }

  if (method === "POST" && pathname === "/api/ai/schema-training/train-memory") {
    try {
      const body = await readJsonBody(request);
      const datasets = Array.isArray(body.datasets) ? body.datasets : [];
      if (!datasets.length) return fail(response, 400, "datasets[] is required");
      const trained = trainManySchemaExamples(datasets.map((dataset) => ({ dataset, dashboardPlan: dataset.dashboardPlan, rating: dataset.rating || "good", source: "bulk-api" })));
      ok(response, { trained, stats: getMemoryStats() }, "Schema memory trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Training failed");
      return true;
    }
  }

  if (method === "GET" && pathname === "/api/ai/schema-rag-memory") {
    ok(
      response,
      {
        stats: getSchemaRagStats(),
        memory: readSchemaRagMemory().map((item) => {
          const { embedding, ...safe } = item;
          return safe;
        }),
      },
      "Schema RAG memory loaded"
    );
    return true;
  }

  if (method === "POST" && pathname === "/api/ai/schema-rag/train") {
    try {
      const body = await readJsonBody(request);
      const dataset = body.dataset;

      if (!dataset?.rows && !body.schemaProfile?.columns) {
        return fail(response, 400, "dataset.rows or schemaProfile.columns is required");
      }

      const result = await trainSchemaRagMemoryFromDataset({
        dataset,
        schemaProfile: body.schemaProfile,
        acceptedDashboardPlan:
          body.acceptedDashboardPlan || body.dashboardPlan || body.currentDashboard,
        rating: body.rating || "good",
        notes: body.notes || "",
        source: body.source || "api",
        useOllama: body.useOllama !== false,
      });

      ok(response, result, "Schema RAG memory trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Schema RAG training failed");
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/ai/schema-rag/retrieve") {
    try {
      const body = await readJsonBody(request);
      const schemaProfile = body.schemaProfile?.columns
        ? body.schemaProfile
        : buildSchemaProfile(body.dataset || { rows: body.rows || [], columns: body.columns || [] });

      const result = await retrieveSchemaRagMemories(schemaProfile, {
        limit: body.limit || 5,
        threshold: body.threshold ?? 0.55,
        useOllama: body.useOllama !== false,
      });

      ok(response, result, "Schema RAG memories retrieved");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Schema RAG retrieval failed");
      return true;
    }
  }

  const ragTrainMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-rag-train$/);
  if (method === "POST" && ragTrainMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(ragTrainMatch[1], body);

      if (!dataset) return fail(response, 404, "Dataset not found");

      const result = await trainSchemaRagDashboard(dataset, {
        acceptedDashboardPlan:
          body.acceptedDashboardPlan || body.dashboardPlan || body.currentDashboard,
        rating: body.rating || "good",
        notes: body.notes || "",
        source: "dashboard-user-feedback",
        useOllama: body.useOllama !== false,
      });

      ok(response, result, "Current dashboard pattern saved to RAG memory");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Dataset RAG training failed");
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/ai/excel-rag/train-seeds") {
    try {
      const body = await readJsonBody(request);
      const result = await trainExcelAnalystRagSeeds({
        useOllama: body.useOllama !== false,
      });

      ok(response, result, "Excel Analyst RAG seeds trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Excel Analyst RAG seed training failed");
      return true;
    }
  }

  if (method === "POST" && pathname === "/api/ai/senior-analyst/train-seeds") {
    try {
      const body = await readJsonBody(request);
      const result = await trainSeniorAnalystSeeds({
        useOllama: body.useOllama === true,
      });

      ok(response, result, "Senior analyst RAG seeds trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Senior analyst RAG seed training failed");
      return true;
    }
  }

  const understandMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-understand$/);
  if (method === "POST" && understandMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(understandMatch[1], body);

      if (!dataset) return fail(response, 404, "Dataset not found");

      const result = await explainDatasetSchemaForUser(dataset);

      ok(response, result, "Schema understanding generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Schema understanding failed");
      return true;
    }
  }

  const smartDashboardMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/smart-rag-dashboard$/);
  if (method === "POST" && smartDashboardMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(smartDashboardMatch[1], body);

      if (!dataset) return fail(response, 404, "Dataset not found");

      const result = await buildSmartDashboardTrainingContext(dataset, {
        ragThreshold: body.ragThreshold ?? 0.55,
        ragLimit: body.ragLimit ?? 5,
        useOllama: body.useOllama !== false,
        maxCharts: body.maxCharts ?? 7,
        maxKpis: body.maxKpis ?? 8,
      });

      ok(response, result, "Smart RAG dashboard generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Smart RAG dashboard failed");
      return true;
    }
  }

  const smartTrainMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/smart-rag-train$/);
  if (method === "POST" && smartTrainMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(smartTrainMatch[1], body);

      if (!dataset) return fail(response, 404, "Dataset not found");

      const result = await trainSmartRagFromApprovedDashboard({
        dataset,
        dashboardPlan: body.acceptedDashboardPlan || body.dashboardPlan || body.currentDashboard,
        rating: body.rating || "good",
        notes: body.notes || "User approved dashboard pattern.",
        source: "smart-dashboard-feedback",
        useOllama: body.useOllama !== false,
      });

      ok(response, result, "Smart RAG memory trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Smart RAG training failed");
      return true;
    }
  }

  const dashboardMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-dashboard$/);
  if (method === "POST" && dashboardMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(dashboardMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found. Pass {rows, columns} in body or check dataset repository integration.");
      const result = await generateSchemaDashboard(dataset, {
        useLlm: body.useLlm !== false,
        threshold: body.threshold,
        ragThreshold: body.ragThreshold,
        ragLimit: body.ragLimit,
        useRagEmbedding: body.useRagEmbedding !== false,
      });
      ok(response, result, "Schema-trained RAG dashboard generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Dashboard generation failed");
      return true;
    }
  }

  const trainMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-train$/);
  if (method === "POST" && trainMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(trainMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found");
      const entry = trainSchemaDashboard(dataset, {
        dashboardPlan: body.dashboardPlan || body.acceptedDashboard,
        rating: body.rating || "good",
        notes: body.notes || "",
        source: "user-feedback",
      });
      ok(response, { entry, stats: getMemoryStats() }, "Schema pattern trained");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Schema training failed");
      return true;
    }
  }

  const commandMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/dashboard-command$/);
  if (method === "POST" && commandMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(commandMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found");
      const query = String(body.query || "").trim();
      if (!query) return fail(response, 400, "query is required");

      if (
        /fix|validate|correct|wrong|repair|regenerate/i.test(query) &&
        /dashboard|chart|charts|kpi|broken|invalid|wrong/i.test(query)
      ) {
        const result = validateAndFixDashboard(dataset, body.currentDashboard || {});
        ok(response, {
          action: "FIX_DASHBOARD",
          message: result.message,
          issues: result.issues,
          observations: result.observations,
          correctedDashboard: result.correctedDashboard,
          schemaOnly: true,
          provider: "local-integrity-engine",
          model: "local-calculation",
        }, "Dashboard fixed");
        return true;
      }

      const result = await runDashboardCommand({ dataset, query, currentDashboard: body.currentDashboard || {}, useLlm: body.useLlm !== false });
      ok(response, result, "Dashboard command processed");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Dashboard command failed");
      return true;
    }
  }

  const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema-chat$/);
  if (method === "POST" && chatMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(chatMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found");
      const query = String(body.query || body.message || "").trim();
      if (!query) return fail(response, 400, "query is required");
      const result = await runSchemaChat({ dataset, query, useLlm: body.useLlm !== false });
      ok(response, {
        userMessage: { role: "user", content: query, timestamp: new Date().toISOString() },
        assistantMessage: { role: "assistant", content: result.answer, model: result.model, provider: result.provider, schemaOnly: true, timestamp: new Date().toISOString() },
      }, "AI chat response generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "AI chat failed");
      return true;
    }
  }

  const seniorDashboardMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/senior-dashboard$/);
  if (method === "POST" && seniorDashboardMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(seniorDashboardMatch[1], body);
      if (!dataset) return fail(response, 404, "Dataset not found. Pass {rows, columns} in body or check dataset repository integration.");

      const result = await generateSeniorAnalystDashboard({
        dataset,
        currentDashboard: body.currentDashboard || {},
        options: {
          sampleSize: body.sampleSize,
          maxCharts: body.maxCharts ?? 10,
          maxKpis: body.maxKpis ?? 8,
          ragThreshold: body.ragThreshold,
          ragLimit: body.ragLimit,
          useRagEmbedding: body.useRagEmbedding !== false,
          domain: body.domain,
          objective: body.objective,
        },
      });

      ok(response, result, "Senior analyst dashboard generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Senior analyst dashboard failed");
      return true;
    }
  }

  const excelChatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/excel-chat$/);
  if (method === "POST" && excelChatMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(excelChatMatch[1], body);

      if (!dataset) return fail(response, 404, "Dataset not found");

      const query = String(body.query || body.message || "").trim();
      if (!query) return fail(response, 400, "query is required");

      const result = await runExcelAnalystChat({
        dataset,
        query,
        currentDashboard: body.currentDashboard || {},
        useLlm: body.useLlm !== false,
      });

      ok(response, {
        userMessage: {
          role: "user",
          content: query,
          timestamp: new Date().toISOString(),
        },
        assistantMessage: {
          role: "assistant",
          content: result.answer,
          model: result.model,
          provider: result.provider,
          schemaOnly: true,
          timestamp: new Date().toISOString(),
        },
        analysis: result,
      }, "Excel analyst response generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Excel analyst chat failed");
      return true;
    }
  }

  const excelAnalyzeMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/excel-analyze$/);
  if (method === "POST" && excelAnalyzeMatch) {
    try {
      const body = await readJsonBody(request);
      const dataset = await loadDatasetById(excelAnalyzeMatch[1], body);

      if (!dataset) return fail(response, 404, "Dataset not found");

      const result = await runExcelAnalystChat({
        dataset,
        query: body.query || "Analyze this dataset like an Excel expert",
        currentDashboard: body.currentDashboard || {},
        useLlm: body.useLlm !== false,
      });

      ok(response, result, "Excel analysis generated");
      return true;
    } catch (error) {
      fail(response, 500, error.message || "Excel analysis failed");
      return true;
    }
  }

  return false;
}

export default { handleSchemaTrainedAIRoutes };
