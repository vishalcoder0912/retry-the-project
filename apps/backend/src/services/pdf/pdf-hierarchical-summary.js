import { buildPdfRagChunks } from "./pdf-rag-chunker.js";
import { pdfProcessingPolicy } from "./pdf-processing-policy.js";
import { savePdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";
import { indexPdfSummaries } from "./pdf-vector-store.js";

function trimForPrompt(text = "", max = 12000) {
  return String(text || "").trim().slice(0, max);
}

function chunkBatches(chunks = [], batchSize = pdfProcessingPolicy.processingBatchSize) {
  const size = Math.max(1, Number(batchSize || 1));
  const batches = [];
  for (let index = 0; index < chunks.length; index += size) {
    batches.push(chunks.slice(index, index + size));
  }
  return batches;
}

async function callSummaryModel(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), pdfProcessingPolicy.intelligenceTimeoutMs);
  try {
    const response = await fetch(`${pdfProcessingPolicy.ollamaBaseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: pdfProcessingPolicy.summarizerModel,
        stream: false,
        messages: [
          {
            role: "system",
            content:
              "Summarize only the provided PDF context. Preserve names, facts, dates, numbers, conclusions, and uncertainty. Do not add outside information.",
          },
          { role: "user", content: prompt },
        ],
        options: { temperature: 0.1 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama HTTP ${response.status}`);
    const payload = await response.json();
    return String(payload.message?.content || "").trim();
  } finally {
    clearTimeout(timer);
  }
}

function fallbackSummary(chunks = [], analysis = {}) {
  const firstText = chunks.map((chunk) => chunk.text).filter(Boolean).join("\n\n").slice(0, 1800);
  return {
    documentTitle: analysis.summary?.documentTitle || analysis.fileName || "PDF document",
    shortSummary: analysis.summary?.shortSummary || analysis.summary?.short || firstText || "Extracted PDF text is available, but a model summary was not generated.",
    detailedSummary: analysis.summary?.detailedSummary || analysis.summary?.long || firstText,
    keyPoints: analysis.summary?.keyPoints || [],
    summaryType: "document_summary",
    generatedBy: "local_fallback",
    model: null,
  };
}

export async function buildHierarchicalPdfSummary(analysis = {}) {
  const documentId = analysis.documentId || analysis.id;
  if (!documentId) return analysis.summary || {};

  const existing = analysis.summary || {};
  if (existing.detailedSummary || existing.long) return existing;

  const chunks = buildPdfRagChunks(analysis).filter((chunk) => ["page_text", "ocr_text", "page_summary", "table_summary"].includes(chunk.chunkType));
  if (!chunks.length) return existing;

  try {
    const batchSummaries = [];
    for (const [index, batch] of chunkBatches(chunks).entries()) {
      const context = batch
        .map((chunk) => `Page ${chunk.pageNumber ?? "document"} ${chunk.chunkType}\n${trimForPrompt(chunk.text, 3500)}`)
        .join("\n\n");
      const summary = await callSummaryModel(`Summarize this PDF chunk batch ${index + 1}. Keep exact facts and numbers.\n\n${trimForPrompt(context)}`);
      if (summary) batchSummaries.push(summary);
    }

    const finalSummaryText = await callSummaryModel(
      `Combine these batch summaries into a concise document summary with key points. Do not add outside information.\n\n${trimForPrompt(batchSummaries.join("\n\n"), pdfProcessingPolicy.contextMaxChars)}`,
    );

    const summary = {
      ...existing,
      shortSummary: existing.shortSummary || finalSummaryText.split(/\n+/)[0]?.slice(0, 500) || finalSummaryText.slice(0, 500),
      detailedSummary: finalSummaryText,
      keyPoints: existing.keyPoints || [],
      summaryType: "document_summary",
      generatedBy: "hierarchical_pdf_summary",
      model: pdfProcessingPolicy.summarizerModel,
      batchSummaryCount: batchSummaries.length,
      updatedAt: new Date().toISOString(),
    };
    const updated = savePdfIntelligenceAnalysis(documentId, {
      ...analysis,
      summary,
      chunks: buildPdfRagChunks({ ...analysis, summary }),
    });
    await indexPdfSummaries(updated);
    return summary;
  } catch {
    const summary = fallbackSummary(chunks, analysis);
    savePdfIntelligenceAnalysis(documentId, {
      ...analysis,
      summary,
      chunks: buildPdfRagChunks({ ...analysis, summary }),
    });
    return summary;
  }
}

export default {
  buildHierarchicalPdfSummary,
};
