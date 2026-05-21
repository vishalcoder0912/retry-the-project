import { describe, expect, it } from "vitest";
import { handleSchemaTrainedAIRoutes } from "../routes/schema-trained-ai.routes.js";
import { makeReq, makeRes, salaryDataset } from "./test-helpers.js";

async function callRoute(pathname, body) {
  const response = makeRes();
  const handled = await handleSchemaTrainedAIRoutes(makeReq("POST", body), response, pathname);
  return { handled, response, payload: response.json() };
}

describe("schema-trained AI routes", () => {
  it("generates a schema-only dashboard plan without raw rows or chart data", async () => {
    const { handled, payload } = await callRoute("/api/datasets/test-local/schema-dashboard", {
      ...salaryDataset,
      useLlm: false,
    });

    expect(handled).toBe(true);
    expect(payload.success).toBe(true);
    expect(payload.data.schemaOnly).toBe(true);
    expect(payload.data.profile).toBeTruthy();
    expect(payload.data.dashboardPlan.kpis).toBeInstanceOf(Array);
    expect(payload.data.dashboardPlan.charts).toBeInstanceOf(Array);
    for (const chart of payload.data.dashboardPlan.charts) {
      expect(chart).not.toHaveProperty("data");
    }
    for (const chart of payload.data.dashboard.charts) {
      expect(chart).not.toHaveProperty("data");
    }
    expect(JSON.stringify(payload)).not.toContain("\"rows\"");
  });

  it("routes a valid dashboard command to a safe chart spec", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/dashboard-command", {
      ...salaryDataset,
      query: "show average salary_usd by country as bar chart",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      action: "GENERATE_CHART",
      schemaOnly: true,
      chartSpec: {
        type: "bar",
        xKey: "country",
        yKey: "salary_usd",
        aggregation: "avg",
      },
    });
    expect(payload.data.chartSpec).not.toHaveProperty("data");
  });

  it("handles invalid scatter conversion safely", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/dashboard-command", {
      ...salaryDataset,
      query: "convert country pie chart to scatter",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    if (payload.data.chartSpec) {
      expect(payload.data.chartSpec.type).not.toBe("scatter");
    } else {
      expect(payload.data.action).toBe("ANSWER");
    }
  });

  it("answers schema chat without fake KPI values or raw row packet", async () => {
    const { payload } = await callRoute("/api/datasets/test-local/schema-chat", {
      ...salaryDataset,
      query: "Explain this dataset",
      useLlm: false,
    });

    expect(payload.success).toBe(true);
    expect(payload.data.assistantMessage.content).toContain("Salary Small contains 3 rows");
    expect(payload.data.assistantMessage.schemaOnly).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("\"rows\"");
    expect(payload.data.assistantMessage.content).not.toContain("57500");
  });
});
