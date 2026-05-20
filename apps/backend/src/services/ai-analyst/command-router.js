import { findColumn } from "./schema-profiler.js";

function deterministicCommand(schema, command) {
  const text = String(command || "").toLowerCase();

  if (/clear filters|reset filters|remove filter/.test(text)) {
    return {
      action: "CLEAR_FILTERS",
      message: "All filters cleared.",
    };
  }

  if (/remove|delete/.test(text) && /chart|graph|visual/.test(text)) {
    return {
      action: "DELETE_CHART",
      message: "Removed chart.",
    };
  }

  const filterMatch = String(command).match(
    /(?:filter|where|show only)\s+([\w\s_-]+)\s*(?:=|is|:)\s*["']?([^"']+)["']?/i
  );

  if (filterMatch) {
    const column = findColumn(schema, [filterMatch[1]], "dimension");

    if (column) {
      return {
        action: "FILTER",
        filters: {
          [column.name]: filterMatch[2].trim(),
        },
        message: `Applied filter ${column.name} = ${filterMatch[2].trim()}`,
      };
    }
  }

  if (/kpi|summary|card/.test(text)) {
    return {
      action: "ADD_KPI",
      message: "Added KPI summary.",
    };
  }

  return null;
}

async function callLlmForPlan(schema, command) {
  const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama3.2:latest";

  const prompt = `
You are an AI data analyst planner.
You do not calculate KPI values.
You do not create chart data.
You only return JSON dashboard actions.

Allowed actions:
GENERATE_CHART, MODIFY_CHART, DELETE_CHART, FILTER, CLEAR_FILTERS, ADD_KPI, ANSWER

Allowed chart types:
bar, line, pie, area, histogram, scatter

Allowed aggregations:
count, sum, avg, min, max, median

Use only columns from schema.

Return JSON only:
{
  "action": "GENERATE_CHART",
  "message": "short message",
  "chartSpec": {
    "title": "",
    "type": "bar",
    "dimension": "",
    "metric": "",
    "aggregation": "avg",
    "limit": 10
  },
  "filters": {}
}

User command:
${command}

Schema:
${JSON.stringify(schema.safePacket)}
`;

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: "json",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      options: {
        temperature: 0,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama failed with ${response.status}`);
  }

  const data = await response.json();
  const content = data.message?.content || "{}";

  return JSON.parse(content);
}

export async function routeAnalystCommand({ schema, command }) {
  const deterministic = deterministicCommand(schema, command);

  if (deterministic) return deterministic;

  try {
    const plan = await callLlmForPlan(schema, command);

    return {
      action: String(plan.action || "ANSWER").toUpperCase(),
      message: plan.message || "Done.",
      chartSpec: plan.chartSpec || plan.chart || null,
      filters: plan.filters || {},
    };
  } catch {
    return {
      action: "GENERATE_CHART",
      message: "Created a chart using local fallback rules.",
      chartSpec: {
        title: "Auto Generated Chart",
        type: command.toLowerCase().includes("pie") ? "pie" : "bar",
        xRole: "dimension",
        yRole: "metric",
        aggregation: command.toLowerCase().includes("average") ? "avg" : "sum",
        limit: 10,
      },
    };
  }
}
