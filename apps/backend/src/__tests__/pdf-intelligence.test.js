import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { handlePdfRoutes } from "../routes/pdf.js";
import { makeRes } from "./test-helpers.js";
import { detectPdfQueryIntent } from "../services/pdf/pdf-vector-store.js";
import { getPdfReadiness } from "../services/pdf/pdf-readiness.js";

describe("PDF intelligence route surface", () => {
  it("returns a safe validation error when asking an unknown PDF knowledge base", async () => {
    const request = Readable.from([JSON.stringify({ query: "What revenue is shown?" })]);
    request.method = "POST";
    request.headers = { "content-type": "application/json" };
    const response = makeRes();
    const handled = await handlePdfRoutes(request, response, "/api/pdf/missing/ask");
    const payload = response.json();

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(404);
    expect(payload.success).toBe(false);
    expect(payload.error.message).toMatch(/not found/i);
  });

  it("classifies overview and table questions for intent-aware retrieval", () => {
    expect(detectPdfQueryIntent("explain the PDF").intent).toBe("document_explanation");
    expect(detectPdfQueryIntent("what is this document about").intent).toBe("document_explanation");
    expect(detectPdfQueryIntent("list all tables").intent).toBe("table_question");
    expect(detectPdfQueryIntent("summarize page 1")).toMatchObject({ intent: "page_question", pageNumber: 1 });
  });

  it("computes processing readiness for an uploaded PDF without extracted text", () => {
    const readiness = getPdfReadiness({
      documentId: "pdf_processing",
      status: "uploaded",
      pipelineStatus: {
        "pdf.extractText": { status: "running", progress: 30 },
      },
      pages: [],
      tables: [],
      chunks: [],
      summary: {},
    });

    expect(readiness.hasUploadedPdf).toBe(true);
    expect(readiness.canAskQuestions).toBe(false);
    expect(readiness.status).toBe("text_extraction_running");
    expect(readiness.processingMessage).toMatch(/still processing/i);
  });

  it("allows partial query readiness when page text exists before vector indexing", () => {
    const readiness = getPdfReadiness({
      documentId: "pdf_partial",
      status: "text_extracted",
      pipelineStatus: {
        "pdf.index": { status: "running", progress: 20 },
      },
      pages: [{ pageNumber: 1, cleanedText: "Page one extracted text." }],
      tables: [],
      chunks: [],
      summary: {},
    });

    expect(readiness.canAskQuestions).toBe(true);
    expect(readiness.canSummarizePage).toBe(true);
    expect(readiness.hasVectorIndex).toBe(false);
    expect(readiness.status).toBe("partially_query_ready");
  });
});
