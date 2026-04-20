import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
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

      // Use schema-first AI chat (falls back to local if no API key)
      const analysis = await createSchemaFirstChatResponse(dataset, query);
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
        reason: analysis.reason,
        metadata: analysis.metadata,
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
        const dbInfo = createLocalDatabase({ name, columns, rows: body.rows || [] });
        
        // Create dataset record in main database
        const dataset = createDataset({
          name: name || "Local Dataset",
          fileName: fileName || null,
          columns,
          rows: [], // Don't store rows in main DB for local mode
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
