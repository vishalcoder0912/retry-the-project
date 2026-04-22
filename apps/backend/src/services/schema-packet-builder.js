import os from "node:os";
import { Worker } from "node:worker_threads";
import { toNumber, isMeaningfulValue } from "@insightflow/shared-analytics";

const DEFAULT_SCHEMA_SAMPLE_SIZE = Number(process.env.SCHEMA_PACKET_SAMPLE_SIZE || 5000);
const DEFAULT_SCHEMA_ANALYSIS_CONCURRENCY = Number(
  process.env.SCHEMA_ANALYSIS_CONCURRENCY
  || Math.max(1, Math.min((os.availableParallelism?.() || os.cpus().length || 2) - 1, 4)),
);
const WORKER_ROW_THRESHOLD = Number(process.env.SCHEMA_WORKER_ROW_THRESHOLD || 1000);
const WORKER_CELL_THRESHOLD = Number(process.env.SCHEMA_WORKER_CELL_THRESHOLD || 50000);
const schemaPacketCache = new Map();
const asyncSchemaPacketCache = new Map();

function buildDatasetCacheKey(dataset, sampleSize) {
  return [
    dataset?.id || dataset?.name || "anonymous",
    dataset?.rows?.length || 0,
    dataset?.columns?.length || 0,
    sampleSize,
  ].join(":");
}

function sampleRowsForSchema(rows, sampleSize) {
  if (!Array.isArray(rows) || rows.length <= sampleSize) {
    return rows;
  }

  const sampledRows = [];
  const lastIndex = rows.length - 1;

  for (let index = 0; index < sampleSize; index += 1) {
    const rowIndex = Math.round((index * lastIndex) / Math.max(sampleSize - 1, 1));
    sampledRows.push(rows[rowIndex]);
  }

  return sampledRows;
}

function extractNumericStats(values) {
  const numbers = [];
  let nullCount = 0;
  let invalidCount = 0;

  for (const val of values) {
    if (!isMeaningfulValue(val)) {
      nullCount += 1;
      continue;
    }

    const num = toNumber(val);
    if (num === null) {
      invalidCount += 1;
    } else {
      numbers.push(num);
    }
  }

  if (numbers.length < 10) {
    return {
      type: "numeric",
      isValid: false,
      reason: `Only ${numbers.length} valid values`,
      nullCount,
      invalidCount,
      validCount: numbers.length,
    };
  }

  const sorted = [...numbers].sort((a, b) => a - b);
  const sum = numbers.reduce((a, b) => a + b, 0);
  const mean = sum / numbers.length;
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  const variance = numbers.reduce((sumValue, num) => sumValue + ((num - mean) ** 2), 0) / numbers.length;
  const stdDev = Math.sqrt(variance);

  return {
    type: "numeric",
    isValid: true,
    min: Math.min(...numbers),
    max: Math.max(...numbers),
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    nullCount,
    invalidCount,
    validCount: numbers.length,
    uniqueCount: new Set(numbers).size,
  };
}

function extractCategoricalStats(values) {
  const valueCounts = new Map();
  let nullCount = 0;

  for (const val of values) {
    if (!isMeaningfulValue(val)) {
      nullCount += 1;
      continue;
    }

    const strVal = String(val).trim().substring(0, 100);
    if (valueCounts.size >= 100 && !valueCounts.has(strVal)) {
      continue;
    }

    valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);
  }

  const sorted = [...valueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    type: "categorical",
    isValid: true,
    nullCount,
    uniqueCount: valueCounts.size,
    topValues: Object.fromEntries(sorted),
    topValuesCount: sorted.length,
  };
}

function analyzeColumn(column, sampledRows) {
  const columnValues = sampledRows.map((row) => row[column.name]);

  if (column.type === "number") {
    return {
      name: column.name,
      ...extractNumericStats(columnValues),
    };
  }

  return {
    name: column.name,
    ...extractCategoricalStats(columnValues),
  };
}

function shouldUseWorkerAnalysis(sampledRows, columns) {
  const cellCount = (sampledRows?.length || 0) * (columns?.length || 0);
  return (
    Array.isArray(sampledRows)
    && Array.isArray(columns)
    && sampledRows.length >= WORKER_ROW_THRESHOLD
    && columns.length > 1
    && cellCount >= WORKER_CELL_THRESHOLD
    && DEFAULT_SCHEMA_ANALYSIS_CONCURRENCY > 1
  );
}

function chunkColumns(columns, chunkCount) {
  const actualChunkCount = Math.max(1, Math.min(chunkCount, columns.length));
  const chunks = Array.from({ length: actualChunkCount }, () => []);

  columns.forEach((column, index) => {
    chunks[index % actualChunkCount].push(column);
  });

  return chunks.filter((chunk) => chunk.length > 0);
}

function runWorkerBatch(columns, sampledRows) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./schema-packet-worker.js", import.meta.url), {
      workerData: { columns, sampledRows },
    });

    worker.once("message", (message) => {
      worker.terminate().catch(() => {});
      if (message?.error) {
        reject(new Error(message.error));
        return;
      }
      resolve(Array.isArray(message?.columns) ? message.columns : []);
    });

    worker.once("error", (error) => {
      worker.terminate().catch(() => {});
      reject(error);
    });

    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Schema worker exited with code ${code}`));
      }
    });
  });
}

async function analyzeColumnsAsync(columns, sampledRows) {
  if (!shouldUseWorkerAnalysis(sampledRows, columns)) {
    return Promise.all(columns.map(async (column) => {
      try {
        return analyzeColumn(column, sampledRows);
      } catch (error) {
        return {
          name: column.name,
          type: column.type,
          isValid: false,
          error: error.message,
        };
      }
    }));
  }

  const batches = chunkColumns(columns, DEFAULT_SCHEMA_ANALYSIS_CONCURRENCY);
  const results = await Promise.all(
    batches.map((batch) => runWorkerBatch(batch, sampledRows)),
  );

  return results.flat();
}

function createSchemaPacketSkeleton(dataset, sampledRows) {
  return {
    name: dataset.name || "Unnamed Dataset",
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    sampledRowCount: sampledRows.length,
    columns: [],
    timestamp: new Date().toISOString(),
  };
}

function sortColumnsByDatasetOrder(analyzedColumns, datasetColumns) {
  const order = new Map(datasetColumns.map((column, index) => [column.name, index]));
  return [...analyzedColumns].sort((left, right) => (order.get(left.name) || 0) - (order.get(right.name) || 0));
}

/**
 * Build schema packet (NO raw data, only metadata)
 */
export function buildSchemaPacket(dataset, options = {}) {
  if (!dataset || !Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    throw new Error("Invalid dataset");
  }

  const sampleSize = Number(options.sampleSize || DEFAULT_SCHEMA_SAMPLE_SIZE);
  const cacheKey = buildDatasetCacheKey(dataset, sampleSize);
  const cachedPacket = schemaPacketCache.get(cacheKey);

  if (cachedPacket) {
    return cachedPacket;
  }

  const sampledRows = sampleRowsForSchema(dataset.rows, sampleSize);
  const schemaPacket = createSchemaPacketSkeleton(dataset, sampledRows);

  for (const column of dataset.columns) {
    try {
      schemaPacket.columns.push(analyzeColumn(column, sampledRows));
    } catch (error) {
      console.warn(`Error processing column "${column.name}":`, error.message);
      schemaPacket.columns.push({
        name: column.name,
        type: column.type,
        isValid: false,
        error: error.message,
      });
    }
  }

  schemaPacketCache.set(cacheKey, schemaPacket);
  return schemaPacket;
}

export async function buildSchemaPacketAsync(dataset, options = {}) {
  if (!dataset || !Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    throw new Error("Invalid dataset");
  }

  const sampleSize = Number(options.sampleSize || DEFAULT_SCHEMA_SAMPLE_SIZE);
  const cacheKey = buildDatasetCacheKey(dataset, sampleSize);

  if (schemaPacketCache.has(cacheKey)) {
    return schemaPacketCache.get(cacheKey);
  }

  if (asyncSchemaPacketCache.has(cacheKey)) {
    return asyncSchemaPacketCache.get(cacheKey);
  }

  const packetPromise = (async () => {
    const sampledRows = sampleRowsForSchema(dataset.rows, sampleSize);
    const schemaPacket = createSchemaPacketSkeleton(dataset, sampledRows);
    const analyzedColumns = await analyzeColumnsAsync(dataset.columns, sampledRows);
    schemaPacket.columns = sortColumnsByDatasetOrder(analyzedColumns, dataset.columns);
    schemaPacketCache.set(cacheKey, schemaPacket);
    return schemaPacket;
  })();

  asyncSchemaPacketCache.set(cacheKey, packetPromise);

  try {
    return await packetPromise;
  } finally {
    asyncSchemaPacketCache.delete(cacheKey);
  }
}

/**
 * Format schema as text for AI
 */
export function formatSchemaForPrompt(schemaPacket) {
  let text = `DATASET: "${schemaPacket.name}"\n`;
  text += `ROWS: ${schemaPacket.rowCount}\n`;
  text += `COLUMNS: ${schemaPacket.columnCount}\n\n`;
  text += `SCHEMA_SAMPLE_ROWS: ${schemaPacket.sampledRowCount || schemaPacket.rowCount}\n\n`;
  text += "COLUMN DEFINITIONS:\n";

  for (const col of schemaPacket.columns) {
    if (!col.isValid) {
      text += `\n${col.name} (${col.type}): [INVALID - ${col.error || col.reason}]\n`;
      continue;
    }

    text += `\n${col.name} (${col.type}):\n`;

    if (col.type === "numeric") {
      text += `  Range: ${col.min} to ${col.max}\n`;
      text += `  Mean: ${col.mean}, Median: ${col.median}\n`;
      text += `  Values: ${col.validCount} valid, ${col.nullCount} nulls\n`;
      text += `  Unique: ${col.uniqueCount}\n`;
    } else {
      text += `  Unique: ${col.uniqueCount}, Nulls: ${col.nullCount}\n`;
      text += `  Top values: ${Object.entries(col.topValues)
        .slice(0, 3)
        .map(([key, value]) => `${key}(${value})`)
        .join(", ")}\n`;
    }
  }

  return text;
}

/**
 * Validate columns exist in schema
 */
export function validateColumnsExist(mentionedColumns, schemaPacket) {
  if (!Array.isArray(mentionedColumns)) {
    throw new Error("mentionedColumns must be an array");
  }

  const validColumns = new Set(
    schemaPacket.columns.filter((column) => column.isValid).map((column) => column.name),
  );

  const invalidColumns = [];
  for (const col of mentionedColumns) {
    if (!validColumns.has(col)) {
      invalidColumns.push(col);
    }
  }

  if (invalidColumns.length > 0) {
    throw new Error(
      `Invalid columns: ${invalidColumns.join(", ")}. Valid: ${Array.from(validColumns).join(", ")}`,
    );
  }
}
