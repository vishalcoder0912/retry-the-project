import { toNumber, isMeaningfulValue } from "@insightflow/shared-analytics";

/**
 * Extract numeric statistics from column
 */
function extractNumericStats(values, columnName) {
  const numbers = [];
  let nullCount = 0;
  let invalidCount = 0;

  for (const val of values) {
    if (!isMeaningfulValue(val)) {
      nullCount++;
      continue;
    }

    const num = toNumber(val);
    if (num === null) {
      invalidCount++;
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

  const variance = numbers.reduce((sum, num) => sum + Math.pow(num - mean, 2), 0) / numbers.length;
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

/**
 * Extract categorical statistics from column
 */
function extractCategoricalStats(values, columnName) {
  const valueCounts = new Map();
  let nullCount = 0;

  for (const val of values) {
    if (!isMeaningfulValue(val)) {
      nullCount++;
      continue;
    }

    const strVal = String(val).trim().substring(0, 100);
    
    if (valueCounts.size >= 100) {
      continue;
    }

    valueCounts.set(strVal, (valueCounts.get(strVal) || 0) + 1);
  }

  const sorted = [...valueCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const topValues = Object.fromEntries(sorted);

  return {
    type: "categorical",
    isValid: true,
    nullCount,
    uniqueCount: valueCounts.size,
    topValues,
    topValuesCount: sorted.length,
  };
}

/**
 * Build schema packet (NO raw data, only metadata)
 */
export function buildSchemaPacket(dataset) {
  if (!dataset || !Array.isArray(dataset.rows) || dataset.rows.length === 0) {
    throw new Error("Invalid dataset");
  }

  const schemaPacket = {
    name: dataset.name || "Unnamed Dataset",
    rowCount: dataset.rows.length,
    columnCount: dataset.columns.length,
    columns: [],
    timestamp: new Date().toISOString(),
  };

  for (const column of dataset.columns) {
    try {
      const columnValues = dataset.rows.map(row => row[column.name]);

      let columnSchema;
      if (column.type === "number") {
        columnSchema = {
          name: column.name,
          ...extractNumericStats(columnValues, column.name),
        };
      } else {
        columnSchema = {
          name: column.name,
          ...extractCategoricalStats(columnValues, column.name),
        };
      }

      schemaPacket.columns.push(columnSchema);
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

  return schemaPacket;
}

/**
 * Format schema as text for AI
 */
export function formatSchemaForPrompt(schemaPacket) {
  let text = `DATASET: "${schemaPacket.name}"\n`;
  text += `ROWS: ${schemaPacket.rowCount}\n`;
  text += `COLUMNS: ${schemaPacket.columnCount}\n\n`;
  text += `COLUMN DEFINITIONS:\n`;

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
        .map(([k, v]) => `${k}(${v})`)
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
    schemaPacket.columns.filter(c => c.isValid).map(c => c.name)
  );

  const invalidColumns = [];
  for (const col of mentionedColumns) {
    if (!validColumns.has(col)) {
      invalidColumns.push(col);
    }
  }

  if (invalidColumns.length > 0) {
    throw new Error(
      `Invalid columns: ${invalidColumns.join(", ")}. Valid: ${Array.from(validColumns).join(", ")}`
    );
  }
}