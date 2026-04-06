import { createContext } from "react";
import { ChatMessage, Dataset } from "@/features/data/model/dataStore";

export interface DataContextType {
  dataset: Dataset | null;
  chatMessages: ChatMessage[];
  isProcessing: boolean;
  isHydrating: boolean;
  apiError: string | null;
  uploadFile: (file: File) => Promise<void>;
  loadDemo: () => Promise<void>;
  sendChatQuery: (query: string) => Promise<void>;
  updateDatasetCell: (rowId: number, column: string, value: unknown) => Promise<void>;
  retryHydrate: () => Promise<void>;
}

export const DataContext = createContext<DataContextType | null>(null);
