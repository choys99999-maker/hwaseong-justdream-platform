import { createContext, useContext, useState, type ReactNode } from 'react';

export interface UploadedDataset {
  records: Record<string, string>[];
  columns: string[];
  fileName: string;
  uploadedAt: string;
}

interface DataStoreValue {
  dataset: UploadedDataset | null;
  setDataset: (data: UploadedDataset) => void;
  clearDataset: () => void;
}

const DataStoreContext = createContext<DataStoreValue | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<UploadedDataset | null>(null);
  return (
    <DataStoreContext.Provider
      value={{ dataset, setDataset, clearDataset: () => setDataset(null) }}
    >
      {children}
    </DataStoreContext.Provider>
  );
}

export function useDataStore(): DataStoreValue {
  const ctx = useContext(DataStoreContext);
  if (!ctx) throw new Error('useDataStore must be used inside DataStoreProvider');
  return ctx;
}

// 열 이름 패턴으로 열 찾기
export function findCol(columns: string[], pattern: RegExp): string | null {
  return columns.find((c) => pattern.test(c)) ?? null;
}
