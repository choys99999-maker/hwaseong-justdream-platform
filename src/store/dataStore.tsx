import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { dbGetAll, dbPut, dbDelete } from './db';

export interface SheetEntry {
  sheetName: string;
  sheetType: string;
  columns: string[];
  records: Record<string, string>[];
}

export interface UploadedDataset {
  id: string;
  records: Record<string, string>[];
  columns: string[];
  fileName: string;
  uploadedAt: string;
  sheetName?: string;
  sheetType?: string;
  sheets?: SheetEntry[];
  /** 저장 시점에 검증이 잡아낸 값 오류 건수. 예전에 저장된 자료에는 없다. */
  issueCount?: number;
}

interface DataStoreValue {
  datasets: UploadedDataset[];
  activeId: string | null;
  dataset: UploadedDataset | null;
  isLoading: boolean;
  addDataset: (data: Omit<UploadedDataset, 'id'>) => void;
  removeDataset: (id: string) => void;
  clearAll: () => void;
  setActiveId: (id: string) => void;
}

const ACTIVE_KEY = 'jd-active-id';

const DataStoreContext = createContext<DataStoreValue | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [datasets, setDatasets] = useState<UploadedDataset[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dbGetAll()
      .then((loaded) => {
        const sorted = [...loaded].sort((a, b) => a.uploadedAt.localeCompare(b.uploadedAt));
        setDatasets(sorted);
        const storedActive = localStorage.getItem(ACTIVE_KEY);
        const valid = sorted.find((d) => d.id === storedActive)?.id ?? sorted[0]?.id ?? null;
        setActiveIdState(valid);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const dataset = datasets.find((d) => d.id === activeId) ?? datasets[0] ?? null;

  function addDataset(data: Omit<UploadedDataset, 'id'>) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: UploadedDataset = { ...data, id };
    setDatasets((prev) => [...prev, next]);
    setActiveIdState(id);
    localStorage.setItem(ACTIVE_KEY, id);
    dbPut(next).catch(() => {});
  }

  function removeDataset(id: string) {
    setDatasets((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (activeId === id) {
        const newActive = next[0]?.id ?? null;
        setActiveIdState(newActive);
        localStorage.setItem(ACTIVE_KEY, newActive ?? '');
      }
      return next;
    });
    dbDelete(id).catch(() => {});
  }

  function clearAll() {
    for (const d of datasets) {
      dbDelete(d.id).catch(() => {});
    }
    setDatasets([]);
    setActiveIdState(null);
    localStorage.removeItem(ACTIVE_KEY);
  }

  function setActiveId(id: string) {
    setActiveIdState(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  return (
    <DataStoreContext.Provider
      value={{ datasets, activeId, dataset, isLoading, addDataset, removeDataset, clearAll, setActiveId }}
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

export function findCol(columns: string[], pattern: RegExp): string | null {
  return columns.find((c) => pattern.test(c)) ?? null;
}

export interface DatasetView {
  records: Record<string, string>[];
  columns: string[];
}

export function resolveSheet(dataset: UploadedDataset, columnPattern: RegExp): DatasetView {
  if (dataset.sheets && dataset.sheets.length > 0) {
    const match = dataset.sheets.find((s) => findCol(s.columns, columnPattern));
    if (match) return { records: match.records, columns: match.columns };
  }
  return { records: dataset.records, columns: dataset.columns };
}
