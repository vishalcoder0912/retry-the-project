import { describe, expect, it } from "vitest";
import { buildSchemaProfile } from "../services/ai-analyst/schema-fingerprint.js";
import {
  buildRuleDashboardPlan,
  sanitizeChartSpec,
} from "../services/ai-analyst/dashboard-plan-engine.js";
import { validateChartCombination } from "../services/ai-analyst/dashboard-quality-guardian.js";
import { salaryDataset } from "./test-helpers.js";

describe("dashboard plan engine", () => {
  const profile = buildSchemaProfile(salaryDataset);

  it("generates KPI and chart specs from schema only", () => {
    const plan = buildRuleDashboardPlan(profile);
    const titles = [...plan.kpis, ...plan.charts].map((item) => item.title);

    expect(titles).toContain("Total Records");
    expect(plan.kpis.some((kpi) => kpi.metric === "salary_usd")).toBe(true);
    expect(plan.charts).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "bar", xKey: "country", yKey: "salary_usd", aggregation: "avg" }),
      expect.objectContaining({ type: "histogram", xKey: "salary_usd" }),
      expect.objectContaining({ type: "scatter" }),
    ]));
    expect(JSON.stringify(plan)).not.toContain("\"data\"");
  });

  it("rejects invalid scatter and unknown columns", () => {
    expect(validateChartCombination(
      profile,
      { type: "scatter", title: "Bad", xKey: "country", yKey: "salary_usd", aggregation: "count" }
    ).ok).toBe(false);

    expect(validateChartCombination(
      profile,
      { type: "bar", title: "Missing", xKey: "missing", yKey: "salary_usd", aggregation: "avg" }
    ).ok).toBe(false);
  });

  it("removes chart.data from sanitized chart specs", () => {
    const spec = sanitizeChartSpec({
      type: "bar",
      title: "Unsafe",
      xKey: "country",
      yKey: "salary_usd",
      aggregation: "avg",
      data: [{ country: "India", value: 12345 }],
    }, profile);

    expect(spec).not.toHaveProperty("data");
  });
});
