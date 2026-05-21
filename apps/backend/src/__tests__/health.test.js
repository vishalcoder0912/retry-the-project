import { describe, expect, it } from "vitest";
import { handleHealthRoutes } from "../routes/health.js";
import { makeReq, makeRes } from "./test-helpers.js";

describe("health API", () => {
  it("GET /api/health returns healthy quickly", async () => {
    const started = performance.now();
    const response = makeRes();

    const handled = await handleHealthRoutes(makeReq("GET"), response, "/api/health");
    const duration = performance.now() - started;

    expect(handled).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("healthy");
    expect(duration).toBeLessThan(250);
  });
});
