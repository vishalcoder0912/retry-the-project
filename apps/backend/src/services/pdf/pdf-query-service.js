import { getPdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";
import { detectPdfQueryIntent, searchPdfChunks } from "./pdf-vector-store.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";
import { getPdfReadiness, getProcessingAnswer } from "./pdf-readiness.js";

const PDF_QA_SYSTEM_PROMPT =
  "You are InsightFlow PDF Intelligence AI. Answer only using the retrieved PDF context and stored document summaries. Do not invent facts. If the answer is not present in the context, say that it was not found in the indexed PDF content. If OCR confidence is low, clearly mention uncertainty. Prefer document summary and page summaries for overview questions. Prefer table chunks only for table-specific questions. Include page references when possible.";

export function buildPdfContext(matches = [], maxChars = 14000) {
  let used = 0;
  const sources = [];
  const parts = [];
  for (const [index, match] of matches.entries()) {
    const text = String(match.text || "").trim();
    if (!text) continue;
    const remaining = maxChars - used;
    if (remaining <= 0) break;
    const clipped = text.slice(0, remaining);
    used += clipped.length;
    sources.push({
      source: sources.length + 1,
      id: match.chunkId || match.tableId || `source_${index + 1}`,
      pageNumber: match.pageNumber ?? null,
      chunkType: match.chunkType || match.type,
      confidence: match.confidence ?? null,
      extractionMethod: match.source,
      preview: clipped.slice(0, 260),
    });
    parts.push(
      `SOURCE ${sources.length} page=${match.pageNumber ?? "document"} chunkType=${match.chunkType || match.type} confidence=${match.confidence ?? "unknown"}\n${clipped}`,
    );
  }
  return { context: parts.join("\n\n"), sources };
}

async function callOllama({ model, messages, timeoutMs = pdfProcessingPolicy.intelligenceTimeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${pdfProcessingPolicy.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        options: { temperature: 0 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const payload = await response.json();
    return payload.message?.content || "";
  } finally {
    clearTimeout(timer);
  }
}

function fallbackAnswer({ analysis, intent, sources, matches }) {
  const summary = analysis?.summary || {};
  const lowConfidence = matches.some((match) => Number(match.confidence || 1) < 0.6);
  const overview = summary.detailedSummary || summary.long || summary.shortSummary || summary.short;
  if (intent === "document_explanation" && overview) {
    return {
      answer: [
        `What this PDF is about: ${summary.shortSummary || summary.short || overview}`,
        "",
        `Main purpose and structure: ${summary.detailedSummary || overview}`,
        "",
        `Key points: ${(summary.keyPoints || []).slice(0, 8).join("; ") || "Key points were not clearly extracted."}`,
        "",
        `Important tables/data: ${(summary.detectedTables || []).slice(0, 8).join("; ") || "No important tables were detected."}`,
      ].join("\n"),
      warnings: [
        "Local Ollama explanation model is offline or unavailable; returned stored extracted summaries instead.",
        ...(lowConfidence ? ["Some retrieved context has low OCR/extraction confidence."] : []),
      ],
      confidence: lowConfidence ? 0.55 : 0.68,
      sources,
    };
  }
  return {
    answer: matches.length
      ? "I found indexed PDF context, but the local Ollama model is unavailable. Review the cited snippets for the closest extracted evidence."
      : "The answer was not found in the indexed PDF content.",
    warnings: ["Local Ollama explanation model is offline or unavailable."],
    confidence: matches.length ? 0.45 : 0.2,
    sources,
  };
}

export async function answerPdfQuestion({ documentId, question, intent: explicitIntent, limit = 10 }) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) {
    return {
      answer: "No PDF uploaded.",
      status: "no_pdf_uploaded",
      confidence: 0,
      sources: [],
      warnings: [],
    };
  }

  const detected = detectPdfQueryIntent(question);
  const intent = explicitIntent || detected.intent;
  const readiness = getPdfReadiness(analysis, { pageNumber: detected.pageNumber });

  if (intent === "metric_question") {
    const realTables = (analysis.tables || []).filter(
      (table) =>
        table.tableType === "real_data_table" &&
        table.usableForAnalytics !== false &&
        table.usableForDataset !== false &&
        table.usableForDashboard !== false,
    );
    if (!realTables.length) {
      return {
        answer: "No analyzable metrics were found in this PDF. This PDF appears to contain text-based content, not a structured numeric dataset.",
        intent,
        status: readiness.status,
        confidence: 0.88,
        sources: [],
        warnings: ["Text-block tables are not used for metrics or charts."],
        readiness,
      };
    }
  }

  if (intent === "page_question" && detected.pageNumber) {
    const page = (analysis.pages || []).find((item) => Number(item.pageNumber) === Number(detected.pageNumber));
    if (page?.pageSummary) {
      return {
        answer: `Page ${detected.pageNumber} summary:\n${page.pageSummary}`,
        intent,
        status: readiness.status,
        confidence: page.confidence ?? 0.75,
        sources: [
          {
            source: 1,
            id: `${documentId}_page_${detected.pageNumber}_summary`,
            pageNumber: detected.pageNumber,
            chunkType: "page_summary",
            confidence: page.confidence ?? null,
            extractionMethod: page.extractionMethod || page.method,
            preview: String(page.pageSummary).slice(0, 260),
          },
        ],
        warnings: page.warnings || [],
        readiness,
        retrievalMode: "local-page-summary",
      };
    }
    const pageText = page?.cleanedText || page?.text || page?.mergedText;
    if (pageText) {
      return {
        answer: `Here is the summary of page ${detected.pageNumber} based on locally extracted text:\n${String(pageText).slice(0, 1400)}`,
        intent,
        status: readiness.status,
        confidence: page.confidence ?? 0.65,
        sources: [
          {
            source: 1,
            id: `${documentId}_page_${detected.pageNumber}_text`,
            pageNumber: detected.pageNumber,
            chunkType: "page_text",
            confidence: page.confidence ?? null,
            extractionMethod: page.extractionMethod || page.method,
            preview: String(pageText).slice(0, 260),
          },
        ],
        warnings: ["Answer generated from locally extracted text because vector index may still be building."],
        readiness,
        retrievalMode: "local-page-text",
      };
    }
    if (readiness.hasUploadedPdf && !readiness.canSummarizePage) {
      return getProcessingAnswer(analysis, readiness, {
        answer: `Page ${detected.pageNumber} is not extracted yet. ${readiness.processingMessage}`,
      });
    }
  }

  if (!readiness.canAskQuestions) {
    return getProcessingAnswer(analysis, readiness, {
      answer: "Your PDF is uploaded but still processing. Text extraction, summaries, or indexing are not query-ready yet.",
    });
  }

  const retrieval = await searchPdfChunks({
    documentId,
    query: question,
    intent,
    pageNumber: detected.pageNumber,
    limit: intent === "document_explanation" ? Math.max(limit, 14) : limit,
    minScore: 0.08,
  });

  let matches = retrieval.matches || [];
  if (intent === "document_explanation") {
    const directSummaryMatches = [];
    const summary = analysis.summary || {};
    const documentSummaryText = summary.detailedSummary || summary.long || summary.shortSummary || summary.short;
    if (documentSummaryText) {
      directSummaryMatches.push({
        chunkId: `${documentId}_document_summary_direct`,
        chunkType: "document_summary",
        type: "document_summary",
        pageNumber: null,
        text: documentSummaryText,
        confidence: analysis.quality?.overallScore ?? 0.75,
        source: "local_document_summary",
      });
    }
    for (const page of (analysis.pages || []).filter((item) => item.pageSummary).slice(0, 10)) {
      directSummaryMatches.push({
        chunkId: `${documentId}_page_${page.pageNumber}_summary_direct`,
        chunkType: "page_summary",
        type: "page_summary",
        pageNumber: page.pageNumber,
        text: page.pageSummary,
        confidence: page.confidence ?? 0.7,
        source: "local_page_summary",
      });
    }
    const summaryMatches = (analysis.chunks || []).filter((chunk) =>
      ["document_summary", "document_overview", "section_summary", "page_summary", "title_page"].includes(chunk.type || chunk.chunkType),
    );
    const byId = new Map();
    for (const match of [...directSummaryMatches, ...summaryMatches, ...matches]) {
      const id = match.chunkId || match.tableId;
      if (id && !byId.has(id)) {
        byId.set(id, {
          documentId,
          chunkId: id,
          chunkType: match.chunkType || match.type,
          type: match.type || match.chunkType,
          pageNumber: match.pageNumber,
          text: match.text,
          confidence: match.metadata?.confidence ?? match.confidence,
          source: match.metadata?.source || match.source,
        });
      }
    }
    matches = [...byId.values()].slice(0, Math.max(limit, 14));
  }

  const { context, sources } = buildPdfContext(matches);
  if (!context) {
    return {
      answer: "The answer was not found in the indexed PDF content.",
      intent,
      confidence: 0.1,
      sources: [],
      warnings: ["No indexed context matched the question."],
      model: pdfProcessingPolicy.explainerModel,
    };
  }

  const lowConfidence = matches.some((match) => Number(match.confidence || 1) < 0.6);
  try {
    const content = await callOllama({
      model: pdfProcessingPolicy.explainerModel,
      messages: [
        { role: "system", content: PDF_QA_SYSTEM_PROMPT },
        { role: "user", content: `For user query:\n${question}\n\nUse retrieved context:\n${context}\n\nAnswer with answer, confidence, sources, and warnings.` },
      ],
    });
    return {
      answer: content || "No answer generated.",
      intent,
      confidence: lowConfidence ? 0.62 : 0.82,
      sources,
      warnings: lowConfidence ? ["Some retrieved context has low OCR/extraction confidence."] : [],
      model: pdfProcessingPolicy.explainerModel,
      retrievalMode: retrieval.collection,
      rawPdfSentToLLM: false,
    };
  } catch {
    const fallback = fallbackAnswer({ analysis, intent, sources, matches });
    return {
      ...fallback,
      intent,
      model: pdfProcessingPolicy.explainerModel,
      retrievalMode: retrieval.collection,
      rawPdfSentToLLM: false,
    };
  }
}
