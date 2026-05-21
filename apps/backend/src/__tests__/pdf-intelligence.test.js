import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { handlePdfRoutes } from "../routes/pdf.js";
import { makeRes } from "./test-helpers.js";

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
});
