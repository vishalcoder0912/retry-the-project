import React, { useCallback, useEffect, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { api, DatasetImportPayload } from '@/features/data/api/dataApi';
import { ChatMessage, Dataset, DatasetCellValue, DatasetRow } from '@/features/data/model/dataStore';
import { DataContext } from '@/features/data/context/data-context-store';

function inferType(values: string[]): 'string' | 'number' | 'date' {
  const sample = values.filter(Boolean).slice(0, 20);
  if (sample.length === 0) return 'string';
  if (sample.every(v => !isNaN(Number(v)))) return 'number';
  if (sample.every(v => !isNaN(Date.parse(v)))) return 'date';
  return 'string';
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to connect to the local API.';

const wait = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeCellValue = (value: unknown): DatasetCellValue => {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  return JSON.stringify(value);
};

const normalizeDatasetRow = (value: unknown): DatasetRow => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, normalizeCellValue(entryValue)]),
  );
};

const normalizeDataset = (dataset: Dataset | null): Dataset | null => {
  if (!dataset) return null;

  return {
    ...dataset,
    uploadedAt: new Date(dataset.uploadedAt),
    rows: Array.isArray(dataset.rows) ? dataset.rows.map(normalizeDatasetRow) : [],
  };
};

const normalizeChatMessage = (message: ChatMessage): ChatMessage => ({
  ...message,
  timestamp: new Date(message.timestamp),
});

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const applyApiState = useCallback((nextDataset: Dataset | null, nextMessages: ChatMessage[]) => {
    setDataset(normalizeDataset(nextDataset));
    setChatMessages(nextMessages.map(normalizeChatMessage));
  }, []);

  const hydrateState = useCallback(async () => {
    setIsHydrating(true);
    setApiError(null);

    try {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const state = await api.getState();
          applyApiState(state.dataset, state.chatMessages);
          setApiError(null);
          return;
        } catch (error) {
          if (attempt === 5) {
            throw error;
          }

          await wait(500 * (attempt + 1));
        }
      }
    } catch (error) {
      setApiError(getErrorMessage(error));
    } finally {
      setIsHydrating(false);
    }
  }, [applyApiState]);

  useEffect(() => {
    void hydrateState();
  }, [hydrateState]);

  const buildDatasetPayload = useCallback((rows: DatasetRow[], fields: string[], fileName: string): DatasetImportPayload => {
    const columns: Array<{
      name: string;
      type: 'string' | 'number' | 'date';
      sample: string[];
    }> = fields.map(name => ({
      name,
      type: inferType(rows.slice(0, 20).map(r => String(r[name] ?? ''))),
      sample: rows.slice(0, 3).map(r => String(r[name] ?? '')),
    }));

    return {
      name: fileName.replace(/\.(csv|xlsx|xls|json)$/i, ''),
      columns: columns,
      rows,
      fileName,
      sourceType: 'upload',
    };
  }, []);

  const importDatasetPayload = useCallback(async (payload: DatasetImportPayload) => {
    try {
      const state = await api.importDataset(payload);
      applyApiState(state.dataset, state.chatMessages);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [applyApiState]);

  const uploadFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      return new Promise<void>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          dynamicTyping: false,
          skipEmptyLines: true,
          complete: async (results) => {
            try {
              const rows = (results.data || []).map(normalizeDatasetRow);
              
              if (rows.length === 0) {
                throw new Error('CSV file contains no data rows');
              }
              
              const fields = results.meta?.fields || [];
              await importDatasetPayload(buildDatasetPayload(rows, fields, file.name));
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          error: (err) => reject(err),
        });
      });
    }

    if (ext === 'json') {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const rows = (Array.isArray(parsed) ? parsed : [parsed]).map(normalizeDatasetRow);
      
      if (rows.length === 0) {
        throw new Error('JSON file contains no data rows');
      }
      
      const fields = Object.keys(rows[0] || {});
      await importDatasetPayload(buildDatasetPayload(rows, fields, file.name));
      return;
    }

    if (ext === 'xlsx' || ext === 'xls') {
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
      
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet).map(normalizeDatasetRow);
      
      if (rows.length === 0) {
        throw new Error('Excel sheet contains no data rows');
      }
      
      const fields = Object.keys(rows[0] || {});
      await importDatasetPayload(buildDatasetPayload(rows, fields, file.name));
      return;
    }

    throw new Error('Unsupported file type');
  }, [buildDatasetPayload, importDatasetPayload]);

  const loadDemo = useCallback(async () => {
    try {
      const state = await api.loadDemo();
      applyApiState(state.dataset, state.chatMessages);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [applyApiState]);

  const sendChatQuery = useCallback(async (query: string) => {
    if (!dataset) return;

    setIsProcessing(true);
    try {
      const response = await api.sendChatQuery(dataset.id, query);
      setChatMessages(prev => [
        ...prev,
        normalizeChatMessage(response.userMessage),
        normalizeChatMessage(response.assistantMessage),
      ]);
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [dataset, setIsProcessing]);

  const updateDatasetCell = useCallback(async (rowId: number, column: string, value: unknown) => {
    if (!dataset) {
      const errorMsg = 'Dataset not available';
      setApiError(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      const response = await api.updateRow(dataset.id, rowId, column, value);
      setDataset(normalizeDataset(response.dataset));
      setApiError(null);
    } catch (error) {
      setApiError(getErrorMessage(error));
      throw error;
    }
  }, [dataset]);

  return (
    <DataContext.Provider value={{
      dataset,
      chatMessages,
      isProcessing,
      isHydrating,
      apiError,
      uploadFile,
      loadDemo,
      sendChatQuery,
      updateDatasetCell,
      retryHydrate: hydrateState,
    }}>
      {children}
    </DataContext.Provider>
  );
};
