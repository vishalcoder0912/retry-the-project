export const API_ROUTES = {
  state: "/api/state",

  dataset: {
    upload: "/api/datasets/upload",
    import: "/api/datasets/import",
    active: "/api/datasets/active",
    demo: "/api/datasets/demo",
    schema: (datasetId: string) => `/api/datasets/${datasetId}/schema`,
  },

  dashboard: {
    state: "/api/dashboard/state",
    analyze: "/api/dashboard/analyze",
    action: "/api/dashboard/action",
    chat: "/api/dashboard/chat",
  },

  pdfIntelligence: {
    upload: "/api/pdf-intelligence/upload",
    status: (documentId: string) => `/api/pdf-intelligence/${documentId}/status`,
    query: (documentId: string) => `/api/pdf-intelligence/${documentId}/query`,
    reindex: (documentId: string) => `/api/pdf-intelligence/${documentId}/reindex`,
    forceOcr: (documentId: string) => `/api/pdf-intelligence/${documentId}/force-ocr`,
  },

  copilotChat: {
    analytics: "/api/chat/analytics",
  },

  analytics: {
    advanced: "/api/analytics/advanced",
  },
} as const;
