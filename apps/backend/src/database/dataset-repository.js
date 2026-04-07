import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "..", "data");

mkdirSync(dataDir, { recursive: true });

const databasePath = path.join(dataDir, "insightflow.sqlite");
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
  INSERT INTO datasets (id, name, source_type, file_name, uploaded_at, row_count, column_count)
  VALUES (?, ?, ?, ?, ?, ?, ?)
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
const getDatasetColumns = db.prepare("SELECT name, type, sample_json FROM dataset_columns WHERE dataset_id = ? ORDER BY id ASC");
const getDatasetRows = db.prepare("SELECT id, row_index, row_json FROM dataset_rows WHERE dataset_id = ? ORDER BY row_index ASC");
const getChatMessageRows = db.prepare("SELECT * FROM chat_messages WHERE dataset_id = ? ORDER BY created_at ASC");
const getDatasetRow = db.prepare("SELECT id, row_json FROM dataset_rows WHERE dataset_id = ? AND id = ?");
const updateDatasetRow = db.prepare("UPDATE dataset_rows SET row_json = ? WHERE dataset_id = ? AND id = ?");

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
  };
};

export const createDataset = ({ name, fileName = null, columns, rows, sourceType = "upload" }) => {
  const datasetId = randomUUID();
  const uploadedAt = new Date().toISOString();
  const cleanRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).filter(([key]) => key !== "__rowId")),
  );

  return withTransaction(() => {
    insertDataset.run(
      datasetId,
      name,
      sourceType,
      fileName,
      uploadedAt,
      cleanRows.length,
      columns.length,
    );

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

export const getDatasetById = (datasetId) => mapDataset(getDatasetRecord.get(datasetId));

export const getCurrentDatasetId = () => getMeta.get("current_dataset_id")?.value ?? null;

export const getCurrentDataset = () => {
  const currentDatasetId = getCurrentDatasetId();
  return currentDatasetId ? getDatasetById(currentDatasetId) : null;
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

export const getDatabasePath = () => databasePath;
