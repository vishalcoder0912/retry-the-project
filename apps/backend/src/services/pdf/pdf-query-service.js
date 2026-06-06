import { getPdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";
import { detectPdfQueryIntent, searchPdfChunks } from "./pdf-vector-store.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";
import { getPdfReadiness, getProcessingAnswer } from "./pdf-readiness.js";

const PDF_QA_SYSTEM_PROMPT =
  `You are InsightFlow PDF Intelligence.

Answer the user using ONLY the provided PDF context.
Do not invent facts.
Do not use outside knowledge.
If the answer is not present in the PDF context, say:
"I could not find this information in the uploaded PDF."

Rules:
* Give a direct answer first.
* Then explain clearly.
* Use simple language.
* Mention page/source numbers when available.
* For summaries, organize the answer into key points.
* For tables/numbers, preserve exact values from the PDF context.
* Never claim you read pages that are not included in the provided sources.
* If OCR or extraction quality is low, mention uncertainty.`;

function getSummaryText(analysis = {}) {
  const summary = analysis.summary || {};
  return [
    summary.documentTitle ? `Title: ${summary.documentTitle}` : "",
    summary.shortSummary || summary.short || "",
    summary.detailedSummary || summary.long || "",
    Array.isArray(summary.keyPoints) && summary.keyPoints.length ? `Key points:\n${summary.keyPoints.map((item) => `- ${item}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function isWholePdfIntent(intent) {
  return ["document_summary", "explain_pdf", "document_explanation"].includes(intent);
}

export function buildPdfContext(matches = [], maxChars = pdfProcessingPolicy.contextMaxChars, analysis = null, intent = "") {
  let used = 0;
  const sources = [];
  const parts = [];

  if (analysis && pdfProcessingPolicy.includeDocumentSummary && isWholePdfIntent(intent)) {
    const summaryText = getSummaryText(analysis);
    if (summaryText) {
      const clipped = summaryText.slice(0, Math.min(maxChars, Math.max(0, Math.floor(maxChars * 0.35))));
      used += clipped.length;
      sources.push({
        source: sources.length + 1,
        id: `${analysis.documentId || analysis.id}_document_summary`,
        chunkId: `${analysis.documentId || analysis.id}_document_summary`,
        pageNumber: null,
        chunkType: "document_summary",
        confidence: analysis.quality?.overallScore ?? null,
        extractionMethod: "stored_document_summary",
        preview: clipped.slice(0, 260),
        score: 1,
      });
      parts.push(`SOURCE ${sources.length} page=document chunkType=document_summary confidence=${analysis.quality?.overallScore ?? "unknown"}\n${clipped}`);
    }
  }

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
      chunkId: match.chunkId || match.tableId || `source_${index + 1}`,
      pageNumber: match.pageNumber ?? null,
      chunkType: match.chunkType || match.type,
      confidence: match.confidence ?? null,
      extractionMethod: match.source,
      preview: clipped.slice(0, 260),
      score: typeof match.score === "number" ? Number(match.score.toFixed(4)) : undefined,
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
  if (isWholePdfIntent(intent) && overview) {
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
        "Local AI model is not responding. Answer returned from stored PDF summary.",
        ...(lowConfidence ? ["Some retrieved context has low OCR/extraction confidence."] : []),
      ],
      confidence: lowConfidence ? 0.55 : 0.68,
      sources,
    };
  }
  return {
    answer: matches.length
      ? "Local AI model is not responding. I found relevant extracted PDF snippets; review the cited sources for the closest evidence."
      : overview
        ? `Local AI model is not responding. Stored PDF summary: ${overview}`
        : "I could not find this information in the uploaded PDF.",
    warnings: ["Local AI model is not responding."],
    confidence: matches.length ? 0.45 : 0.2,
    sources,
  };
}

function ocrNeededWarning(analysis = {}, readiness = {}) {
  const warnings = analysis.quality?.warnings || [];
  const weakText = !readiness.hasPageText && !readiness.hasDocumentSummary;
  const ocrRecommended = warnings.some((warning) => /ocr|scanned|image|weak text|low text/i.test(String(warning)));
  return weakText || ocrRecommended ? "This PDF may need OCR for better answers. Please run Force OCR and Re-index." : null;
}

export async function answerPdfQuestion({ documentId, query, question, intent: explicitIntent, limit }) {
  const userQuery = String(query || question || "").trim();
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) {
    return {
      answer: "I could not find this PDF document. Please upload it again.",
      status: "pdf_not_found",
      confidence: 0,
      sources: [],
      warnings: [],
      model: pdfProcessingPolicy.explainerModel,
      intent: explicitIntent || "general_pdf_question",
      contextUsed: {
        retrievedChunks: 0,
        usedDocumentSummary: false,
        maxChars: pdfProcessingPolicy.contextMaxChars,
      },
    };
  }

  const detected = detectPdfQueryIntent(userQuery);
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
    const warning = ocrNeededWarning(analysis, readiness);
    return getProcessingAnswer(analysis, readiness, {
      answer: "Your PDF is uploaded but still processing. Text extraction, summaries, or indexing are not query-ready yet.",
      warnings: warning ? [warning] : [],
    });
  }

  const topK = Math.max(1, Number(limit || pdfProcessingPolicy.queryTopK || 14));
  const retrieval = await searchPdfChunks({
    documentId,
    query: userQuery,
    intent,
    pageNumber: detected.pageNumber,
    limit: isWholePdfIntent(intent) ? Math.max(topK, pdfProcessingPolicy.queryTopK) : topK,
    minScore: 0.08,
  });

  let matches = retrieval.matches || [];
  if (isWholePdfIntent(intent)) {
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

  const { context, sources } = buildPdfContext(matches, pdfProcessingPolicy.contextMaxChars, analysis, intent);
  if (!context) {
    const warning = ocrNeededWarning(analysis, readiness);
    return {
      answer: warning || "I could not find this information in the uploaded PDF.",
      intent,
      confidence: 0.1,
      sources: [],
      warnings: ["No relevant PDF chunks matched the question.", ...(warning ? [warning] : [])],
      model: pdfProcessingPolicy.explainerModel,
      contextUsed: {
        retrievedChunks: 0,
        usedDocumentSummary: false,
        maxChars: pdfProcessingPolicy.contextMaxChars,
      },
    };
  }

  const lowConfidence = matches.some((match) => Number(match.confidence || 1) < 0.6);
  const fallbackWarning = retrieval.fallback
    ? "Answer generated from locally extracted PDF text because vector index is not ready."
    : null;
  const ocrWarning = ocrNeededWarning(analysis, readiness);
  try {
    const content = await callOllama({
      model: pdfProcessingPolicy.explainerModel,
      messages: [
        { role: "system", content: PDF_QA_SYSTEM_PROMPT },
        {
          role: "user",
          content: `User question:\n${userQuery}\n\nPDF context:\n${context}\n\nReturn a helpful answer grounded only in these sources.`,
        },
      ],
    });
    return {
      answer: content || "No answer generated.",
      intent,
      confidence: lowConfidence ? 0.62 : 0.82,
      sources,
      warnings: [
        ...(fallbackWarning ? [fallbackWarning] : []),
        ...(lowConfidence ? ["Some retrieved context has low OCR/extraction confidence."] : []),
        ...(ocrWarning ? [ocrWarning] : []),
      ],
      model: pdfProcessingPolicy.explainerModel,
      retrievalMode: retrieval.collection,
      rawPdfSentToLLM: false,
      contextUsed: {
        retrievedChunks: matches.length,
        usedDocumentSummary: sources.some((source) => source.chunkType === "document_summary"),
        maxChars: pdfProcessingPolicy.contextMaxChars,
      },
    };
  } catch {
    const fallback = fallbackAnswer({ analysis, intent, sources, matches });
    return {
      ...fallback,
      intent,
      model: pdfProcessingPolicy.explainerModel,
      retrievalMode: retrieval.collection,
      rawPdfSentToLLM: false,
      contextUsed: {
        retrievedChunks: matches.length,
        usedDocumentSummary: sources.some((source) => source.chunkType === "document_summary"),
        maxChars: pdfProcessingPolicy.contextMaxChars,
      },
    };
  }
}
