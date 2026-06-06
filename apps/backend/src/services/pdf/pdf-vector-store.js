import { createHash } from "node:crypto";

import { vectorDbConfig, isQdrantEnabled } from "../../config/vector-db.js";
import { embedSchemaMemoryText } from "../vector/embedding-client.js";
import { ensureQdrantCollection, getQdrantClient } from "../vector/qdrant-client.js";
import { getPdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";

function pointId(value) {
  const hex = createHash("sha1").update(String(value)).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function truncate(text, max = 3000) {
  return String(text || "").slice(0, max);
}

async function upsertTextPoints(collectionName, points) {
  if (!isQdrantEnabled()) {
    return { indexed: 0, skipped: true, reason: "Qdrant disabled" };
  }
  const embedded = [];
  for (const point of points) {
    const embedding = await embedSchemaMemoryText(point.text, { allowFallback: true });
    await ensureQdrantCollection(collectionName, embedding.dimension);
    embedded.push({
      id: pointId(point.id),
      vector: embedding.embedding,
      payload: {
        ...point.payload,
        text: truncate(point.text),
        embeddingModel: embedding.model,
        embeddingProvider: embedding.provider,
        updatedAt: new Date().toISOString(),
      },
    });
  }
  if (!embedded.length) return { indexed: 0 };
  await getQdrantClient().upsert(collectionName, { wait: true, points: embedded });
  return { indexed: embedded.length, collection: collectionName };
}

export async function indexPdfChunks(analysis = {}) {
  const chunks = (analysis.chunks || []).slice(0, 5000).map((chunk) => ({
    id: chunk.chunkId,
    text: chunk.text,
    payload: {
      documentId: analysis.documentId,
      chunkId: chunk.chunkId,
      type: chunk.type || chunk.chunkType,
      chunkType: chunk.chunkType || chunk.type,
      pageNumber: chunk.pageNumber,
      source: chunk.metadata?.source,
      confidence: chunk.metadata?.confidence,
      fileName: analysis.fileName,
      createdAt: new Date().toISOString(),
    },
  }));
  return upsertTextPoints(vectorDbConfig.qdrant.pdfChunksCollection, chunks);
}

export async function indexPdfSummaries(analysis = {}) {
  const summaryTypes = new Set(["document_summary", "document_overview", "section_summary", "page_summary", "title_page", "key_points"]);
  const chunks = (analysis.chunks || [])
    .filter((chunk) => summaryTypes.has(chunk.type || chunk.chunkType))
    .map((chunk) => ({
      id: chunk.chunkId,
      text: chunk.text,
      payload: {
        documentId: analysis.documentId,
        chunkId: chunk.chunkId,
        type: chunk.type || chunk.chunkType,
        chunkType: chunk.chunkType || chunk.type,
        pageNumber: chunk.pageNumber,
        source: chunk.metadata?.source,
        confidence: chunk.metadata?.confidence,
        fileName: analysis.fileName,
        pageRange: chunk.metadata?.pageRange,
        keyPoints: chunk.metadata?.keyPoints,
        createdAt: new Date().toISOString(),
      },
    }));
  return upsertTextPoints(vectorDbConfig.qdrant.pdfSummariesCollection, chunks);
}

export async function indexPdfTables(analysis = {}) {
  const tables = (analysis.tables || []).map((table) => {
    const preview = table.preview || table.cleanedRows?.slice(0, 5) || [];
    return {
      id: table.tableId,
      text: `PDF table ${table.tableId} columns ${JSON.stringify(table.cleanedColumns || [])} schema ${JSON.stringify(table.schema || {})} preview ${JSON.stringify(preview)}`,
      payload: {
        documentId: analysis.documentId,
        tableId: table.tableId,
        chunkId: `${table.tableId}_summary`,
        type: "table_summary",
        chunkType: "table_summary",
        pageNumber: table.pageNumber,
        columns: table.cleanedColumns || [],
        summary: table.summary || "",
        schema: table.schema || {},
        qualityScore: table.quality?.score ?? table.confidence,
        confidence: table.quality?.score ?? table.confidence,
        usableForDashboard: table.usableForDashboard,
        preview,
        createdAt: new Date().toISOString(),
      },
    };
  });
  return upsertTextPoints(vectorDbConfig.qdrant.pdfTablesCollection, tables);
}

export function detectPdfQueryIntent(query = "") {
  const value = String(query || "").toLowerCase();
  const pageMatch = value.match(/\bpage\s+(\d+)\b/);
  if (/\b(convert|dataset|dashboard)\b/.test(value) && /\b(table|pdf)\b/.test(value)) return { intent: "conversion_request", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (/\b(table|tables|row|column|schema)\b/.test(value)) return { intent: "table_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (/\b(total|highest|lowest|average|metric|calculate|sum|count)\b/.test(value)) return { intent: "metric_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (/\b(chart|visual|graph|plot)\b/.test(value)) return { intent: "chart_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (pageMatch || /\bwhat is on page\b/.test(value)) return { intent: "page_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  if (/\b(explain|overview|summary|summarize|about|key points|important points|whole pdf|document)\b/.test(value)) return { intent: "document_explanation", pageNumber: null };
  if (/\b(where|find|mention|search)\b/.test(value)) return { intent: "search_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
  return { intent: "search_question", pageNumber: pageMatch ? Number(pageMatch[1]) : null };
}

function priorityForType(intent, chunkType) {
  const type = chunkType || "page_text";
  const priorities = {
    document_explanation: {
      document_summary: 120,
      document_overview: 115,
      section_summary: 105,
      page_summary: 95,
      title_page: 90,
      key_points: 85,
      page_text: 55,
      visual_text: 50,
      table_summary: 30,
      table: 20,
    },
    table_question: { table_summary: 120, table_schema: 110, document_overview: 55, page_summary: 50, page_text: 35 },
    metric_question: { table_summary: 110, page_summary: 70, page_text: 60, document_summary: 45 },
    chart_question: { document_overview: 90, page_summary: 70, visual_text: 70, table_summary: 60 },
    page_question: { page_summary: 120, page_text: 100, visual_text: 95, table_summary: 55, document_overview: 35 },
    conversion_request: { table_summary: 125, table_schema: 110, page_summary: 40 },
    search_question: { page_text: 95, visual_text: 90, page_summary: 70, section_summary: 60, document_summary: 50, table_summary: 35 },
  };
  return priorities[intent]?.[type] ?? 40;
}

function keywordScore(text = "", query = "") {
  const haystack = String(text || "").toLowerCase();
  const terms = String(query || "")
    .toLowerCase()
    .split(/\W+/)
    .filter((term) => term.length > 2);
  if (!terms.length) return 0;
  return terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0) / terms.length;
}

function normalizeMatch(match, query, intent, pageNumber) {
  const chunkType = match.chunkType || match.type || (match.tableId ? "table_summary" : "page_text");
  const pageBoost = pageNumber && Number(match.pageNumber) === Number(pageNumber) ? 50 : 0;
  const score = Number(match.score || 0) + priorityForType(intent, chunkType) / 100 + keywordScore(match.text || match.summary, query) + pageBoost / 100;
  return {
    ...match,
    type: chunkType,
    chunkType,
    score,
    text: match.text || match.summary || "",
    confidence: match.confidence ?? match.qualityScore ?? null,
  };
}

function localSearchPdfChunks({ documentId, query, intent, limit = 8, pageNumber }) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) return { matches: [], skipped: true, reason: "Document not found" };
  const chunks = [
    ...(analysis.chunks || []),
    ...(analysis.pages || []).flatMap((page) => {
      const items = [];
      if (page.pageSummary) {
        items.push({
          chunkId: `${documentId}_page_${page.pageNumber}_summary_local`,
          type: "page_summary",
          chunkType: "page_summary",
          pageNumber: page.pageNumber,
          text: page.pageSummary,
          confidence: page.confidence,
          source: "local_page_summary",
        });
      }
      const pageText = page.cleanedText || page.text || page.mergedText;
      if (pageText) {
        items.push({
          chunkId: `${documentId}_page_${page.pageNumber}_text_local`,
          type: "page_text",
          chunkType: "page_text",
          pageNumber: page.pageNumber,
          text: pageText,
          confidence: page.confidence,
          source: page.extractionMethod || page.method || "local_page_text",
        });
      }
      return items;
    }),
    ...[
      analysis.summary?.detailedSummary || analysis.summary?.long || analysis.summary?.shortSummary || analysis.summary?.short
        ? {
            chunkId: `${documentId}_document_summary_local`,
            type: "document_summary",
            chunkType: "document_summary",
            pageNumber: null,
            text: analysis.summary.detailedSummary || analysis.summary.long || analysis.summary.shortSummary || analysis.summary.short,
            confidence: analysis.quality?.overallScore ?? 0.75,
            source: "local_document_summary",
          }
        : null,
    ].filter(Boolean),
    ...(analysis.tables || []).map((table) => ({
      chunkId: `${table.tableId}_summary`,
      type: "table_summary",
      chunkType: "table_summary",
      pageNumber: table.pageNumber,
      text: table.summary || `Table ${table.tableId} columns ${(table.cleanedColumns || []).join(", ")}`,
      confidence: table.quality?.score ?? table.confidence,
      source: table.extractionMethod,
      tableId: table.tableId,
    })),
  ];
  const filtered = chunks.filter((chunk) => !pageNumber || Number(chunk.pageNumber) === Number(pageNumber));
  return {
    matches: filtered
      .map((chunk) =>
        normalizeMatch(
          {
            documentId,
            chunkId: chunk.chunkId,
            type: chunk.type,
            chunkType: chunk.chunkType || chunk.type,
            pageNumber: chunk.pageNumber,
            text: chunk.text,
            source: chunk.metadata?.source || chunk.source,
            confidence: chunk.metadata?.confidence ?? chunk.confidence,
            tableId: chunk.metadata?.tableId || chunk.tableId,
          },
          query,
          intent,
          pageNumber,
        ),
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
    collection: "local-json",
    fallback: true,
  };
}

async function searchCollection(collectionName, { documentId, query, limit, minScore, pageNumber }) {
  const embedding = await embedSchemaMemoryText(query, { allowFallback: true });
  await ensureQdrantCollection(collectionName, embedding.dimension);
  const must = [];
  if (documentId) must.push({ key: "documentId", match: { value: documentId } });
  if (pageNumber) must.push({ key: "pageNumber", match: { value: Number(pageNumber) } });
  return getQdrantClient().search(collectionName, {
    vector: embedding.embedding,
    limit,
    score_threshold: minScore,
    filter: must.length ? { must } : undefined,
    with_payload: true,
  });
}

export async function searchPdfChunks({ documentId, query, intent, limit = 8, minScore = 0.12, pageNumber }) {
  const detected = intent ? { intent, pageNumber } : detectPdfQueryIntent(query);
  const finalIntent = detected.intent;
  const finalPageNumber = pageNumber ?? detected.pageNumber;
  if (!isQdrantEnabled()) return localSearchPdfChunks({ documentId, query, intent: finalIntent, limit, pageNumber: finalPageNumber });

  try {
    const collections =
      finalIntent === "table_question" || finalIntent === "conversion_request"
        ? [vectorDbConfig.qdrant.pdfTablesCollection, vectorDbConfig.qdrant.pdfSummariesCollection, vectorDbConfig.qdrant.pdfChunksCollection]
        : finalIntent === "document_explanation"
          ? [vectorDbConfig.qdrant.pdfSummariesCollection, vectorDbConfig.qdrant.pdfChunksCollection, vectorDbConfig.qdrant.pdfTablesCollection]
          : [vectorDbConfig.qdrant.pdfChunksCollection, vectorDbConfig.qdrant.pdfSummariesCollection, vectorDbConfig.qdrant.pdfTablesCollection];
    const batches = [];
    for (const collection of collections) {
      const results = await searchCollection(collection, {
        documentId,
        query,
        limit: Math.max(limit, 12),
        minScore,
        pageNumber: finalPageNumber,
      });
      batches.push(...results.map((result) => ({ score: result.score, ...(result.payload || {}) })));
    }
    const byId = new Map();
    for (const match of batches.map((item) => normalizeMatch(item, query, finalIntent, finalPageNumber))) {
      const key = match.chunkId || match.tableId || `${match.pageNumber}:${match.text?.slice(0, 40)}`;
      if (!byId.has(key) || byId.get(key).score < match.score) byId.set(key, match);
    }
    return {
      matches: [...byId.values()].sort((a, b) => b.score - a.score).slice(0, limit),
      collection: collections.join(","),
      intent: finalIntent,
    };
  } catch (error) {
    return { ...localSearchPdfChunks({ documentId, query, intent: finalIntent, limit, pageNumber: finalPageNumber }), qdrantError: error.message };
  }
}

export async function indexPdfAnalysisBestEffort(analysis) {
  try {
    const chunks = await indexPdfChunks(analysis);
    const summaries = await indexPdfSummaries(analysis);
    const tables = await indexPdfTables(analysis);
    return { success: true, chunks, summaries, tables };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function reindexPdfDocument(documentId) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) throw new Error("PDF intelligence document not found");
  return indexPdfAnalysisBestEffort(analysis);
}

export async function deletePdfIndex(_documentId) {
  return { success: true, skipped: true, reason: "Per-document Qdrant delete is not configured; reindex overwrites matching point ids." };
}
