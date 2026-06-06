# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-chat-custom-chart.spec.ts >> E2E Dashboard chat commands for custom charts
- Location: e2e\dashboard-chat-custom-chart.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByPlaceholder(/Ask:/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByPlaceholder(/Ask:/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - region "Notifications (F8)":
      - list
    - region "Notifications alt+T"
    - generic [ref=e3]:
      - complementary [ref=e6]:
        - link "InsightFlow Agentic AI Analytics" [ref=e8] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e10]
          - generic [ref=e12]:
            - heading "InsightFlow" [level=1] [ref=e13]
            - paragraph [ref=e14]: Agentic AI Analytics
        - paragraph [ref=e16]: Menu
        - navigation [ref=e17]:
          - link "Dashboard" [ref=e18] [cursor=pointer]:
            - /url: /dashboard
            - generic [ref=e19]:
              - img [ref=e21]
              - generic [ref=e26]: Dashboard
          - link "Data Table" [ref=e27] [cursor=pointer]:
            - /url: /data
            - generic [ref=e28]:
              - img [ref=e30]
              - generic [ref=e32]: Data Table
          - link "Upload" [ref=e33] [cursor=pointer]:
            - /url: /upload
            - generic [ref=e34]:
              - img [ref=e36]
              - generic [ref=e39]: Upload
          - link "PDF Intelligence" [ref=e40] [cursor=pointer]:
            - /url: /pdf
            - generic [ref=e41]:
              - img [ref=e43]
              - generic [ref=e46]: PDF Intelligence
          - link "Analytics" [ref=e47] [cursor=pointer]:
            - /url: /analytics
            - generic [ref=e48]:
              - img [ref=e50]
              - generic [ref=e53]: Analytics
          - link "AI Chat" [ref=e54] [cursor=pointer]:
            - /url: /chat
            - generic [ref=e55]:
              - img [ref=e57]
              - generic [ref=e59]: AI Chat
          - link "Agentic AI" [ref=e60] [cursor=pointer]:
            - /url: /agentic
            - generic [ref=e61]:
              - img [ref=e63]
              - generic [ref=e65]: Agentic AI
          - link "Data Science" [ref=e66] [cursor=pointer]:
            - /url: /agentic-data-science
            - generic [ref=e67]:
              - img [ref=e69]
              - generic [ref=e81]: Data Science
        - generic [ref=e83]:
          - generic [ref=e84]:
            - paragraph [ref=e85]: AI Engine Status
            - button "Refresh AI engine status" [ref=e86] [cursor=pointer]:
              - img [ref=e87]
          - generic [ref=e92]:
            - generic [ref=e93]:
              - generic [ref=e94]: Gemini
              - generic [ref=e95]: Offline
            - generic [ref=e97]:
              - generic [ref=e98]: Ollama
              - generic [ref=e99]: Offline
            - generic [ref=e102]:
              - generic [ref=e103]: Mode
              - generic [ref=e104]: Hybrid
            - generic [ref=e105]:
              - generic [ref=e106]: Fallback
              - generic [ref=e107]: Local AI
          - generic [ref=e108]:
            - img [ref=e109]
            - generic [ref=e111]: Gemini API key is missing or invalid.
      - main [ref=e112]:
        - generic [ref=e114]:
          - button "salary-small 3 rows" [ref=e115] [cursor=pointer]:
            - generic [ref=e116]:
              - generic [ref=e117]: salary-small
              - generic [ref=e118]: 3 rows
            - img [ref=e120]
          - generic [ref=e122]:
            - img [ref=e123]
            - textbox "Ask InsightFlow AI anything about your data..." [ref=e125]
            - button "Run AI command" [ref=e126] [cursor=pointer]:
              - img [ref=e127]
          - generic [ref=e129]:
            - button "Refresh" [ref=e130] [cursor=pointer]:
              - img [ref=e131]
              - text: Refresh
            - button "Export" [ref=e136] [cursor=pointer]:
              - img [ref=e137]
              - text: Export
            - button "Share" [ref=e140] [cursor=pointer]:
              - img [ref=e141]
              - text: Share
        - generic [ref=e148]:
          - generic [ref=e149]:
            - generic [ref=e150]:
              - img [ref=e152]
              - generic [ref=e154]:
                - heading "InsightFlow Agentic Dashboard" [level=1] [ref=e155]
                - paragraph [ref=e156]: Your AI agent analyzes real uploaded data and controls KPIs, charts, filters, and insights.
            - generic [ref=e157]:
              - generic [ref=e158]: "Last updated: No AI actions yet"
              - button "Run Analysis" [ref=e160] [cursor=pointer]:
                - img [ref=e161]
                - text: Run Analysis
          - generic [ref=e163]:
            - combobox [ref=e164]:
              - option "All Country" [selected]
              - option "India"
              - option "USA"
            - button "Reset" [ref=e165] [cursor=pointer]:
              - img [ref=e166]
              - text: Reset
          - generic [ref=e171]:
            - generic [ref=e172]:
              - generic [ref=e173]:
                - generic [ref=e174]:
                  - paragraph [ref=e175]: Total Records
                  - paragraph [ref=e176]: "3"
                  - paragraph [ref=e178]: COUNT - Row Count
                - img [ref=e180]
              - paragraph [ref=e185]: count(__row_count__)
            - generic [ref=e186]:
              - generic [ref=e187]:
                - generic [ref=e188]:
                  - paragraph [ref=e189]: Average Salary
                  - paragraph [ref=e190]: $68,333.33
                  - generic [ref=e191]:
                    - generic [ref=e192]: +55%
                    - paragraph [ref=e193]: AVG - Salary Usd
                - img [ref=e195]
              - img [ref=e199]
            - generic [ref=e201]:
              - generic [ref=e202]:
                - generic [ref=e203]:
                  - paragraph [ref=e204]: Median Salary
                  - paragraph [ref=e205]: $65,000.00
                  - generic [ref=e206]:
                    - generic [ref=e207]: +55%
                    - paragraph [ref=e208]: MEDIAN - Salary Usd
                - img [ref=e210]
              - img [ref=e213]
            - generic [ref=e215]:
              - generic [ref=e216]:
                - generic [ref=e217]:
                  - paragraph [ref=e218]: Top Location
                  - paragraph [ref=e219]: USA
                  - paragraph [ref=e221]: By Salary Usd
                - img [ref=e223]
              - paragraph [ref=e227]: Calculated from filtered rows
            - generic [ref=e228]:
              - generic [ref=e229]:
                - generic [ref=e230]:
                  - paragraph [ref=e231]: Data Quality Score
                  - paragraph [ref=e232]: 100%
                  - paragraph [ref=e234]: 100% complete
                - img [ref=e236]
              - paragraph [ref=e239]: Calculated from filtered rows
          - generic [ref=e240]:
            - main [ref=e241]:
              - generic [ref=e242]:
                - generic [ref=e244]:
                  - generic [ref=e245]:
                    - generic [ref=e246]:
                      - heading "Salary Usd by Country" [level=3] [ref=e247]
                      - paragraph [ref=e248]: AVG - Country vs Salary Usd
                    - generic [ref=e249]:
                      - button "Explain" [ref=e250] [cursor=pointer]:
                        - img [ref=e251]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e253]:
                        - option "bar" [selected]
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e254] [cursor=pointer]:
                        - img
                  - img [ref=e258]:
                    - generic [ref=e263]:
                      - generic [ref=e265]: USA
                      - generic [ref=e267]: India
                    - generic [ref=e269]:
                      - generic [ref=e271]: "0"
                      - generic [ref=e273]: "25000"
                      - generic [ref=e275]: "50000"
                      - generic [ref=e277]: "75000"
                      - generic [ref=e279]: "100000"
                  - generic [ref=e287]:
                    - generic [ref=e288]: "Metric Used: salary_usd"
                    - generic [ref=e289]: "Calculation Source: AVG(salary_usd) grouped by country"
                - generic [ref=e291]:
                  - generic [ref=e292]:
                    - generic [ref=e293]:
                      - heading "Records by Country" [level=3] [ref=e294]
                      - paragraph [ref=e295]: COUNT - Country vs Count
                    - generic [ref=e296]:
                      - button "Explain" [ref=e297] [cursor=pointer]:
                        - img [ref=e298]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e300]:
                        - option "bar"
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut" [selected]
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e301] [cursor=pointer]:
                        - img
                  - generic [ref=e304]:
                    - img [ref=e305]:
                      - generic [ref=e307]:
                        - img [ref=e309]
                        - img [ref=e311]
                    - list [ref=e313]:
                      - listitem [ref=e314]:
                        - img [ref=e315]
                        - text: India
                      - listitem [ref=e317]:
                        - img [ref=e318]
                        - text: USA
                  - generic [ref=e320]:
                    - generic [ref=e321]: "Metric Used: count"
                    - generic [ref=e322]: "Calculation Source: COUNT(count) grouped by country"
                - generic [ref=e324]:
                  - generic [ref=e325]:
                    - generic [ref=e326]:
                      - heading "Average Salary Usd by Country" [level=3] [ref=e327]
                      - paragraph [ref=e328]: AVG - Country vs Salary Usd
                    - generic [ref=e329]:
                      - button "Explain" [ref=e330] [cursor=pointer]:
                        - img [ref=e331]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e333]:
                        - option "bar" [selected]
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e334] [cursor=pointer]:
                        - img
                  - img [ref=e338]:
                    - generic [ref=e343]:
                      - generic [ref=e345]: USA
                      - generic [ref=e347]: India
                    - generic [ref=e349]:
                      - generic [ref=e351]: "0"
                      - generic [ref=e353]: "25000"
                      - generic [ref=e355]: "50000"
                      - generic [ref=e357]: "75000"
                      - generic [ref=e359]: "100000"
                  - generic [ref=e367]:
                    - generic [ref=e368]: "Metric Used: salary_usd"
                    - generic [ref=e369]: "Calculation Source: AVG(salary_usd) grouped by country"
                - generic [ref=e371]:
                  - generic [ref=e372]:
                    - generic [ref=e373]:
                      - heading "Salary Usd Distribution" [level=3] [ref=e374]
                      - paragraph [ref=e375]: COUNT - Range vs Count
                    - generic [ref=e376]:
                      - button "Explain" [ref=e377] [cursor=pointer]:
                        - img [ref=e378]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e380]:
                        - option "bar"
                        - option "horizontal bar"
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram" [selected]
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e381] [cursor=pointer]:
                        - img
                  - img [ref=e385]:
                    - generic [ref=e390]:
                      - generic [ref=e392]: 50000-55000
                      - generic [ref=e394]: 60000-65000
                      - generic [ref=e396]: 70000-75000
                      - generic [ref=e398]: 85000-90000
                    - generic [ref=e400]:
                      - generic [ref=e402]: "0"
                      - generic [ref=e404]: "0.25"
                      - generic [ref=e406]: "0.5"
                      - generic [ref=e408]: "0.75"
                      - generic [ref=e410]: "1"
                  - generic [ref=e420]:
                    - generic [ref=e421]: "Metric Used: count"
                    - generic [ref=e422]: "Calculation Source: COUNT(count) grouped by range"
                - generic [ref=e424]:
                  - generic [ref=e425]:
                    - generic [ref=e426]:
                      - heading "Top Country by Salary Usd" [level=3] [ref=e427]
                      - paragraph [ref=e428]: MAX - Country vs Salary Usd
                    - generic [ref=e429]:
                      - button "Explain" [ref=e430] [cursor=pointer]:
                        - img [ref=e431]
                        - text: Explain
                      - combobox "Edit chart type" [ref=e433]:
                        - option "bar"
                        - option "horizontal bar" [selected]
                        - option "line"
                        - option "area"
                        - option "pie"
                        - option "donut"
                        - option "histogram"
                        - option "scatter"
                        - option "radar"
                        - option "composed"
                        - option "heatmap"
                      - button [ref=e434] [cursor=pointer]:
                        - img
                  - img [ref=e438]:
                    - generic [ref=e443]:
                      - generic [ref=e445]: "0"
                      - generic [ref=e447]: "25000"
                      - generic [ref=e449]: "50000"
                      - generic [ref=e451]: "75000"
                      - generic [ref=e453]: "100000"
                    - generic [ref=e455]:
                      - generic [ref=e457]: USA
                      - generic [ref=e459]: India
                  - generic [ref=e467]:
                    - generic [ref=e468]: "Metric Used: salary_usd"
                    - generic [ref=e469]: "Calculation Source: MAX(salary_usd) grouped by country"
              - generic [ref=e470]:
                - generic [ref=e472]:
                  - generic [ref=e473]:
                    - img [ref=e475]
                    - generic [ref=e478]:
                      - heading "Geo Intelligence" [level=2] [ref=e479]
                      - paragraph [ref=e480]: 2 locations - Salary Usd
                  - generic [ref=e482]:
                    - img [ref=e483]
                    - generic [ref=e486]: "Field: country"
                - generic [ref=e488]:
                  - generic [ref=e489]:
                    - paragraph [ref=e490]: Field Used
                    - paragraph [ref=e491]: country
                    - paragraph [ref=e492]: Detected geographic column
                  - generic [ref=e493]:
                    - paragraph [ref=e494]: Locations
                    - paragraph [ref=e495]: "2"
                    - paragraph [ref=e496]: Countries/regions with data
                  - generic [ref=e497]:
                    - paragraph [ref=e498]: Top Location
                    - paragraph [ref=e499]: United States
                    - paragraph [ref=e500]: "Avg salary_usd: $90,000"
                  - generic [ref=e501]:
                    - paragraph [ref=e502]: Average
                    - paragraph [ref=e503]: $73,750
                    - paragraph [ref=e504]: Across 2 locations
                  - generic [ref=e505]:
                    - paragraph [ref=e506]: Total Records
                    - paragraph [ref=e507]: "3"
                    - paragraph [ref=e508]: Salary Usd
                - generic [ref=e509]:
                  - generic [ref=e510]:
                    - img [ref=e512]
                    - generic [ref=e694]:
                      - generic [ref=e695]: No data
                      - generic [ref=e697]: Low
                      - generic [ref=e699]: Medium
                      - generic [ref=e701]: High
                  - generic [ref=e703]:
                    - generic [ref=e704]:
                      - heading "Top 2 Locations" [level=3] [ref=e705]
                      - generic [ref=e706]:
                        - 'button "1 United States $90,000 1 records #1" [ref=e707] [cursor=pointer]':
                          - generic [ref=e708]:
                            - generic [ref=e709]:
                              - generic [ref=e710]: "1"
                              - generic [ref=e711]: United States
                            - generic [ref=e712]: $90,000
                          - generic [ref=e715]:
                            - generic [ref=e716]: 1 records
                            - generic [ref=e717]: "#1"
                        - 'button "2 India $57,500 2 records #2" [ref=e718] [cursor=pointer]':
                          - generic [ref=e719]:
                            - generic [ref=e720]:
                              - generic [ref=e721]: "2"
                              - generic [ref=e722]: India
                            - generic [ref=e723]: $57,500
                          - generic [ref=e726]:
                            - generic [ref=e727]: 2 records
                            - generic [ref=e728]: "#2"
                    - generic [ref=e729]:
                      - generic [ref=e730]:
                        - img [ref=e731]
                        - text: AI Geo Insight
                      - paragraph [ref=e733]: Analyzing 2 locations with salary_usd as the primary metric. Top location is United States ($90,000), followed by India.
              - generic [ref=e734]:
                - generic [ref=e735]:
                  - generic [ref=e736]:
                    - heading "Data-Driven Insights" [level=2] [ref=e737]
                    - paragraph [ref=e738]: Generated from the current filtered dataset.
                  - link "Open Copilot" [ref=e739] [cursor=pointer]:
                    - /url: /chat
                - generic [ref=e740]:
                  - generic [ref=e741]:
                    - img [ref=e742]
                    - paragraph [ref=e744]: USA leads
                    - paragraph [ref=e745]: Highest average Salary Usd is 90000.
                  - generic [ref=e746]:
                    - img [ref=e747]
                    - paragraph [ref=e749]: Data quality is strong
                    - paragraph [ref=e750]: 100% completeness and 100% uniqueness across the dataset.
                  - generic [ref=e751]:
                    - img [ref=e752]
                    - paragraph [ref=e754]: Anomaly watch
                    - paragraph [ref=e755]: 0 records in Salary Usd stand far from the average.
              - generic [ref=e756]:
                - generic [ref=e757]:
                  - generic [ref=e758]:
                    - heading "Dataset Preview" [level=2] [ref=e759]
                    - paragraph [ref=e760]: 3 filtered rows x 3 columns
                  - link "View Table" [ref=e761] [cursor=pointer]:
                    - /url: /data
                    - img [ref=e762]
                    - text: View Table
                - table [ref=e765]:
                  - rowgroup [ref=e766]:
                    - row "country salary_usd experience" [ref=e767]:
                      - columnheader "country" [ref=e768]
                      - columnheader "salary_usd" [ref=e769]
                      - columnheader "experience" [ref=e770]
                  - rowgroup [ref=e771]:
                    - row "India 50000 2" [ref=e772]:
                      - cell "India" [ref=e773]
                      - cell "50000" [ref=e774]
                      - cell "2" [ref=e775]
                    - row "USA 90000 5" [ref=e776]:
                      - cell "USA" [ref=e777]
                      - cell "90000" [ref=e778]
                      - cell "5" [ref=e779]
                    - row "India 65000 3" [ref=e780]:
                      - cell "India" [ref=e781]
                      - cell "65000" [ref=e782]
                      - cell "3" [ref=e783]
            - complementary [ref=e784]:
              - generic [ref=e785]:
                - generic [ref=e786]:
                  - generic [ref=e787]:
                    - img [ref=e789]
                    - generic [ref=e791]:
                      - heading "InsightFlow AI" [level=2] [ref=e792]
                      - paragraph [ref=e793]: AI can control dashboard layout and metrics.
                  - generic [ref=e794]: Active
                - generic [ref=e796]:
                  - generic [ref=e797]:
                    - img [ref=e799]
                    - generic [ref=e802]: InsightFlow AI
                    - generic [ref=e803]: 07:03 PM
                  - paragraph [ref=e804]: I can control dashboard layout, metrics, charts, filters, and Geo Intelligence.
                - generic [ref=e806]:
                  - textbox "Ask InsightFlow AI" [ref=e807]:
                    - /placeholder: Ask InsightFlow AI...
                  - button "Send AI command" [ref=e808] [cursor=pointer]:
                    - img [ref=e809]
              - generic [ref=e812]:
                - generic [ref=e813]:
                  - heading "Suggested actions" [level=3] [ref=e814]
                  - generic [ref=e815]: View all
                - generic [ref=e816]:
                  - button "Compare Salary Usd by Country" [ref=e817] [cursor=pointer]
                  - button "Show top 5 Country by Salary Usd" [ref=e818] [cursor=pointer]
                  - button "Add a KPI for median Salary Usd" [ref=e819] [cursor=pointer]
                  - button "Run Geo Intelligence" [ref=e820] [cursor=pointer]
                  - button "Explain the trend" [ref=e821] [cursor=pointer]
              - generic [ref=e822]:
                - generic [ref=e823]:
                  - heading "Recent actions" [level=3] [ref=e824]
                  - generic [ref=e825]: View all
                - paragraph [ref=e827]: AI dashboard actions will appear here.
              - generic [ref=e829]:
                - generic [ref=e831]: 100%
                - generic [ref=e832]:
                  - paragraph [ref=e833]: Schema confidence
                  - paragraph [ref=e834]: Based on data quality and field compatibility.
          - generic [ref=e835]:
            - img [ref=e836]
            - text: Schema-safe local calculations
  - generic [ref=e839]: "0.25"
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | import { gotoApp, mockInsightFlowApi } from "./helpers";
  3  | 
  4  | test("E2E Dashboard chat commands for custom charts", async ({ page }) => {
  5  |   await mockInsightFlowApi(page);
  6  | 
  7  |   // Overwrite dashboard-command mock for this test
  8  |   await page.route("**/api/datasets/*/dashboard-command", async (route) => {
  9  |     const body = route.request().postDataJSON() as { query?: string };
  10 |     const query = body.query?.toLowerCase() || "";
  11 | 
  12 |     if (query.includes("remove")) {
  13 |       return route.fulfill({
  14 |         json: {
  15 |           success: true,
  16 |           data: {
  17 |             action: "DELETE_CHART",
  18 |             message: "Chart Average Salary by Country removed.",
  19 |             schemaOnly: true
  20 |           }
  21 |         }
  22 |       });
  23 |     }
  24 | 
  25 |     if (query.includes("average salary")) {
  26 |       return route.fulfill({
  27 |         json: {
  28 |           success: true,
  29 |           data: {
  30 |             action: "GENERATE_CHART",
  31 |             message: "Chart Average Salary by Country created.",
  32 |             schemaOnly: true,
  33 |             chart: {
  34 |               id: "chart-salary",
  35 |               title: "Average Salary by Country",
  36 |               type: "bar",
  37 |               xKey: "country",
  38 |               yKey: "salary_usd",
  39 |               aggregation: "avg",
  40 |               data: [{ country: "India", salary_usd: 57500 }]
  41 |             }
  42 |           }
  43 |         }
  44 |       });
  45 |     }
  46 | 
  47 |     if (query.includes("pie chart")) {
  48 |       return route.fulfill({
  49 |         json: {
  50 |           success: true,
  51 |           data: {
  52 |             action: "GENERATE_CHART",
  53 |             message: "Pie chart of country created.",
  54 |             schemaOnly: true,
  55 |             chart: {
  56 |               id: "chart-pie",
  57 |               title: "Country Breakdown",
  58 |               type: "pie",
  59 |               xKey: "country",
  60 |               yKey: "count",
  61 |               aggregation: "count",
  62 |               data: [{ country: "India", count: 2 }]
  63 |             }
  64 |           }
  65 |         }
  66 |       });
  67 |     }
  68 | 
  69 |     return route.fulfill({ json: { success: true, data: {} } });
  70 |   });
  71 | 
  72 |   await gotoApp(page, "/dashboard");
  73 | 
  74 |   // Type: Show average salary_usd by country
  75 |   const chatInput = page.getByPlaceholder(/Ask:/i);
> 76 |   await expect(chatInput).toBeVisible();
     |                           ^ Error: expect(locator).toBeVisible() failed
  77 |   await chatInput.fill("Show average salary_usd by country");
  78 |   await page.click("button[aria-label='Send dashboard command']");
  79 | 
  80 |   // Verify chart appears and chat response confirms creation
  81 |   await expect(page.getByText("Chart Average Salary by Country created.")).toBeVisible();
  82 | 
  83 |   // Type: Create pie chart of country
  84 |   await chatInput.fill("Create pie chart of country");
  85 |   await page.click("button[aria-label='Send dashboard command']");
  86 |   await expect(page.getByText("Pie chart of country created.")).toBeVisible();
  87 | 
  88 |   // Type: Remove Average Salary by Country
  89 |   await chatInput.fill("Remove Average Salary by Country");
  90 |   await page.click("button[aria-label='Send dashboard command']");
  91 |   await expect(page.getByText("Chart Average Salary by Country removed.")).toBeVisible();
  92 | });
  93 | 
```