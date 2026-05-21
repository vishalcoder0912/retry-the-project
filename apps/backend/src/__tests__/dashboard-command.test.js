import { describe, expect, it } from "vitest";
import { runDashboardCommand } from "../services/ai-analyst/schema-trained-ai-service.js";
import { salaryDataset } from "./test-helpers.js";

describe("dashboard command service", () => {
  it("creates schema-only KPI commands without local KPI values", async () => {
    const result = await runDashboardCommand({
      dataset: salaryDataset,
      query: "add KPI for highest salary_usd",
      useLlm: false,
    });

    expect(result.action).toBe("GENERATE_KPI");
    expect(result.kpiSpec).toMatchObject({ metric: "salary_usd", aggregation: "max" });
    expect(result.kpiSpec).not.toHaveProperty("value");
    expect(result.schemaOnly).toBe(true);
  });
});
