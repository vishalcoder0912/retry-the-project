function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function getPdfReadiness(analysis = {}) {
  const pages = analysis.pages || [];
  const chunks = analysis.chunks || [];
  const summary = analysis.summary || {};
  const hasPageText = pages.some((page) => hasText(page.cleanedText) || hasText(page.text) || hasText(page.mergedText));
  const hasChunks = chunks.some((chunk) => hasText(chunk.text) || hasText(chunk.content));
  const hasDocumentSummary = hasText(summary.shortSummary) || hasText(summary.short) || hasText(summary.detailedSummary) || hasText(summary.long);
  const hasVectorIndex = Boolean(analysis.vectorIndex?.success || analysis.vectorIndex?.chunks?.indexed > 0);
  const canAskQuestions = Boolean(analysis.documentId && (hasVectorIndex || hasChunks || hasPageText || hasDocumentSummary));
  return {
    documentId: analysis.documentId || null,
    status: hasVectorIndex ? "query_ready" : canAskQuestions ? "partially_query_ready" : analysis.status === "failed" ? "failed" : "processing",
    hasUploadedPdf: Boolean(analysis.documentId),
    hasText: hasPageText,
    hasPageText,
    hasChunks,
    hasVectorIndex,
    hasDocumentSummary,
    hasTables: Boolean(analysis.tables?.length),
    canAskQuestions,
    canExplainPdf: Boolean(analysis.documentId && (hasDocumentSummary || hasPageText || hasChunks)),
    canUseVectorSearch: hasVectorIndex,
    canUseLocalFallback: hasPageText || hasChunks || hasDocumentSummary,
    canSummarizePage: hasPageText || pages.some((page) => hasText(page.pageSummary)),
    canShowMetrics: Boolean((analysis.tables || []).some((table) => table.tableType !== "text_block_table")),
    processingMessage: canAskQuestions
      ? hasVectorIndex
        ? "PDF query index is ready."
        : "PDF is processing. I can answer from available extracted text if ready."
      : "Your PDF is uploaded but still processing. Text extraction has not produced query-ready content yet.",
    progress: analysis.progress ?? (canAskQuestions ? 80 : 0),
  };
}

export function getProcessingAnswer(analysis = {}, readiness = getPdfReadiness(analysis), override = {}) {
  return { answer: override.answer || readiness.processingMessage, status: "processing", canRetry: true, readiness, sources: [], warnings: override.warnings || [] };
}
