import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "..", "data");

mkdirSync(dataDir, { recursive: true });

const databasePath = path.join(dataDir, "insightflow.sqlite");
const localDatasetDir = path.join(dataDir, "local-datasets");
mkdirSync(localDatasetDir, { recursive: true });

if (!existsSync(databasePath)) {
  console.log(`[DB] Creating database at: ${databasePath}`);
}
const db = new DatabaseSync(databasePath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    column_count INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dataset_columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    sample_json TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS dataset_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dataset_id TEXT NOT NULL,
    row_index INTEGER NOT NULL,
    row_json TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sql_text TEXT,
    chart_json TEXT,
    insights_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_dataset_columns_dataset_id ON dataset_columns(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_dataset_rows_dataset_id ON dataset_rows(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_chat_messages_dataset_id ON chat_messages(dataset_id);
`);

// Migration: Add new columns for local datasets support
try {
  db.exec("ALTER TABLE datasets ADD COLUMN is_local INTEGER DEFAULT 0");
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec("ALTER TABLE datasets ADD COLUMN local_dataset_id TEXT");
} catch (e) {
  // Column might already exist, ignore error
}

try {
  db.exec("CREATE INDEX IF NOT EXISTS idx_datasets_local_id ON datasets(local_dataset_id)");
} catch (e) {
  // Index might already exist, ignore error
}

for (const statement of [
  "ALTER TABLE datasets ADD COLUMN original_file_path TEXT",
  "ALTER TABLE datasets ADD COLUMN optimized_file_path TEXT",
  "ALTER TABLE datasets ADD COLUMN optimized_format TEXT",
]) {
  try {
    db.exec(statement);
  } catch (e) {
    // Column might already exist, ignore error
  }
}

const parseJson = (value, fallback) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const withTransaction = (work) => {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
};

const setMeta = db.prepare(`
  INSERT INTO meta (key, value)
  VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const getMeta = db.prepare("SELECT value FROM meta WHERE key = ?");
const insertDataset = db.prepare(`
  INSERT INTO datasets (
    id,
    name,
    source_type,
    file_name,
    uploaded_at,
    row_count,
    column_count,
    original_file_path,
    optimized_file_path,
    optimized_format
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const insertDatasetColumn = db.prepare(`
  INSERT INTO dataset_columns (dataset_id, name, type, sample_json)
  VALUES (?, ?, ?, ?)
`);
const insertDatasetRow = db.prepare(`
  INSERT INTO dataset_rows (dataset_id, row_index, row_json)
  VALUES (?, ?, ?)
`);
const insertChatMessage = db.prepare(`
  INSERT INTO chat_messages (id, dataset_id, role, content, sql_text, chart_json, insights_json, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
const getDatasetRecord = db.prepare("SELECT * FROM datasets WHERE id = ?");
const listDatasetRecords = db.prepare("SELECT * FROM datasets ORDER BY uploaded_at DESC");
const getDatasetColumns = db.prepare("SELECT name, type, sample_json FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC");
const getDatasetRows = db.prepare("SELECT id, row_index, row_json FROM dataset_rows WHERE dataset_id = ? ORDER BY row_index ASC");
const getChatMessageRows = db.prepare("SELECT * FROM chat_messages WHERE dataset_id = ? ORDER BY created_at ASC");
const getDatasetRow = db.prepare("SELECT id, row_json FROM dataset_rows WHERE dataset_id = ? AND id = ?");
const updateDatasetRow = db.prepare("UPDATE dataset_rows SET row_json = ? WHERE dataset_id = ? AND id = ?");
const deleteDatasetById = db.prepare("DELETE FROM datasets WHERE id = ?");

const mapDataset = (datasetRecord) => {
  if (!datasetRecord) return null;

  const columns = getDatasetColumns.all(datasetRecord.id).map((column) => ({
    name: column.name,
    type: column.type,
    sample: parseJson(column.sample_json, []),
  }));

  const rows = getDatasetRows.all(datasetRecord.id).map((row) => ({
    __rowId: row.id,
    ...parseJson(row.row_json, {}),
  }));

  return {
    id: datasetRecord.id,
    name: datasetRecord.name,
    columns,
    rows,
    uploadedAt: datasetRecord.uploaded_at,
    rowCount: datasetRecord.row_count,
    sourceType: datasetRecord.source_type,
    fileName: datasetRecord.file_name,
    originalFilePath: datasetRecord.original_file_path || undefined,
    optimizedFilePath: datasetRecord.optimized_file_path || undefined,
    optimizedFormat: datasetRecord.optimized_format || undefined,
    metadata: {
      originalFilePath: datasetRecord.original_file_path || undefined,
      optimizedFilePath: datasetRecord.optimized_file_path || undefined,
      optimizedFormat: datasetRecord.optimized_format || undefined,
      rowCount: datasetRecord.row_count,
    },
  };
};

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeDatasetCsvCache(datasetId, columns = [], rows = []) {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(columns) || !columns.length) {
    return null;
  }

  const filePath = path.join(localDatasetDir, `${datasetId}.csv`);
  const names = columns.map((column) => column.name || String(column)).filter(Boolean);
  const header = names.map(csvEscape).join(",");
  const body = rows.map((row) => names.map((name) => csvEscape(row[name])).join(",")).join("\n");
  writeFileSync(filePath, `${header}\n${body}\n`, "utf8");
  return filePath;
}

export const createDataset = ({
  name,
  fileName = null,
  columns,
  rows,
  sourceType = "upload",
  originalFilePath = null,
  optimizedFilePath = null,
  optimizedFormat = null,
}) => {
  const datasetId = randomUUID();
  const uploadedAt = new Date().toISOString();
  const cleanRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "__rowId")),
  );
  const csvCachePath = optimizedFilePath || originalFilePath || writeDatasetCsvCache(datasetId, columns, cleanRows);
  const resolvedOptimizedFormat = optimizedFormat || (csvCachePath ? "csv" : null);

  return withTransaction(() => {
    insertDataset.run(
      datasetId,
      name,
      sourceType,
      fileName,
      uploadedAt,
      finalRowCount,
      columns.length,
      originalFilePath || csvCachePath,
      csvCachePath,
      resolvedOptimizedFormat,
    );

    // Save extra local fields if table supports them
    try {
      if (isLocal) {
        db.prepare("UPDATE datasets SET is_local = 1, local_dataset_id = ? WHERE id = ?").run(localDatasetId || datasetId, datasetId);
      }
    } catch (e) {
      // Ignore if table columns do not exist
    }

    columns.forEach((column) => {
      insertDatasetColumn.run(
        datasetId,
        column.name,
        column.type,
        JSON.stringify(column.sample ?? []),
      );
    });

    cleanRows.forEach((row, index) => {
      insertDatasetRow.run(datasetId, index, JSON.stringify(row));
    });

    setMeta.run("current_dataset_id", datasetId);
    return getDatasetById(datasetId);
  });
};

export const getDatasetById = (datasetId) => {
  const sqliteDataset = mapDataset(getDatasetRecord.get(datasetId));
  if (sqliteDataset) return sqliteDataset;

  const e2eStore = globalThis.__INSIGHTFLOW_E2E_STORE__;
  if (e2eStore && e2eStore.datasets && e2eStore.datasets.has(datasetId)) {
    return e2eStore.datasets.get(datasetId);
  }
  return null;
};

const mapDatasetLight = (datasetRecord) => {
  if (!datasetRecord) return null;
  return {
    id: datasetRecord.id,
    name: datasetRecord.name,
    uploadedAt: datasetRecord.uploaded_at,
    rowCount: datasetRecord.row_count,
    columnCount: datasetRecord.column_count,
    sourceType: datasetRecord.source_type,
    fileName: datasetRecord.file_name,
    originalFilePath: datasetRecord.original_file_path || undefined,
    optimizedFilePath: datasetRecord.optimized_file_path || undefined,
    optimizedFormat: datasetRecord.optimized_format || undefined,
  };
};

export const listDatasets = () => {
  const persisted = listDatasetRecords.all().map(mapDatasetLight);

  const e2eStore = globalThis.__INSIGHTFLOW_E2E_STORE__;
  if (e2eStore && e2eStore.datasets) {
    const e2eList = Array.from(e2eStore.datasets.values()).map(d => ({
      id: d.id,
      name: d.name,
      uploadedAt: d.createdAt || d.uploadedAt,
      rowCount: d.rowCount || d.rows?.length || 0,
      columnCount: d.columnCount || d.columns?.length || 0,
      sourceType: d.sourceType,
      fileName: d.fileName,
    }));
    for (const d of e2eList) {
      if (!persisted.some(p => p.id === d.id)) {
        persisted.push(d);
      }
    }
  }

  return persisted;
};

export const getCurrentDatasetId = () => getMeta.get("current_dataset_id")?.value ?? null;

export const getCurrentDataset = () => {
  const currentDatasetId = getCurrentDatasetId();
  if (currentDatasetId) {
    const d = getDatasetById(currentDatasetId);
    if (d) return d;
  }

  const e2eStore = globalThis.__INSIGHTFLOW_E2E_STORE__;
  if (e2eStore && e2eStore.currentDatasetId) {
    return getDatasetById(e2eStore.currentDatasetId);
  }

  return null;
};

export const getChatMessages = (datasetId) =>
  getChatMessageRows.all(datasetId).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    sql: message.sql_text ?? undefined,
    chart: parseJson(message.chart_json, undefined),
    insights: parseJson(message.insights_json, []),
    timestamp: message.created_at,
  }));

export const saveChatMessages = (datasetId, messages) => {
  withTransaction(() => {
    setMeta.run("current_dataset_id", datasetId);

    messages.forEach((message) => {
      insertChatMessage.run(
        message.id,
        datasetId,
        message.role,
        message.content,
        message.sql ?? null,
        message.chart ? JSON.stringify(message.chart) : null,
        message.insights ? JSON.stringify(message.insights) : null,
        message.timestamp,
      );
    });
  });
};

export const saveChatMessage = (datasetId, message) => {
  saveChatMessages(datasetId, [message]);
};

export const clearChatMessages = (datasetId) => {
  db.prepare("DELETE FROM chat_messages WHERE dataset_id = ?").run(datasetId);
};

export const patchDatasetRow = ({ datasetId, rowId, column, value }) => {
  const existingRow = getDatasetRow.get(datasetId, rowId);
  if (!existingRow) {
    return null;
  }

  const nextRow = {
    ...parseJson(existingRow.row_json, {}),
    [column]: value,
  };

  updateDatasetRow.run(JSON.stringify(nextRow), datasetId, rowId);
  return getDatasetById(datasetId);
};

export const deleteDataset = (datasetId) => {
  const existing = getDatasetRecord.get(datasetId);
  if (!existing) {
    return false;
  }

  withTransaction(() => {
    deleteDatasetById.run(datasetId);
    if (getCurrentDatasetId() === datasetId) {
      setMeta.run("current_dataset_id", "");
    }
  });

  return true;
};

export const getDatabasePath = () => databasePath;
