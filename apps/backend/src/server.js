import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

process.on('uncaughtException', (err) => {
  console.error('[fatal] Uncaught exception:', err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[fatal] Unhandled rejection at:', promise, 'reason:', reason);
});

import {
  createDataset,
  getChatMessages,
  getCurrentDataset,
  getDatabasePath,
  getDatasetById,
  patchDatasetRow,
  saveChatMessages,
} from "./database/dataset-repository.js";
import { 
  initializeCache, 
  getCacheStats, 
  clearDatasetCache 
} from "./services/query-cache.js";
import { performAICascadeAnalysis, getCascadeStatus } from "./services/ai-cascade-service.js";
import { 
  generateUploadQRSession, 
  getUploadSessionStatus, 
  handleQRFileUpload,
  cleanupExpiredSessions,
  getActiveSessionsCount
} from "./services/qr-upload-service.js";
import MLClient from "./services/ml-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Initialize cache immediately on startup
console.log("[startup] Initializing query cache...");
try {
  initializeCache();
  console.log("[startup] ✅ Query cache initialized successfully");
} catch (error) {
  console.error("[startup] ❌ Cache init failed:", error.message);
  process.exit(1);
}
import {
  buildDatasetSchema,
  createChatResponse,
  createSchemaFirstChatResponse,
  generateCorrelationAnalysis,
  generateDemoDataset,
  normalizeColumns,
} from "./services/analytics-service.js";
import {
  generateSQLFromSchema,
  validateSQLQuery,
} from "./services/schema-ai-service.js";
import {
  createLocalDatabase,
  executeLocalQuery,
  getLocalData,
  deleteLocalDatabase,
} from "./services/local-database-service.js";
import {
  analyzeDatasetProfile,
  detectAnomalies,
  generateNarrative,
  mapColumnRelationships,
  generateDrillDownSuggestions,
  suggestDataCleaning,
} from "./services/ai-data-service.js";
import { generateAdvancedCharts } from "./services/data-visualization-service.js";
import { exportToJSON, exportToCSV, exportToMarkdown } from "./services/export-service.js";
import { stratifiedSample, randomSample, clusteredSample } from "./services/data-sampling-service.js";

const port = Number(process.env.PORT || 3001);

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
  });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (request) =>
  new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 60 * 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });

const buildState = () => {
  const dataset = getCurrentDataset();
  return {
    dataset,
    chatMessages: dataset ? getChatMessages(dataset.id) : [],
  };
};

const buildIndexPayload = () => {
  const state = buildState();

  return {
    name: "InsightFlow Local API",
    status: "ok",
    currentDataset: state.dataset
      ? {
          id: state.dataset.id,
          name: state.dataset.name,
          rowCount: state.dataset.rowCount,
          columnCount: state.dataset.columns.length,
        }
      : null,
    routes: {
      health: "GET /api/health",
      state: "GET /api/state",
      importDataset: "POST /api/datasets/import",
      loadDemo: "POST /api/datasets/demo",
      datasetSchema: "GET /api/datasets/:datasetId/schema",
      updateRow: "PATCH /api/datasets/:datasetId/rows/:rowId",
      chat: "POST /api/datasets/:datasetId/chat",
    },
  };
};

const server = createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing request URL" });
    return;
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  const { pathname } = url;

  try {
    if (request.method === "GET" && pathname === "/") {
      sendJson(response, 200, buildIndexPayload());
      return;
    }

    // ============================================================
    // CACHE STATS ENDPOINT (for monitoring, no authentication needed)
    // ============================================================
    if (pathname === "/api/cache/stats" && request.method === "GET") {
      const stats = getCacheStats();
      sendJson(response, 200, {
        success: true,
        cache: stats,
        message: "Cache stats retrieved successfully",
      });
      return;
    }

    // GET cache stats for specific dataset
    const cacheDatasetMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/cache\/stats$/);
    if (cacheDatasetMatch && request.method === "GET") {
      const [, datasetId] = cacheDatasetMatch;
      const stats = getCacheStats(datasetId);
      sendJson(response, 200, {
        success: true,
        datasetId,
        cache: stats,
      });
      return;
    }

    // Clear cache for dataset (useful for testing)
    const clearCacheMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/cache\/clear$/);
    if (clearCacheMatch && request.method === "POST") {
      const [, datasetId] = clearCacheMatch;
      clearDatasetCache(datasetId);
      sendJson(response, 200, {
        success: true,
        message: `Cache cleared for dataset ${datasetId}`,
      });
      return;
    }

    // ============================================================
    // ML ROUTES
    // ============================================================
    if (request.method === "POST" && pathname === "/api/ml/health") {
      try {
        const health = await MLClient.health();
        sendJson(response, health.success ? 200 : 503, health);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    if (request.method === "GET" && pathname === "/api/ml/models/list") {
      try {
        const result = await MLClient.listModels();
        sendJson(response, result.success ? 200 : 500, result);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    const mlTrainMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/train$/);
    if (request.method === "POST" && mlTrainMatch) {
      const [, datasetId] = mlTrainMatch;
      try {
        const body = await readJsonBody(request);
        const { targetColumn, problemType = 'regression' } = body;
        
        const dataset = getDatasetById(datasetId);
        if (!dataset) {
          sendJson(response, 404, { error: 'Dataset not found' });
          return;
        }

        if (!dataset.columns.find((c) => c.name === targetColumn)) {
          sendJson(response, 400, { error: `Column "${targetColumn}" not found` });
          return;
        }

        const result = await MLClient.trainModel(datasetId, dataset.rows, targetColumn, problemType);
        if (result.success) {
          sendJson(response, 200, {
            success: true,
            model: {
              id: result.model_id,
              accuracy: result.accuracy,
              features: result.feature_importance,
              trainingCompletedAt: result.training_completed_at,
            },
            message: '✅ Model trained successfully',
          });
        } else {
          sendJson(response, 500, { success: false, error: result.error });
        }
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    const mlPredictMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/predict$/);
    if (request.method === "POST" && mlPredictMatch) {
      const [, datasetId] = mlPredictMatch;
      try {
        const body = await readJsonBody(request);
        const { inputData } = body;

        if (!inputData) {
          sendJson(response, 400, { error: 'inputData is required' });
          return;
        }

        const result = await MLClient.predict(datasetId, inputData);
        if (result.success) {
          sendJson(response, 200, {
            success: true,
            predictions: result.predictions,
            count: result.count,
          });
        } else {
          sendJson(response, 500, { success: false, error: result.error });
        }
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    const mlFeatureMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/feature-importance$/);
    if (request.method === "GET" && mlFeatureMatch) {
      const [, datasetId] = mlFeatureMatch;
      try {
        const result = await MLClient.getFeatureImportance(datasetId);
        if (result.success) {
          sendJson(response, 200, { success: true, importance: result.importance });
        } else {
          sendJson(response, 500, { success: false, error: result.error });
        }
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    const mlModelDelMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ml\/model$/);
    if (request.method === "DELETE" && mlModelDelMatch) {
      const [, datasetId] = mlModelDelMatch;
      try {
        const result = await MLClient.deleteModel(datasetId);
        sendJson(response, result.success ? 200 : 500, result);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    if (request.method === "GET" && pathname === "/api/health") {
      sendJson(response, 200, {
        status: "ok",
        databasePath: getDatabasePath(),
      });
      return;
    }

    if (request.method === "GET" && pathname === "/api/state") {
      sendJson(response, 200, buildState());
      return;
    }

    if (request.method === "POST" && pathname === "/api/datasets/demo") {
      const demoDataset = generateDemoDataset();
      const dataset = createDataset({
        name: demoDataset.name,
        fileName: demoDataset.fileName,
        columns: demoDataset.columns,
        rows: demoDataset.rows,
        sourceType: demoDataset.sourceType,
      });

      sendJson(response, 201, { dataset, chatMessages: [] });
      return;
    }

    if (request.method === "POST" && pathname === "/api/datasets/import") {
      const body = await readJsonBody(request);
      const rows = Array.isArray(body.rows) ? body.rows : [];

      if (rows.length === 0) {
        sendJson(response, 400, { error: "Dataset must contain at least one row" });
        return;
      }

      const columns = normalizeColumns(rows, Array.isArray(body.columns) ? body.columns : []);
      const dataset = createDataset({
        name: body.name || "Uploaded Dataset",
        fileName: body.fileName || null,
        columns,
        rows,
        sourceType: body.sourceType || "upload",
      });

      sendJson(response, 201, { dataset, chatMessages: [] });
      return;
    }

    const rowMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/rows\/([^/]+)$/);
    if (request.method === "PATCH" && rowMatch) {
      const [, datasetId, rowIdValue] = rowMatch;
      const body = await readJsonBody(request);

      if (!body.column) {
        sendJson(response, 400, { error: "Column is required" });
        return;
      }

      const dataset = patchDatasetRow({
        datasetId,
        rowId: Number(rowIdValue),
        column: body.column,
        value: body.value,
      });

      if (!dataset) {
        sendJson(response, 404, { error: "Row not found" });
        return;
      }

      sendJson(response, 200, { dataset });
      return;
    }

    const schemaMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/schema$/);
    if (request.method === "GET" && schemaMatch) {
      const [, datasetId] = schemaMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      sendJson(response, 200, { schema: buildDatasetSchema(dataset) });
      return;
    }

    const aiProfileMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/profile$/);
    if (request.method === "GET" && aiProfileMatch) {
      const [, datasetId] = aiProfileMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const profile = await analyzeDatasetProfile(dataset.rows, dataset.columns);
        sendJson(response, 200, { success: true, profile });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    const aiAnomaliesMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/anomalies$/);
    if (request.method === "GET" && aiAnomaliesMatch) {
      const [, datasetId] = aiAnomaliesMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const anomalies = await detectAnomalies(dataset.rows, dataset.columns);
        sendJson(response, 200, { success: true, anomalies });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    const aiRelationshipsMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/relationships$/);
    if (request.method === "GET" && aiRelationshipsMatch) {
      const [, datasetId] = aiRelationshipsMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const relationships = await mapColumnRelationships(dataset.rows, dataset.columns);
        sendJson(response, 200, { success: true, relationships });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    const aiCleaningMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/cleaning$/);
    if (request.method === "GET" && aiCleaningMatch) {
      const [, datasetId] = aiCleaningMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const suggestions = await suggestDataCleaning(dataset.rows, dataset.columns);
        sendJson(response, 200, { success: true, suggestions });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    const aiNarrativeMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/narrative$/);
    if (request.method === "POST" && aiNarrativeMatch) {
      const [, datasetId] = aiNarrativeMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const body = await readJsonBody(request);
        const narrative = await generateNarrative(dataset.name, body.analysisResults || {});
        sendJson(response, 200, { success: true, narrative });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    const aiSuggestionsMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/suggestions$/);
    if (request.method === "GET" && aiSuggestionsMatch) {
      const [, datasetId] = aiSuggestionsMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const profile = await analyzeDatasetProfile(dataset.rows, dataset.columns);
        sendJson(response, 200, { 
          success: true, 
          suggestions: profile.suggestedAnalyses,
          recommendations: profile.recommendations,
        });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    // AI Cascade Status Endpoint
    if (request.method === "GET" && pathname === "/api/cascade/status") {
      try {
        const status = await getCascadeStatus();
        sendJson(response, 200, { success: true, cascade: status });
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // QR Code Generation Endpoint
    if (request.method === "POST" && pathname === "/api/qr-upload/generate") {
      try {
        const session = generateUploadQRSession();
        sendJson(response, 201, {
          success: true,
          sessionId: session.sessionId,
          uploadToken: session.uploadToken,
          expiresAt: session.expiresAt,
          uploadUrl: session.uploadUrl,
        });
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // QR Session Status Endpoint
    const qrStatusMatch = pathname.match(/^\/api\/qr-upload\/([A-Z0-9]+)\/status$/);
    if (request.method === "GET" && qrStatusMatch) {
      const [, sessionId] = qrStatusMatch;
      const uploadToken = url.searchParams.get("token");

      if (!uploadToken) {
        sendJson(response, 400, { error: "Upload token required" });
        return;
      }

      try {
        const status = getUploadSessionStatus(sessionId, uploadToken);
        if (status.error) {
          sendJson(response, 401, { success: false, ...status });
        } else {
          sendJson(response, 200, { success: true, ...status });
        }
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // QR File Upload Endpoint
    const qrUploadMatch = pathname.match(/^\/api\/qr-upload\/([A-Z0-9]+)\/([a-f0-9-]+)$/);
    if (request.method === "POST" && qrUploadMatch) {
      const [, sessionId, uploadToken] = qrUploadMatch;

      try {
        const body = await readJsonBody(request);
        const { fileName, rows, columns } = body;

        if (!fileName || !rows || !columns) {
          sendJson(response, 400, { error: "fileName, rows, and columns are required" });
          return;
        }

        handleQRFileUpload(sessionId, uploadToken, JSON.stringify(body), fileName);

        const dataset = createDataset({
          name: fileName.replace(/\.[^/.]+$/, ""),
          fileName: fileName,
          columns: columns,
          rows: rows,
          sourceType: "qr-mobile",
        });

        sendJson(response, 201, {
          success: true,
          message: "File uploaded via QR",
          dataset,
          source: "mobile-qr",
          sessionId,
        });
      } catch (error) {
        sendJson(response, 400, { error: error.message });
      }
      return;
    }

    const chatMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/chat$/);
    if (request.method === "POST" && chatMatch) {
      const [, datasetId] = chatMatch;
      const body = await readJsonBody(request);
      const query = String(body.query || "").trim();

      if (!query) {
        sendJson(response, 400, { error: "Query is required" });
        return;
      }

      const dataset = getDatasetById(datasetId);
      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      // Use AI Cascade: Ollama → Gemini → Local
      const analysis = await performAICascadeAnalysis(dataset, query);
      const now = new Date().toISOString();
      const userMessage = {
        id: randomUUID(),
        role: "user",
        content: query,
        timestamp: now,
      };
      const assistantMessage = {
        id: randomUUID(),
        role: "assistant",
        content: analysis.content,
        sql: analysis.sql,
        chart: analysis.chart,
        insights: analysis.insights,
        timestamp: now,
        usedAI: analysis.usedAI,
        confidence: analysis.confidence,
        intent: analysis.intent,
        cascade: analysis.cascade,
      };

      saveChatMessages(datasetId, [userMessage, assistantMessage]);
      sendJson(response, 201, { userMessage, assistantMessage });
      return;
    }

    const aiCorrMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai-correlations$/);
    if (request.method === "GET" && aiCorrMatch) {
      const [, datasetId] = aiCorrMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      const correlationResult = generateCorrelationAnalysis(dataset);
      sendJson(response, 200, correlationResult);
      return;
    }

    // Schema-only AI query endpoint
    if (request.method === "POST" && pathname === "/api/datasets/schema-ai-query") {
      const body = await readJsonBody(request);
      const { schema, query } = body;

      if (!schema) {
        sendJson(response, 400, { error: "Schema is required" });
        return;
      }

      if (!query) {
        sendJson(response, 400, { error: "Query is required" });
        return;
      }

      try {
        const result = await generateSQLFromSchema(schema, query);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // Local dataset import endpoint
    if (request.method === "POST" && pathname === "/api/datasets/local-import") {
      const body = await readJsonBody(request);
      const { name, fileName, columns, sourceType } = body;

      if (!columns || !Array.isArray(columns)) {
        sendJson(response, 400, { error: "Columns are required" });
        return;
      }

      try {
        // Clean rows to avoid duplicate 'id' column conflicts with SQLite autoincrement
        const cleanedRows = (body.rows || []).map(row => {
          const { id, __rowId, ...rest } = row;
          return rest;
        });

        // Filter out 'id' column from schema to avoid conflict with SQLite autoincrement
        const cleanedColumns = columns.filter(c => c.name !== 'id' && c.name !== '__rowId');

        const dbInfo = createLocalDatabase({ name, columns: cleanedColumns, rows: cleanedRows });
        
        // Create dataset record in main database
        const dataset = createDataset({
          name: name || "Local Dataset",
          fileName: fileName || null,
          columns: cleanedColumns,
          rows: [],
          sourceType: sourceType || "local",
        });

        sendJson(response, 201, {
          dataset: {
            ...dataset,
            isLocal: true,
            localDatasetId: dbInfo.datasetId,
          },
          chatMessages: [],
        });
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // Local query execution endpoint
    const localQueryMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/local-query$/);
    if (request.method === "POST" && localQueryMatch) {
      const [, datasetId] = localQueryMatch;
      const body = await readJsonBody(request);
      const { sql, page, limit } = body;

      if (!sql) {
        sendJson(response, 400, { error: "SQL query is required" });
        return;
      }

      try {
        const validation = validateSQLQuery(sql);
        if (!validation.valid) {
          sendJson(response, 400, { error: "Invalid SQL", details: validation.errors });
          return;
        }

        const results = executeLocalQuery(datasetId, sql, page || 0, limit || 100);
        sendJson(response, 200, results);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // Local data access endpoint
    const localDataMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/local-data$/);
    if (request.method === "GET" && localDataMatch) {
      const [, datasetId] = localDataMatch;
      const page = Number(url.searchParams.get('page') || '0');
      const limit = Number(url.searchParams.get('limit') || '100');

      try {
        const results = getLocalData(datasetId, page, limit);
        sendJson(response, 200, results);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // Advanced charts endpoint
    const advancedChartsMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/ai\/advanced-charts$/);
    if (request.method === "GET" && advancedChartsMatch) {
      const [, datasetId] = advancedChartsMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const charts = generateAdvancedCharts(dataset);
        sendJson(response, 200, { success: true, charts });
      } catch (error) {
        sendJson(response, 500, { success: false, error: error.message });
      }
      return;
    }

    // Export endpoint
    const exportMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/export\/([^/]+)$/);
    if (request.method === "GET" && exportMatch) {
      const [, datasetId, format] = exportMatch;
      const dataset = getDatasetById(datasetId);

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        const analysisResults = {
          profile: await analyzeDatasetProfile(dataset.rows, dataset.columns),
          anomalies: await detectAnomalies(dataset.rows, dataset.columns),
          relationships: await mapColumnRelationships(dataset.rows, dataset.columns),
        };

        let result;
        switch (format) {
          case 'json':
            result = exportToJSON(analysisResults, dataset.name);
            break;
          case 'csv':
            result = exportToCSV(dataset.rows, dataset.name);
            break;
          case 'md':
            result = exportToMarkdown(analysisResults, dataset.name);
            break;
          default:
            sendJson(response, 400, { error: "Unsupported format. Use json, csv, or md" });
            return;
        }

        response.writeHead(200, {
          "Content-Type": result.mimeType,
          "Content-Disposition": `attachment; filename="${result.filename}"`,
        });
        response.end(result.data);
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    // Sampling endpoint
    const sampleMatch = pathname.match(/^\/api\/datasets\/([^/]+)\/sample\/([^/]+)$/);
    if (request.method === "GET" && sampleMatch) {
      const [, datasetId, sampleType] = sampleMatch;
      const dataset = getDatasetById(datasetId);
      const sampleSize = Number(url.searchParams.get('size') || '1000');

      if (!dataset) {
        sendJson(response, 404, { error: "Dataset not found" });
        return;
      }

      try {
        let sampled;
        switch (sampleType) {
          case 'stratified':
            sampled = stratifiedSample(dataset.rows, sampleSize);
            break;
          case 'random':
            sampled = randomSample(dataset.rows, sampleSize);
            break;
          case 'clustered':
            sampled = clusteredSample(dataset.rows, dataset.columns, sampleSize);
            break;
          default:
            sendJson(response, 400, { error: "Unsupported sample type. Use stratified, random, or clustered" });
            return;
        }

        sendJson(response, 200, { 
          success: true, 
          originalSize: dataset.rows.length,
          sampleSize: sampled.length,
          rows: sampled 
        });
      } catch (error) {
        sendJson(response, 500, { error: error.message });
      }
      return;
    }

    sendJson(response, 404, { error: "Route not found" });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
});

server.listen(port, () => {
  console.log(`InsightFlow API listening on http://127.0.0.1:${port}`);
});
