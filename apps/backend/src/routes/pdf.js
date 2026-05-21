import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Busboy from "busboy";

import { sendSuccess, sendError } from "../utils/response-utils.js";
import { HTTP_STATUS, ERROR_CODES } from "../config/constants.js";
import { createDataset } from "../database/dataset-repository.js";
import { updateDataset, updateAnalysis } from "./state.js";
import { parsePdfWithOpenDataLoader } from "../services/pdf/pdf-loader-service.js";
import { buildPdfDataset } from "../services/pdf/pdf-dataset-builder.js";
import { getPdfKnowledgeBase, savePdfKnowledgeBase } from "../services/pdf/pdf-store.js";
import { answerPdfQuestion } from "../services/pdf/pdf-qa-service.js";
import { buildDataAnalyticsProjectsDashboard } from "../services/playbooks/playbook-dashboard-engine.js";

const uploadDir = path.resolve("data", "uploads", "pdfs");
await fsp.mkdir(uploadDir, { recursive: true });

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk.toString();

      if (body.length > 10 * 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    request.on("error", reject);
  });
}

function parsePdfMultipart(request) {
  return new Promise((resolve, reject) => {
    const contentType = request.headers["content-type"] || "";

    if (!contentType.includes("multipart/form-data")) {
      reject(new Error("Content-Type must be multipart/form-data"));
      return;
    }

    const busboy = Busboy({
      headers: request.headers,
      limits: {
        files: 1,
        fileSize: 30 * 1024 * 1024,
      },
    });

    let uploadedFile = null;
    let settled = false;
    const fields = {};
    const writeTasks = [];

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    busboy.on("field", (name, value) => {
      fields[name] = value;
    });

    busboy.on("file", (fieldName, file, info) => {
      const { filename, mimeType } = info;

      if (mimeType !== "application/pdf") {
        file.resume();
        fail(new Error("Only PDF files are allowed"));
        return;
      }

      const safeName = String(filename || "document.pdf").replace(/[^\w.-]+/g, "_");
      const storedName = `${randomUUID()}-${safeName}`;
      const filePath = path.join(uploadDir, storedName);
      const stream = fs.createWriteStream(filePath);

      uploadedFile = {
        fieldName,
        originalName: safeName,
        storedName,
        filePath,
        mimeType,
      };

      file.pipe(stream);

      writeTasks.push(
        new Promise((resolveStream, rejectStream) => {
          stream.on("finish", resolveStream);
          stream.on("error", rejectStream);
          file.on("limit", () => rejectStream(new Error("PDF file is too large")));
        }),
      );
    });

    busboy.on("error", fail);

    busboy.on("finish", async () => {
      if (settled) return;

      try {
        await Promise.all(writeTasks);

        if (!uploadedFile) {
          fail(new Error("PDF file is required"));
          return;
        }

        settled = true;
        resolve({ file: uploadedFile, fields });
      } catch (error) {
        fail(error);
      }
    });

    request.pipe(busboy);
  });
}

function safeNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[,$₹%]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallbackAnalysis(dataset) {
  const columns = dataset.columns || [];
  const rows = dataset.rows || [];
  const numeric = columns.find((column) => column.type === "number");
  const dimension = columns.find((column) => column.type !== "number");
  const kpis = [
    {
      id: randomUUID(),
      title: "Extracted Rows",
      value: rows.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    },
    {
      id: randomUUID(),
      title: "Extracted Columns",
      value: columns.length.toLocaleString(),
      metric: "*",
      aggregation: "count",
    },
  ];
  const chartRecommendations = [];

  if (dimension) {
    const counts = new Map();

    for (const row of rows) {
      const key = String(row[dimension.name] || "Unknown");
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    chartRecommendations.push({
      id: randomUUID(),
      title: `Rows by ${dimension.name}`,
      type: "bar",
      xKey: dimension.name,
      yKey: "count",
      aggregation: "count",
      data: [...counts.entries()]
        .map(([label, count]) => ({ [dimension.name]: label, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    });
  }

  if (numeric && dimension) {
    const groups = new Map();

    for (const row of rows) {
      const key = String(row[dimension.name] || "Unknown");
      const value = safeNumber(row[numeric.name]);
      if (value === null) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(value);
    }

    chartRecommendations.push({
      id: randomUUID(),
      title: `Average ${numeric.name} by ${dimension.name}`,
      type: "bar",
      xKey: dimension.name,
      yKey: numeric.name,
      aggregation: "avg",
      data: [...groups.entries()]
        .map(([label, values]) => ({
          [dimension.name]: label,
          [numeric.name]: values.reduce((sum, value) => sum + value, 0) / values.length,
        }))
        .sort((a, b) => b[numeric.name] - a[numeric.name])
        .slice(0, 10),
    });
  }

  return {
    dataType: "pdf_document",
    dataTypeLabel: "PDF Extracted Dataset",
    kpis,
    chartRecommendations,
    insights: [
      {
        type: "summary",
        title: "PDF Imported",
        message: `Extracted ${rows.length.toLocaleString()} rows and ${columns.length.toLocaleString()} columns from PDF tables.`,
      },
    ],
    privacy: {
      rawPdfSentToLLM: false,
      schemaOnly: true,
    },
  };
}

async function analyzePdfDataset(dataset) {
  try {
    const analysis = await buildDataAnalyticsProjectsDashboard(dataset);
    if (analysis) return analysis;
  } catch {
    // fallback below
  }

  return buildFallbackAnalysis(dataset);
}

export async function handlePdfRoutes(request, response, pathname) {
  const { method } = request;

  if (pathname === "/api/pdf/import" && method === "POST") {
    try {
      const { file } = await parsePdfMultipart(request);
      const parsed = await parsePdfWithOpenDataLoader(file.filePath);
      const { dataset: extractedDataset, knowledgeBase, tables } = buildPdfDataset({
        fileName: file.originalName,
        pdfJson: parsed.json,
        markdown: parsed.markdown,
      });
      const pdfId = randomUUID();
      const dataset = createDataset({
        name: extractedDataset.name,
        fileName: extractedDataset.fileName,
        sourceType: "pdf",
        columns: extractedDataset.columns,
        rows: extractedDataset.rows,
      });
      const finalDataset = dataset || { ...extractedDataset, id: pdfId };

      updateDataset(finalDataset);

      savePdfKnowledgeBase(pdfId, {
        pdfId,
        datasetId: finalDataset.id,
        fileName: file.originalName,
        jobId: parsed.jobId,
        outputDir: parsed.outputDir,
        knowledgeBase,
        tables,
      });

      const analysis = await analyzePdfDataset(finalDataset);
      updateAnalysis(analysis);

      sendSuccess(
        response,
        {
          pdf: {
            id: pdfId,
            datasetId: finalDataset.id,
            fileName: file.originalName,
            jobId: parsed.jobId,
            tableCount: tables.length,
            chunkCount: knowledgeBase.chunks.length,
            textElementCount: knowledgeBase.textElements.length,
          },
          dataset: finalDataset,
          analysis,
          knowledgeBaseSummary: {
            tableCount: tables.length,
            chunkCount: knowledgeBase.chunks.length,
            textElementCount: knowledgeBase.textElements.length,
          },
          privacy: {
            rawPdfSentToLLM: false,
            extractedTextCanBeUsedForRAG: true,
            dashboardValuesCalculatedLocally: true,
          },
        },
        "PDF imported and analyzed",
      );

      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.BAD_REQUEST,
        error.message || "PDF import failed",
        ERROR_CODES.VALIDATION_ERROR,
      );

      return true;
    }
  }

  const askMatch = pathname.match(/^\/api\/pdf\/([^/]+)\/ask$/);

  if (askMatch && method === "POST") {
    try {
      const [, pdfId] = askMatch;
      const body = await readJsonBody(request);

      if (!body.query) {
        sendError(response, HTTP_STATUS.BAD_REQUEST, "Query is required", ERROR_CODES.VALIDATION_ERROR);
        return true;
      }

      const stored = getPdfKnowledgeBase(pdfId);

      if (!stored) {
        sendError(response, HTTP_STATUS.NOT_FOUND, "PDF knowledge base not found", ERROR_CODES.DATASET_NOT_FOUND);
        return true;
      }

      const result = await answerPdfQuestion({
        query: body.query,
        knowledgeBase: stored.knowledgeBase,
      });

      sendSuccess(response, result, "PDF question answered");
      return true;
    } catch (error) {
      sendError(
        response,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        error.message || "PDF question failed",
        ERROR_CODES.AI_GENERATION_FAILED,
      );

      return true;
    }
  }

  return false;
}
