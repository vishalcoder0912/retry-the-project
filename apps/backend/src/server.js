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
  generateDemoDataset,
  normalizeColumns,
} from "./services/analytics-service.js";

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

      const analysis = createChatResponse(dataset, query);
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
      };

      saveChatMessages(datasetId, [userMessage, assistantMessage]);
      sendJson(response, 201, { userMessage, assistantMessage });
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
