import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";

import { analyzePdfWithMlService } from "../ml/pdf-intelligence-client.js";
import {
  createPdfDocument,
  getPdfIntelligenceAnalysis,
  markPdfProcessingStatus,
  savePdfIntelligenceAnalysis,
  savePdfJob,
  updatePdfDocument,
} from "./pdf-intelligence-store.js";
import { indexPdfAnalysisBestEffort, reindexPdfDocument } from "./pdf-vector-store.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";
import { buildHierarchicalPdfSummary } from "./pdf-hierarchical-summary.js";
import { buildPdfRagChunks } from "./pdf-rag-chunker.js";

const queue = [];
let running = false;

export function hashPdfFile(filePath) {
  const hash = createHash("sha256");
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest("hex");
}

function jobId(type) {
  return `${type}_${randomUUID()}`;
}

export function enqueuePdfJob({ documentId, type, handler, totalPages = null }) {
  const job = {
    id: jobId(type),
    documentId,
    type,
    status: "queued",
    progress: 0,
    currentPage: null,
    totalPages,
    attempts: 0,
    error: null,
  };
  savePdfJob(documentId, job);
  queue.push({ ...job, handler });
  void drainQueue();
  return job;
}

async function drainQueue() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift();
      await runJob(job);
    }
  } finally {
    running = false;
  }
}

async function runJob(job) {
  savePdfJob(job.documentId, { ...job, status: "running", attempts: (job.attempts || 0) + 1, progress: 1 });
  try {
    const result = await job.handler({
      update: (patch) => savePdfJob(job.documentId, { ...job, status: "running", ...patch }),
    });
    savePdfJob(job.documentId, { ...job, status: result?.skipped ? "skipped" : "completed", progress: 100, error: null });
    return result;
  } catch (error) {
    savePdfJob(job.documentId, { ...job, status: "failed", error: error.message, progress: 0 });
    markPdfProcessingStatus(job.documentId, "partially_completed", {
      statusMessage: `${job.type} failed: ${error.message}`,
    });
    return null;
  }
}

export function createUploadedPdfDocument({ file }) {
  const stat = fs.statSync(file.filePath);
  const fileHash = hashPdfFile(file.filePath);
  const documentId = `pdf_${fileHash.slice(0, 16)}`;
  const existing = getPdfIntelligenceAnalysis(documentId);
  if (existing?.fileHash === fileHash) {
    updatePdfDocument(documentId, {
      status: existing.status || "uploaded",
      statusMessage: "Reused cached PDF document record.",
    });
    return { documentId, fileHash, reused: true };
  }
  createPdfDocument({
    id: documentId,
    fileName: file.originalName,
    filePath: file.filePath,
    fileHash,
    fileSize: stat.size,
    status: "uploaded",
    progress: 0,
  });
  updatePdfDocument(documentId, {
    fileHash,
    fileSize: stat.size,
    mimeType: file.mimeType,
    statusMessage: "PDF uploaded. Processing started.",
  });
  return { documentId, fileHash, reused: false };
}

export function queueInitialPdfPipelines(documentId) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis?.filePath) throw new Error("PDF document file path is missing");

  enqueuePdfJob({
    documentId,
    type: "pdf.preview",
    handler: async () => {
      updatePdfDocument(documentId, {
        status: "previewing",
        statusMessage: "Creating fast PDF preview.",
      });
      return { skipped: Boolean(getPdfIntelligenceAnalysis(documentId)?.pageCount) };
    },
  });

  enqueuePdfJob({
    documentId,
    type: "pdf.extractText",
    handler: async ({ update }) => {
      const current = getPdfIntelligenceAnalysis(documentId);
      if (current?.pages?.length && current?.chunks?.length) return { skipped: true };
      update({ progress: 5 });
      const extracted = await analyzePdfWithMlService({
        filePath: current.filePath,
        documentId,
        ocrEnabled: false,
        forceOcr: false,
        extractTables: false,
        maxPages: pdfProcessingPolicy.maxPages,
      });
      const normalized = {
        ...current,
        ...extracted,
        chunks: buildPdfRagChunks({ ...current, ...extracted }),
        status: "text_extracted",
        progress: 55,
        statusMessage: "Digital text extracted and summarized.",
      };
      savePdfIntelligenceAnalysis(documentId, normalized);
      await buildHierarchicalPdfSummary(normalized);
      savePdfJob(documentId, {
        id: `pdf.clean_${documentId}`,
        type: "pdf.clean",
        status: "completed",
        progress: 100,
      });
      savePdfJob(documentId, {
        id: `pdf.chunk_${documentId}`,
        type: "pdf.chunk",
        status: "completed",
        progress: 100,
      });
      savePdfJob(documentId, {
        id: `pdf.summarize_${documentId}`,
        type: "pdf.summarize",
        status: "completed",
        progress: 100,
      });
      return extracted;
    },
  });

  enqueuePdfJob({
    documentId,
    type: "pdf.index",
    handler: async () => {
      const current = getPdfIntelligenceAnalysis(documentId);
      if (!current?.chunks?.length) return { skipped: true };
      const vectorIndex = await indexPdfAnalysisBestEffort(current);
      updatePdfDocument(documentId, {
        vectorIndex,
        status: "indexed",
        progress: 75,
        statusMessage: "PDF text and summaries indexed.",
      });
      return vectorIndex;
    },
  });

  enqueuePdfJob({
    documentId,
    type: "pdf.extractTables",
    handler: async () => runTableExtractionPipeline(documentId),
  });
}

export async function runTableExtractionPipeline(documentId) {
  const current = getPdfIntelligenceAnalysis(documentId);
  if (!current?.filePath) throw new Error("PDF document file path is missing");
  if (current.tablesExtractedAt && Array.isArray(current.tables)) return { skipped: true };
  const extracted = await analyzePdfWithMlService({
    filePath: current.filePath,
    documentId,
    ocrEnabled: false,
    forceOcr: false,
    extractTables: true,
    maxPages: pdfProcessingPolicy.maxPages,
  });
  const merged = {
    ...current,
    tables: extracted.tables || [],
    chunks: buildPdfRagChunks({
      ...current,
      tables: extracted.tables || [],
      chunks: mergeChunks(current.chunks || [], extracted.chunks || []),
    }),
    extractionSummary: { ...(current.extractionSummary || {}), ...(extracted.extractionSummary || {}) },
    quality: extracted.quality || current.quality,
    tablesExtractedAt: new Date().toISOString(),
    status: "tables_extracted",
    progress: Math.max(Number(current.progress || 0), 85),
    statusMessage: "Table extraction completed.",
  };
  savePdfIntelligenceAnalysis(documentId, merged);
  await indexPdfAnalysisBestEffort(merged);
  savePdfJob(documentId, {
    id: `pdf.visualize_${documentId}`,
    type: "pdf.visualize",
    status: merged.tables?.some((table) => table.usableForVisualization) ? "completed" : "skipped",
    progress: 100,
  });
  return merged;
}

function mergeChunks(existing, incoming) {
  const byId = new Map(existing.map((chunk) => [chunk.chunkId, chunk]));
  for (const chunk of incoming) byId.set(chunk.chunkId, chunk);
  return [...byId.values()];
}

export function queueReindexPipeline(documentId) {
  return enqueuePdfJob({
    documentId,
    type: "pdf.index",
    handler: async () => {
      const vectorIndex = await reindexPdfDocument(documentId);
      updatePdfDocument(documentId, {
        vectorIndex,
        status: "indexed",
        progress: 100,
        statusMessage: "PDF vector index rebuilt without OCR.",
      });
      return vectorIndex;
    },
  });
}

export function queueForceOcrPipeline(documentId) {
  return enqueuePdfJob({
    documentId,
    type: "pdf.ocr",
    handler: async () => {
      const current = getPdfIntelligenceAnalysis(documentId);
      if (!current?.filePath) throw new Error("PDF document file path is missing");
      const analysis = await analyzePdfWithMlService({
        filePath: current.filePath,
        documentId,
        ocrEnabled: true,
        forceOcr: true,
        extractTables: true,
        maxPages: pdfProcessingPolicy.maxPages,
      });
      const normalized = {
        ...analysis,
        chunks: buildPdfRagChunks(analysis),
      };
      await buildHierarchicalPdfSummary(normalized);
      const latest = getPdfIntelligenceAnalysis(documentId) || normalized;
      const vectorIndex = await indexPdfAnalysisBestEffort(latest);
      savePdfIntelligenceAnalysis(documentId, latest, {
        vectorIndex,
        status: "completed",
        progress: 100,
        statusMessage: "Forced OCR completed and affected chunks were reindexed.",
      });
      return latest;
    },
  });
}
