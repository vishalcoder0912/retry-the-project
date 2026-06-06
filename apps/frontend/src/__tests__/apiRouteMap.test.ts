import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { API_ROUTES } from "@/api/routes";
import { apiRequest } from "@/api/client";

describe("API route map", () => {
  it("keeps dashboard, PDF Intelligence, chat, analytics, and dataset routes separate", () => {
    expect(API_ROUTES.state).toBe("/api/state");
    expect(API_ROUTES.dashboard.action).toBe("/api/dashboard/action");
    expect(API_ROUTES.dashboard.chat).toBe("/api/dashboard/chat");
    expect(API_ROUTES.pdfIntelligence.upload).toBe("/api/pdf-intelligence/upload");
    expect(API_ROUTES.pdfIntelligence.query("pdf_1")).toBe("/api/pdf-intelligence/pdf_1/query");
    expect(API_ROUTES.copilotChat.analytics).toBe("/api/chat/analytics");
    expect(API_ROUTES.analytics.advanced).toBe("/api/analytics/advanced");
    expect(API_ROUTES.dataset.demo).toBe("/api/datasets/demo");
  });
});

describe("apiRequest", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs method and path before requesting", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest(API_ROUTES.state);

    expect(console.debug).toHaveBeenCalledWith("[API]", "GET", "/api/state");
    expect(fetchMock).toHaveBeenCalledWith("/api/state", expect.objectContaining({ headers: expect.any(Object) }));
  });
});
