const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const inferType = (values) => {
  const sample = values.filter(Boolean).slice(0, 20);
  if (sample.length === 0) return "string";
  if (sample.every((value) => !Number.isNaN(Number(value)))) return "number";
  if (sample.every((value) => !Number.isNaN(Date.parse(value)))) return "date";
  return "string";
};

export const normalizeColumns = (rows, providedColumns = []) => {
  if (providedColumns.length > 0) {
    return providedColumns.map((column) => ({
      name: column.name,
      type: column.type || inferType(rows.slice(0, 20).map((row) => String(row[column.name] ?? ""))),
      sample: Array.isArray(column.sample) ? column.sample.map((value) => String(value)) : [],
    }));
  }

  const fields = Object.keys(rows[0] || {});
  return fields.map((name) => ({
    name,
    type: inferType(rows.slice(0, 20).map((row) => String(row[name] ?? ""))),
    sample: rows.slice(0, 3).map((row) => String(row[name] ?? "")),
  }));
};

export const generateDemoDataset = () => {
  const categories = ["Electronics", "Clothing", "Food", "Software", "Services"];
  const regions = ["North", "South", "East", "West"];
  const rows = [];

  for (let index = 0; index < 200; index += 1) {
    rows.push({
      month: months[Math.floor(Math.random() * months.length)],
      category: categories[Math.floor(Math.random() * categories.length)],
      region: regions[Math.floor(Math.random() * regions.length)],
      revenue: Math.floor(Math.random() * 50000) + 5000,
      units_sold: Math.floor(Math.random() * 500) + 10,
      profit_margin: Number((Math.random() * 0.4 + 0.1).toFixed(2)),
      customer_rating: Number((Math.random() * 2 + 3).toFixed(1)),
    });
  }

  return {
    name: "Sales Analytics 2024",
    sourceType: "demo",
    fileName: "sales-analytics-2024.json",
    columns: [
      { name: "month", type: "string", sample: months.slice(0, 3) },
      { name: "category", type: "string", sample: categories.slice(0, 3) },
      { name: "region", type: "string", sample: regions.slice(0, 3) },
      { name: "revenue", type: "number", sample: ["25000", "18000", "32000"] },
      { name: "units_sold", type: "number", sample: ["150", "230", "89"] },
      { name: "profit_margin", type: "number", sample: ["0.25", "0.18", "0.32"] },
      { name: "customer_rating", type: "number", sample: ["4.2", "3.8", "4.7"] },
    ],
    rows,
  };
};

export const generateCharts = (dataset) => {
  const monthlyRevenue = Object.fromEntries(months.map((month) => [month, 0]));
  const marginByMonth = Object.fromEntries(months.map((month) => [month, { sum: 0, count: 0 }]));
  const categoryRevenue = {};
  const regionUnits = {};

  dataset.rows.forEach((row) => {
    const revenue = toNumber(row.revenue);
    const unitsSold = toNumber(row.units_sold);
    const profitMargin = toNumber(row.profit_margin);

    if (monthlyRevenue[row.month] != null) {
      monthlyRevenue[row.month] += revenue;
    }

    if (marginByMonth[row.month]) {
      marginByMonth[row.month].sum += profitMargin;
      marginByMonth[row.month].count += 1;
    }

    if (row.category) {
      categoryRevenue[row.category] = (categoryRevenue[row.category] || 0) + revenue;
    }

    if (row.region) {
      regionUnits[row.region] = (regionUnits[row.region] || 0) + unitsSold;
    }
  });

  return [
    {
      type: "area",
      title: "Revenue Trend",
      xKey: "month",
      yKey: "revenue",
      data: months.map((month) => ({ month, revenue: monthlyRevenue[month] })),
    },
    {
      type: "bar",
      title: "Revenue by Category",
      xKey: "category",
      yKey: "revenue",
      data: Object.entries(categoryRevenue).map(([category, revenue]) => ({ category, revenue })),
    },
    {
      type: "bar",
      title: "Units Sold by Region",
      xKey: "region",
      yKey: "units",
      data: Object.entries(regionUnits).map(([region, units]) => ({ region, units })),
    },
    {
      type: "line",
      title: "Profit Margin Trend",
      xKey: "month",
      yKey: "margin",
      data: months.map((month) => ({
        month,
        margin: marginByMonth[month].count > 0
          ? Number(((marginByMonth[month].sum / marginByMonth[month].count) * 100).toFixed(1))
          : 0,
      })),
    },
  ];
};

export const createChatResponse = (dataset, query) => {
  const charts = generateCharts(dataset);
  const queryLower = query.toLowerCase();

  if (queryLower.includes("revenue") && queryLower.includes("category")) {
    return {
      content: "Here is the revenue breakdown by category. Electronics is leading the portfolio.",
      sql: "SELECT category, SUM(revenue) AS revenue FROM dataset_rows GROUP BY category ORDER BY revenue DESC;",
      chart: charts[1],
      insights: [
        "Electronics contributes the largest revenue share in the current dataset.",
        "Software is the next strongest category and looks like the clearest growth area.",
        "The chart suggests concentrating promotions on the top-performing categories first.",
      ],
    };
  }

  if (queryLower.includes("trend") || queryLower.includes("monthly")) {
    return {
      content: "Here is the monthly revenue trend. The dataset shows clear seasonality across the year.",
      sql: "SELECT month, SUM(revenue) AS revenue FROM dataset_rows GROUP BY month ORDER BY month;",
      chart: charts[0],
      insights: [
        "Monthly revenue is not flat, which means demand planning should account for peaks and dips.",
        "The later months trend stronger than the early months in this sample dataset.",
        "Inventory and staffing decisions should be aligned to the highest-volume months.",
      ],
    };
  }

  if (queryLower.includes("region")) {
    return {
      content: "Regional performance varies noticeably. Some territories are clearly outperforming others.",
      sql: "SELECT region, SUM(units_sold) AS units FROM dataset_rows GROUP BY region ORDER BY units DESC;",
      chart: charts[2],
      insights: [
        "The strongest region is materially ahead of the weakest one.",
        "There is room to investigate operational or sales differences by territory.",
        "Underperforming regions are the clearest place to target expansion work.",
      ],
    };
  }

  if (queryLower.includes("margin") || queryLower.includes("profit")) {
    return {
      content: "Profit margin is trending in a healthy direction and stays usable as a management KPI.",
      sql: "SELECT month, AVG(profit_margin) * 100 AS margin FROM dataset_rows GROUP BY month ORDER BY month;",
      chart: charts[3],
      insights: [
        "Average margin remains stable enough to track month by month.",
        "The current values indicate margin quality is acceptable for a basic sales dashboard.",
        "This view is useful for spotting cost pressure before it impacts revenue.",
      ],
    };
  }

  return {
    content: `I analyzed the ${dataset.name} dataset and prepared a general overview based on the uploaded rows.`,
    sql: "SELECT * FROM dataset_rows LIMIT 100;",
    chart: charts[0],
    insights: [
      `The dataset currently has ${dataset.rowCount} rows and ${dataset.columns.length} columns.`,
      "The best supported questions are around revenue, units sold, categories, regions, and profit trends.",
      "If you ask for a comparison or a trend, the backend can return a chart and SQL explanation.",
    ],
  };
};
