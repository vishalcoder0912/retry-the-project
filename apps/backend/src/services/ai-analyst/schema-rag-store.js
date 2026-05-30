import fs from "node:fs";
import path from "node:path";

function resolveMemoryPath() {
  if (process.env.SCHEMA_RAG_MEMORY_PATH) {
    return path.resolve(process.env.SCHEMA_RAG_MEMORY_PATH);
  }

  const cwd = process.cwd();
  const monorepoPath = path.resolve(cwd, "apps", "backend", "data", "schema-rag-memory.json");
  const backendPath = path.resolve(cwd, "data", "schema-rag-memory.json");

  if (fs.existsSync(path.dirname(monorepoPath))) {
    return monorepoPath;
  }

  return backendPath;
}

const MEMORY_PATH = resolveMemoryPath();

function ensureDataFile() {
  fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });

  if (!fs.existsSync(MEMORY_PATH)) {
    fs.writeFileSync(MEMORY_PATH, "[]", "utf8");
  }
}

function stripForbiddenTopLevel(entry = {}) {
  const {
    rows,
    rawRows,
    sampleRows,
    datasetRows,
    fullRows,
    rowData,
    data,
    records,
    table,
    ...safe
  } = entry || {};

  return safe;
}

function stripUnsafeDashboardPlan(plan = {}) {
  return {
    kpis: Array.isArray(plan.kpis)
      ? plan.kpis.map((kpi) => {
          const { value, values, data, rows, rawRows, sampleRows, calculatedValues, ...safe } = kpi;
          return safe;
        })
      : [],
    charts: Array.isArray(plan.charts)
      ? plan.charts.map((chart) => {
          const { data, rows, rawRows, sampleRows, calculatedValues, value, values, ...safe } = chart;
          return safe;
        })
      : [],
  };
}

export function readSchemaRagMemory() {
  ensureDataFile();

  try {
    const parsed = JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
    return Array.isArray(parsed) ? parsed.map(stripForbiddenTopLevel) : [];
  } catch {
    return [];
  }
}

export function writeSchemaRagMemory(entries = []) {
  ensureDataFile();

  const safeEntries = (Array.isArray(entries) ? entries : []).map((entry) => ({
    ...stripForbiddenTopLevel(entry),
    dashboardPlan: stripUnsafeDashboardPlan(entry.dashboardPlan || {}),
    updatedAt: entry.updatedAt || new Date().toISOString(),
  }));

  fs.writeFileSync(MEMORY_PATH, JSON.stringify(safeEntries, null, 2), "utf8");

  return safeEntries;
}

export function upsertSchemaRagMemory(entry) {
  const memory = readSchemaRagMemory();
  const safeEntry = {
    ...stripForbiddenTopLevel(entry),
    dashboardPlan: stripUnsafeDashboardPlan(entry.dashboardPlan || {}),
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = memory.findIndex(
    (item) =>
      item.id === safeEntry.id ||
      (item.schemaSignature &&
        item.schemaSignature === safeEntry.schemaSignature &&
        item.domain === safeEntry.domain)
  );

  if (existingIndex >= 0) {
    const previous = memory[existingIndex];

    memory[existingIndex] = {
      ...previous,
      ...safeEntry,
      createdAt: previous.createdAt || safeEntry.createdAt || new Date().toISOString(),
      examplesSeen: Number(previous.examplesSeen || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
  } else {
    memory.push({
      ...safeEntry,
      createdAt: safeEntry.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  writeSchemaRagMemory(memory);

  return existingIndex >= 0 ? memory[existingIndex] : memory[memory.length - 1];
}

export function getSchemaRagStats() {
  const memory = readSchemaRagMemory();

  const domains = memory.reduce((acc, item) => {
    const domain = item.domain || "unknown";
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {});

  return {
    memoryPath: MEMORY_PATH,
    total: memory.length,
    domains,
    withEmbeddings: memory.filter((item) => Array.isArray(item.embedding) && item.embedding.length).length,
    updatedAt: new Date().toISOString(),
  };
}

export function clearSchemaRagMemoryForTests() {
  if (process.env.NODE_ENV !== "test" && process.env.ALLOW_RAG_CLEAR !== "1") {
    throw new Error("clearSchemaRagMemoryForTests is only allowed in test mode.");
  }

  writeSchemaRagMemory([]);
}
