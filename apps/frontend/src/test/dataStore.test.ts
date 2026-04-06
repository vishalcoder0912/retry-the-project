import { describe, expect, it } from "vitest";
import { Dataset, generateDemoCharts, generateDemoKPIs } from "@/features/data/model/dataStore";

describe("dataStore dashboard helpers", () => {
  it("builds charts for arbitrary uploaded datasets without demo-only columns", () => {
    const dataset: Dataset = {
      id: "custom-1",
      name: "Regional Sales",
      uploadedAt: new Date("2026-04-06T00:00:00.000Z"),
      rowCount: 3,
      columns: [
        { name: "country", type: "string", sample: ["India", "USA"] },
        { name: "sales", type: "number", sample: ["100", "200"] },
        { name: "orders", type: "number", sample: ["4", "7"] },
      ],
      rows: [
        { country: "India", sales: 100, orders: 4 },
        { country: "USA", sales: 200, orders: 7 },
        { country: "India", sales: 150, orders: 5 },
      ],
    };

    expect(() => generateDemoCharts(dataset)).not.toThrow();
    expect(() => generateDemoKPIs(dataset)).not.toThrow();

    const charts = generateDemoCharts(dataset);
    expect(charts.length).toBeGreaterThan(0);
    expect(charts[0].data.length).toBeGreaterThan(0);
  });

  it("returns stable output for an empty dataset", () => {
    const dataset: Dataset = {
      id: "empty-1",
      name: "Empty Dataset",
      uploadedAt: new Date("2026-04-06T00:00:00.000Z"),
      rowCount: 0,
      columns: [{ name: "score", type: "number", sample: [] }],
      rows: [],
    };

    expect(() => generateDemoKPIs(dataset)).not.toThrow();
    expect(() => generateDemoCharts(dataset)).not.toThrow();
    expect(generateDemoCharts(dataset)).toEqual([]);
  });
});
