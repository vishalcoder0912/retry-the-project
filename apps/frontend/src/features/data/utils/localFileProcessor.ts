import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { DatasetRow } from '@/features/data/model/dataStore';

export interface LocalFileProcessResult {
  columns: Array<{
    name: string;
    type: 'string' | 'number' | 'date';
    sample: string[];
  }>;
  rowCount: number;
  fileName: string;
}

export interface LocalFileChunk {
  data: DatasetRow[];
  chunkIndex: number;
  totalChunks: number;
}

/**
 * Infers data type from sample values
 */
const inferType = (values: string[]): 'string' | 'number' | 'date' => {
  const sample = values.filter(Boolean).slice(0, 20);
  if (sample.length === 0) return 'string';
  if (sample.every(v => !isNaN(Number(v)))) return 'number';
  if (sample.every(v => !isNaN(Date.parse(v)))) return 'date';
  return 'string';
};

/**
 * Normalizes cell value to standard format
 */
const normalizeCellValue = (value: unknown): string | number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return value.trim();
  return String(value);
};

/**
 * Normalizes dataset row
 */
const normalizeDatasetRow = (value: unknown): DatasetRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, normalizeCellValue(entryValue)]),
  );
};

/**
 * Extracts schema from first N rows of data
 */
export const extractSchema = (rows: DatasetRow[], fields: string[]): LocalFileProcessResult['columns'] => {
  return fields.map(name => ({
    name,
    type: inferType(rows.slice(0, 20).map(r => String(r[name] ?? ''))),
    sample: rows.slice(0, 3).map(r => String(r[name] ?? '')),
  }));
};

/**
 * Processes CSV file in chunks
 */
export const processCSVInChunks = (
  file: File,
  onChunk: (chunk: LocalFileChunk) => void,
  chunkSize: number = 1000
): Promise<LocalFileProcessResult> => {
  return new Promise((resolve, reject) => {
    let allRows: DatasetRow[] = [];
    let chunkIndex = 0;

    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      chunk: (results) => {
        const rows = (results.data || []).map(normalizeDatasetRow);
        allRows = allRows.concat(rows);

        onChunk({
          data: rows,
          chunkIndex,
          totalChunks: Math.ceil(results.meta.lines / chunkSize),
        });

        chunkIndex++;
      },
      complete: () => {
        const fields = allRows.length > 0 ? Object.keys(allRows[0]) : [];
        resolve({
          columns: extractSchema(allRows, fields),
          rowCount: allRows.length,
          fileName: file.name,
        });
      },
      error: (err) => reject(err),
    });
  });
};

/**
 * Processes Excel file in chunks
 */
export const processExcelInChunks = async (
  file: File,
  onChunk: (chunk: LocalFileChunk) => void,
  chunkSize: number = 1000
): Promise<LocalFileProcessResult> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Excel file contains no sheets');
  }

  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error('Failed to read Excel sheet');
  }

  const allRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).map(normalizeDatasetRow);
  const fields = allRows.length > 0 ? Object.keys(allRows[0]) : [];

  // Process in chunks
  const totalChunks = Math.ceil(allRows.length / chunkSize);
  for (let i = 0; i < allRows.length; i += chunkSize) {
    const chunk = allRows.slice(i, i + chunkSize);
    onChunk({
      data: chunk,
      chunkIndex: Math.floor(i / chunkSize),
      totalChunks,
    });
  }

  return {
    columns: extractSchema(allRows, fields),
    rowCount: allRows.length,
    fileName: file.name,
  };
};

/**
 * Processes JSON file in chunks
 */
export const processJSONInChunks = async (
  file: File,
  onChunk: (chunk: LocalFileChunk) => void,
  chunkSize: number = 1000
): Promise<LocalFileProcessResult> => {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const allRows = (Array.isArray(parsed) ? parsed : [parsed]).map(normalizeDatasetRow);
  const fields = allRows.length > 0 ? Object.keys(allRows[0]) : [];

  // Process in chunks
  const totalChunks = Math.ceil(allRows.length / chunkSize);
  for (let i = 0; i < allRows.length; i += chunkSize) {
    const chunk = allRows.slice(i, i + chunkSize);
    onChunk({
      data: chunk,
      chunkIndex: Math.floor(i / chunkSize),
      totalChunks,
    });
  }

  return {
    columns: extractSchema(allRows, fields),
    rowCount: allRows.length,
    fileName: file.name,
  };
};

/**
 * Main processor that routes to appropriate format handler
 */
export const processLocalFile = (
  file: File,
  onChunk: (chunk: LocalFileChunk) => void,
  chunkSize: number = 1000
): Promise<LocalFileProcessResult> => {
  const ext = file.name.split('.').pop()?.toLowerCase();

  if (ext === 'csv') {
    return processCSVInChunks(file, onChunk, chunkSize);
  }

  if (ext === 'json') {
    return processJSONInChunks(file, onChunk, chunkSize);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return processExcelInChunks(file, onChunk, chunkSize);
  }

  return Promise.reject(new Error('Unsupported file type'));
};
