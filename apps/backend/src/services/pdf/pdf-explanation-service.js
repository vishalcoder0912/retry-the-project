import { answerPdfQuestion } from "./pdf-query-service.js";
import { getPdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";
import { getPdfReadiness, getProcessingAnswer } from "./pdf-readiness.js";

export async function explainPdfDocument({ documentId }) {
  const analysis = getPdfIntelligenceAnalysis(documentId);
  if (!analysis) {
    return {
      answer: "I could not find this PDF document. Please upload it again.",
      status: "pdf_not_found",
      confidence: 0,
      sources: [],
      warnings: [],
    };
  }
  const readiness = getPdfReadiness(analysis);
  if (!readiness.canExplainPdf) {
    return getProcessingAnswer(analysis, readiness, {
      answer: "PDF uploaded. Text extraction is still running. Explanation will be available after page text or summaries are ready.",
    });
  }
  return answerPdfQuestion({
    documentId,
    query: "explain the PDF",
    intent: "explain_pdf",
  });
}

export default {
  explainPdfDocument,
};
