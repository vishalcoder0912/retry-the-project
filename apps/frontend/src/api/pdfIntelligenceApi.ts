import { apiRequest } from "@/api/client";
import { API_ROUTES } from "@/api/routes";

export function uploadPdfIntelligence<T>(file: File) {
  const body = new FormData();
  body.append("file", file);
  return apiRequest<T>(API_ROUTES.pdfIntelligence.upload, {
    method: "POST",
    body,
  });
}

export function getPdfIntelligenceStatus<T>(documentId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.status(documentId));
}

export function queryPdfIntelligence<T>(documentId: string, query: string, intent?: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.query(documentId), {
    method: "POST",
    body: JSON.stringify({ query, intent }),
  });
}

export function reindexPdfIntelligence<T>(documentId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.reindex(documentId), {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export function forceOcrPdfIntelligence<T>(documentId: string) {
  return apiRequest<T>(API_ROUTES.pdfIntelligence.forceOcr(documentId), {
    method: "POST",
    body: JSON.stringify({}),
  });
}
