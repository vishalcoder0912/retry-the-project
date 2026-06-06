import { answerPdfQuestion } from "./pdf-query-service.js";
import { getPdfIntelligenceAnalysis } from "./pdf-intelligence-store.js";
import { getPdfReadiness, getProcessingAnswer } from "./pdf-readiness.js";

export async function explainPdfDocument({ documentId }) {
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
  const readiness = getPdfReadiness(analysis);
  if (!readiness.canExplainPdf) {
    return getProcessingAnswer(analysis, readiness, {
      answer: "PDF uploaded. Text extraction is still running. Explanation will be available after page text or summaries are ready.",
    });
  }
  return answerPdfQuestion({
    documentId,
    question: "explain the PDF",
    intent: "document_explanation",
    limit: 16,
  });
}

export default {
  explainPdfDocument,
};
