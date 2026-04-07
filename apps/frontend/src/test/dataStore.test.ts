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

  it("builds pie charts from counts when uploaded data only has non-additive numeric metrics", () => {
    const dataset: Dataset = {
      id: "survey-1",
      name: "Customer Survey",
      uploadedAt: new Date("2026-04-06T00:00:00.000Z"),
      rowCount: 4,
      columns: [
        { name: "team", type: "string", sample: ["A", "B"] },
        { name: "region", type: "string", sample: ["North", "South"] },
        { name: "rating", type: "number", sample: ["4.5", "3.8"] },
      ],
      rows: [
        { team: "A", region: "North", rating: 4.5 },
        { team: "A", region: "North", rating: 4.2 },
        { team: "B", region: "South", rating: 3.8 },
        { team: "C", region: "North", rating: 4.9 },
      ],
    };

    const charts = generateDemoCharts(dataset);
    const pieChart = charts.find((chart) => chart.type === "pie");

    expect(pieChart).toBeDefined();
    expect(pieChart?.title).toBe("Count by Team");
    expect(pieChart?.yKey).toBe("count");
    expect(pieChart?.data).toEqual([
      { team: "A", count: 2 },
      { team: "B", count: 1 },
      { team: "C", count: 1 },
    ]);
  });

  it("prioritizes salary columns for salary datasets", () => {
    const dataset: Dataset = {
      id: "salary-1",
      name: "Developer Salaries",
      uploadedAt: new Date("2026-04-06T00:00:00.000Z"),
      rowCount: 3,
      columns: [
        { name: "experience", type: "number", sample: ["5", "10"] },
        { name: "country", type: "string", sample: ["USA", "India"] },
        { name: "salary_usd", type: "number", sample: ["100000", "200000"] },
      ],
      rows: [
        { experience: 5, country: "USA", salary_usd: 100000 },
        { experience: 10, country: "USA", salary_usd: 200000 },
        { experience: 2, country: "India", salary_usd: 50000 },
      ],
    };

    const kpis = generateDemoKPIs(dataset);
    const charts = generateDemoCharts(dataset);

    expect(kpis[2]).toMatchObject({
      label: "Total Salary Usd",
      value: `$${(350000).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    });
    expect(kpis[3]).toMatchObject({ label: "Avg Experience", value: "5.67" });
    expect(charts[0]).toMatchObject({
      title: "Salary Usd by Country",
      xKey: "country",
      yKey: "salary_usd",
      data: [
        { country: "India", salary_usd: 50000 },
        { country: "USA", salary_usd: 300000 },
      ],
    });
  });
});
