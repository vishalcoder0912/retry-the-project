export const ANALYST_PLAYBOOKS = [
  {
    domain: "salary_hr_jobs",
    label: "Salary & Jobs Analytics",
    keywords: [
      "salary",
      "salary_usd",
      "experience",
      "education",
      "country",
      "company_size",
      "languages",
      "frameworks",
    ],
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Average Salary", metricAliases: ["salary", "salary_usd"], aggregation: "avg" },
      { title: "Median Salary", metricAliases: ["salary", "salary_usd"], aggregation: "median" },
      { title: "Highest Salary", metricAliases: ["salary", "salary_usd"], aggregation: "max" },
    ],
    charts: [
      {
        title: "Average Salary by Country",
        type: "bar",
        xAliases: ["country"],
        yAliases: ["salary", "salary_usd"],
        aggregation: "avg",
      },
      {
        title: "Salary Distribution",
        type: "histogram",
        yAliases: ["salary", "salary_usd"],
        aggregation: "count",
      },
      {
        title: "Average Salary by Experience",
        type: "bar",
        xAliases: ["experience"],
        yAliases: ["salary", "salary_usd"],
        aggregation: "avg",
      },
      {
        title: "Education Levels",
        type: "pie",
        xAliases: ["education"],
        aggregation: "count",
      },
      {
        title: "Top Programming Languages",
        type: "bar",
        xAliases: ["languages", "language"],
        aggregation: "split_count",
      },
    ],
  },

  {
    domain: "sales",
    label: "Sales Analytics",
    keywords: [
      "sales",
      "revenue",
      "amount",
      "profit",
      "order",
      "customer",
      "product",
      "region",
      "quantity",
      "units",
      "date",
    ],
    kpis: [
      { title: "Total Orders", aggregation: "count" },
      { title: "Total Revenue", metricAliases: ["revenue", "sales", "amount"], aggregation: "sum" },
      { title: "Average Order Value", metricAliases: ["revenue", "sales", "amount"], aggregation: "avg" },
      { title: "Highest Sale", metricAliases: ["revenue", "sales", "amount"], aggregation: "max" },
    ],
    charts: [
      {
        title: "Revenue by Product",
        type: "bar",
        xAliases: ["product", "item", "category"],
        yAliases: ["revenue", "sales", "amount"],
        aggregation: "sum",
      },
      {
        title: "Revenue by Region",
        type: "bar",
        xAliases: ["region", "country", "state", "city"],
        yAliases: ["revenue", "sales", "amount"],
        aggregation: "sum",
      },
      {
        title: "Revenue Trend",
        type: "line",
        xRole: "date",
        yAliases: ["revenue", "sales", "amount"],
        aggregation: "sum",
      },
      {
        title: "Orders by Channel",
        type: "pie",
        xAliases: ["channel", "source"],
        aggregation: "count",
      },
    ],
  },

  {
    domain: "education",
    label: "Education Analytics",
    keywords: [
      "student",
      "class",
      "grade",
      "marks",
      "score",
      "attendance",
      "subject",
      "teacher",
    ],
    kpis: [
      { title: "Total Students", aggregation: "count" },
      { title: "Average Score", metricAliases: ["score", "marks", "grade"], aggregation: "avg" },
      { title: "Highest Score", metricAliases: ["score", "marks", "grade"], aggregation: "max" },
      { title: "Average Attendance", metricAliases: ["attendance"], aggregation: "avg" },
    ],
    charts: [
      {
        title: "Average Score by Class",
        type: "bar",
        xAliases: ["class", "grade_level"],
        yAliases: ["score", "marks"],
        aggregation: "avg",
      },
      {
        title: "Average Score by Subject",
        type: "bar",
        xAliases: ["subject"],
        yAliases: ["score", "marks"],
        aggregation: "avg",
      },
      {
        title: "Students by Class",
        type: "pie",
        xAliases: ["class", "grade_level"],
        aggregation: "count",
      },
    ],
  },

  {
    domain: "time_series",
    label: "Time Series Analytics",
    keywords: ["date", "time", "month", "year", "period", "forecast", "trend"],
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Average Value", metricRole: "metric", aggregation: "avg" },
      { title: "Peak Value", metricRole: "metric", aggregation: "max" },
    ],
    charts: [
      {
        title: "Trend Over Time",
        type: "line",
        xRole: "date",
        yRole: "metric",
        aggregation: "sum",
      },
      {
        title: "Value Distribution",
        type: "histogram",
        yRole: "metric",
        aggregation: "count",
      },
    ],
  },

  {
    domain: "generic",
    label: "General Data Analytics",
    keywords: [],
    kpis: [
      { title: "Total Records", aggregation: "count" },
      { title: "Data Quality", aggregation: "quality_score" },
    ],
    charts: [
      {
        title: "Top Categories",
        type: "bar",
        xRole: "dimension",
        aggregation: "count",
      },
      {
        title: "Metric Distribution",
        type: "histogram",
        yRole: "metric",
        aggregation: "count",
      },
      {
        title: "Average Metric by Category",
        type: "bar",
        xRole: "dimension",
        yRole: "metric",
        aggregation: "avg",
      },
    ],
  },
];

function normalize(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

export function detectBestPlaybook(schema) {
  const names = schema.columns.map((column) => column.normalizedName).join(" ");

  const scored = ANALYST_PLAYBOOKS.map((playbook) => {
    let score = 0;

    for (const keyword of playbook.keywords) {
      if (names.includes(normalize(keyword))) score += 2;
    }

    const hasDate = schema.columns.some((column) => column.role === "date");
    const hasMetric = schema.columns.some((column) => column.role === "metric");
    const hasDimension = schema.columns.some((column) => column.role === "dimension");

    if (playbook.domain === "time_series" && hasDate && hasMetric) score += 5;
    if (playbook.domain === "generic" && hasMetric && hasDimension) score += 1;

    return { playbook, score };
  }).sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0
    ? scored[0].playbook
    : ANALYST_PLAYBOOKS.find((playbook) => playbook.domain === "generic");
}
