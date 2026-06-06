function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePipelineKey(type = "") {
  const map = {
    "pdf.preview": "preview",
    "pdf.extractText": "textExtraction",
    "pdf.clean": "cleaning",
    "pdf.chunk": "chunking",
    "pdf.index": "indexing",
    "pdf.extractTables": "tables",
    "pdf.summarize": "summary",
    "pdf.visualize": "visualizations",
    "pdf.ocr": "ocr",
  };
  return map[type] || type.replace(/^pdf\./, "");
}

export function getActivePdfPipelines(analysis = {}) {
  const pipelineStatus = analysis.pipelineStatus || {};
  return Object.entries(pipelineStatus)
    .filter(([, value]) => ["queued", "running"].includes(value?.status))
    .map(([type, value]) => ({
      type,
      name: normalizePipelineKey(type),
      status: value.status,
      progress: value.progress ?? 0,
      currentPage: value.currentPage ?? null,
      totalPages: value.totalPages ?? null,
    }));
}

export function getPdfReadiness(analysis = {}, options = {}) {
  const pages = Array.isArray(analysis.pages) ? analysis.pages : [];
  const tables = Array.isArray(analysis.tables) ? analysis.tables : [];
  const chunks = Array.isArray(analysis.chunks) ? analysis.chunks : [];
  const summary = analysis.summary || {};
  const requestedPageNumber = options.pageNumber ? Number(options.pageNumber) : null;
  const requestedPage = requestedPageNumber
    ? pages.find((page) => Number(page.pageNumber) === requestedPageNumber)
    : null;

  const hasUploadedPdf = Boolean(analysis.documentId || analysis.id);
  const pagesWithText = pages.filter((page) => hasText(page.cleanedText) || hasText(page.text) || hasText(page.mergedText));
  const pageSummaries = pages.filter((page) => hasText(page.pageSummary));
  const hasPageText = pagesWithText.length > 0;
  const hasDocumentSummary = hasText(summary.detailedSummary) || hasText(summary.shortSummary) || hasText(summary.long) || hasText(summary.short);
  const hasPageSummaries = pageSummaries.length > 0;
  const hasSummary = hasDocumentSummary || hasPageSummaries;
  const hasVectorIndex = Boolean(
    analysis.vectorIndex?.success ||
      analysis.vectorIndex?.chunks?.indexed > 0 ||
      analysis.vectorIndex?.summaries?.indexed > 0 ||
      chunks.some((chunk) => chunk.vectorId || chunk.indexedAt),
  );
  const realTables = tables.filter(
    (table) =>
      table.tableType === "real_data_table" &&
      table.usableForAnalytics !== false &&
      table.usableForDataset !== false &&
      table.usableForDashboard !== false,
  );
  const hasTables = tables.length > 0;
  const hasMetrics = realTables.length > 0;
  const requestedPageReady = requestedPage
    ? hasText(requestedPage.pageSummary) || hasText(requestedPage.cleanedText) || hasText(requestedPage.text) || hasText(requestedPage.mergedText)
    : false;
  const activePipelines = getActivePdfPipelines(analysis);
  const status = analysis.status || (activePipelines.length ? "processing" : hasUploadedPdf ? "uploaded" : "no_pdf_uploaded");
  const processing = activePipelines.length > 0 || ["uploaded", "previewing", "text_extracted", "indexed", "tables_extracted", "partially_completed"].includes(status);

  const canAskQuestions = hasUploadedPdf && (hasVectorIndex || hasSummary || hasPageText);
  const canExplainPdf = hasUploadedPdf && (hasSummary || hasPageText);
  const canSummarizePage = hasUploadedPdf && (requestedPageNumber ? requestedPageReady : hasPageText || hasPageSummaries);
  const canShowMetrics = hasUploadedPdf && hasMetrics;

  let readinessState = "uploaded";
  if (!hasUploadedPdf) readinessState = "no_pdf_uploaded";
  else if (hasVectorIndex && canAskQuestions) readinessState = "query_ready";
  else if (canAskQuestions) readinessState = "partially_query_ready";
  else if (activePipelines.some((pipeline) => pipeline.name === "indexing")) readinessState = "indexing_running";
  else if (activePipelines.some((pipeline) => pipeline.name === "summary")) readinessState = "summary_running";
  else if (hasSummary) readinessState = "summary_ready";
  else if (hasPageText) readinessState = "page_text_ready";
  else if (activePipelines.some((pipeline) => pipeline.name === "textExtraction")) readinessState = "text_extraction_running";
  else if (activePipelines.some((pipeline) => pipeline.name === "preview")) readinessState = "uploaded";
  else if (status === "failed") readinessState = "failed";

  const activeNames = activePipelines.map((pipeline) => pipeline.name);
  const processingMessage = hasUploadedPdf
    ? canAskQuestions
      ? hasVectorIndex
        ? "PDF query index is ready."
        : "PDF is partially ready. Answers can use locally extracted text or summaries while vector indexing continues."
      : `Your PDF is uploaded but still processing. ${activeNames.length ? `Current pipeline: ${activeNames.join(", ")}.` : "Text extraction has not produced query-ready content yet."}`
    : "No PDF uploaded.";

  return {
    documentId: analysis.documentId || analysis.id || null,
    status: readinessState,
    hasUploadedPdf,
    hasPageText,
    hasDocumentSummary,
    hasPageSummaries,
    hasVectorIndex,
    hasTables,
    hasRealDataTables: hasMetrics,
    canAskQuestions,
    canExplainPdf,
    canSummarizePage,
    canShowMetrics,
    processingMessage,
    activePipelines,
    progress: analysis.progress ?? (canAskQuestions ? 80 : 0),
    extractedPageCount: pagesWithText.length,
    summarizedPageCount: pageSummaries.length,
    realTableCount: realTables.length,
    isProcessing: processing && !hasVectorIndex,
  };
}

export function getProcessingAnswer(analysis = {}, readiness = getPdfReadiness(analysis), override = {}) {
  return {
    answer: override.answer || readiness.processingMessage,
    status: "processing",
    canRetry: true,
    activePipelines: readiness.activePipelines,
    progress: readiness.progress,
    readiness,
    sources: [],
    warnings: override.warnings || [],
  };
}

