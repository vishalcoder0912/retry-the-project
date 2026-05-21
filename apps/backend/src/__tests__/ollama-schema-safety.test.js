import { afterEach, describe, expect, it, vi } from "vitest";
import { generateSchemaDashboard } from "../services/ai-analyst/schema-trained-ai-service.js";
import { sentinelDataset } from "./test-helpers.js";

describe("Ollama schema-only safety", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends schema only to Ollama and strips malicious chart.data responses", async () => {
    let requestBody = "";
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      requestBody = String(init?.body || "");
      return {
        ok: true,
        json: async () => ({
          message: {
            content: JSON.stringify({
              action: "GENERATE_DASHBOARD",
              message: "Dashboard plan generated",
              schemaOnly: true,
              kpis: [
                { title: "Total Records", metric: "__row_count__", aggregation: "count", format: "number" },
              ],
              charts: [
                {
                  type: "bar",
                  title: "Unsafe",
                  xKey: "country",
                  yKey: "salary_usd",
                  aggregation: "avg",
                  data: [{ country: "India", value: 12345 }],
                },
              ],
            }),
          },
        }),
      };
    }));

    const result = await generateSchemaDashboard(sentinelDataset, { useLlm: true, threshold: 1 });

    expect(requestBody).not.toContain("SECRET_RAW_ROW_SHOULD_NEVER_REACH_LLM");
    expect(requestBody).toContain("schemaProfile");
    expect(requestBody).toContain("salary_usd");
    expect(JSON.stringify(result)).not.toContain("\"data\"");
    expect(result.dashboardPlan.charts.some((chart) => chart.title === "Average Salary by Country")).toBe(true);
    expect(result.dashboardPlan.charts.some((chart) => chart.title === "Unsafe")).toBe(false);
    expect(result.llm?.provider).toBe("ollama");
  });

  it("falls back to local dashboard plan when Ollama is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Ollama unavailable");
    }));

    const result = await generateSchemaDashboard(sentinelDataset, { useLlm: true, threshold: 1 });

    expect(result.dashboardPlan.kpis.length).toBeGreaterThan(0);
    expect(result.dashboardPlan.charts.length).toBeGreaterThan(0);
    expect(result.provider).toBe("local");
    expect(result.llm?.source).toBe("ollama-error");
  });
});
