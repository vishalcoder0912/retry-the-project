# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: analytics-schema-flow.spec.ts >> Analytics Page schema flow renders KPIs, correlation metrics, and anomaly detection charts
- Location: e2e\analytics-schema-flow.spec.ts:4:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.goto: Test timeout of 30000ms exceeded.
Call log:
  - navigating to "http://127.0.0.1:5173/analytics", waiting until "domcontentloaded"

```

# Test source

```ts
  87  |           },
  88  |         },
  89  |       });
  90  |     }
  91  | 
  92  |     if (url.includes("/api/qr-upload/generate")) {
  93  |       return route.fulfill({
  94  |         json: {
  95  |           success: true,
  96  |           data: {
  97  |             sessionId: "session-1",
  98  |             uploadToken: "token", // audit-ignore: secret-leak
  99  |             uploadUrl: "http://127.0.0.1:5173/mobile-upload/session-1",
  100 |             qrDataUrl: "data:image/png;base64,abc",
  101 |             workspaceName: "InsightFlow Workspace",
  102 |             status: "waiting",
  103 |             expiresAt: new Date(Date.now() + 60000).toISOString(),
  104 |           },
  105 |         },
  106 |       });
  107 |     }
  108 | 
  109 |     if (url.includes("/api/qr-upload/")) {
  110 |       return route.fulfill({
  111 |         json: {
  112 |           success: true,
  113 |           data: {
  114 |             sessionId: "session-1",
  115 |             status: "waiting",
  116 |             workspaceName: "InsightFlow Workspace",
  117 |             files: [],
  118 |             expiresAt: new Date(Date.now() + 60000).toISOString(),
  119 |           },
  120 |         },
  121 |       });
  122 |     }
  123 | 
  124 |     if (url.includes("/dashboard-command") && method === "POST") {
  125 |       const body = route.request().postDataJSON() as { query?: string };
  126 |       if (/highest/i.test(body.query || "")) {
  127 |         return route.fulfill({
  128 |           json: {
  129 |             success: true,
  130 |             data: {
  131 |               action: "GENERATE_KPI",
  132 |               message: "KPI generated",
  133 |               schemaOnly: true,
  134 |               kpiSpec: { title: "Highest Salary", metric: "salary_usd", aggregation: "max", format: "currency" },
  135 |             },
  136 |           },
  137 |         });
  138 |       }
  139 |       if (/clear/i.test(body.query || "")) {
  140 |         return route.fulfill({
  141 |           json: { success: true, data: { action: "CLEAR_FILTERS", message: "Filters cleared", schemaOnly: true } },
  142 |         });
  143 |       }
  144 |       return route.fulfill({
  145 |         json: {
  146 |           success: true,
  147 |           data: {
  148 |             action: "GENERATE_CHART",
  149 |             message: "Chart generated",
  150 |             schemaOnly: true,
  151 |             chartSpec: {
  152 |               title: "Average Salary by Country",
  153 |               type: "bar",
  154 |               xKey: "country",
  155 |               yKey: "salary_usd",
  156 |               aggregation: "avg",
  157 |             },
  158 |           },
  159 |         },
  160 |       });
  161 |     }
  162 | 
  163 |     if (url.includes("/api/pdf/import")) {
  164 |       return route.fulfill({
  165 |         json: {
  166 |           success: true,
  167 |           data: {
  168 |             pdf: { id: "pdf-1", datasetId: dataset.id, fileName: "sample.pdf", jobId: "job-1", tableCount: 1, chunkCount: 1, textElementCount: 1 },
  169 |             dataset,
  170 |             analysis,
  171 |             knowledgeBaseSummary: { tableCount: 1, chunkCount: 1, textElementCount: 1 },
  172 |             privacy: { rawPdfSentToLLM: false, extractedTextCanBeUsedForRAG: true, dashboardValuesCalculatedLocally: true },
  173 |           },
  174 |         },
  175 |       });
  176 |     }
  177 | 
  178 |     if (url.includes("/api/pdf/pdf-1/ask")) {
  179 |       return route.fulfill({ json: { success: true, data: { answer: "North revenue is 1200.", sources: [] } } });
  180 |     }
  181 | 
  182 |     return route.fulfill({ json: { success: true, data: {} } });
  183 |   });
  184 | }
  185 | 
  186 | export async function gotoApp(page: Page, path: string) {
> 187 |   await page.goto(path, { waitUntil: "domcontentloaded" });
      |              ^ Error: page.goto: Test timeout of 30000ms exceeded.
  188 |   await expect(page.locator("main").first()).toBeVisible();
  189 | }
  190 | 
```