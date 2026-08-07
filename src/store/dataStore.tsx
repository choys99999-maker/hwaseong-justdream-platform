import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { dbGetAll, dbPut, dbDelete } from './db';
import { PLATFORM_FIELDS } from '../config/platformFields';

export interface UploadedDataset {
  id: string;
  records: Record<string, string>[];
  columns: string[];
  fileName: string;
  uploadedAt: string;
  /** 항목 이름 → 엑셀 열 이름. 업로드할 때 자동으로 연결하거나 사용자가 직접 고른 값. */
  fieldMap?: Record<string, string>;
}

interface DataStoreValue {
  datasets: UploadedDataset[];
  activeId: string | null;
  dataset: UploadedDataset | null;
  isLoading: boolean;
  addDataset: (data: Omit<UploadedDataset, 'id'>) => void;
  removeDataset: (id: string) => void;
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

  function setActiveId(id: string) {
    setActiveIdState(id);
    localStorage.setItem(ACTIVE_KEY, id);
  }

  return (
    <DataStoreContext.Provider
      value={{ datasets, activeId, dataset, isLoading, addDataset, removeDataset, setActiveId }}
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

/**
 * 항목에 연결된 엑셀 열 이름을 돌려준다.
 * 업로드할 때 저장한 연결이 있으면 그것을 쓰고, 없으면 기존처럼 이름 규칙으로 찾는다.
 */
export function getField(dataset: UploadedDataset | null, fieldId: string): string | null {
  if (!dataset) return null;

  // 업로드할 때 정한 연결이 있으면 그것이 우선이다.
  // 사용자가 "가져오지 않음"으로 둔 항목은 빈 값으로 저장되므로 규칙 추측으로 되돌리지 않는다.
  const mapped = dataset.fieldMap?.[fieldId];
  if (mapped !== undefined) return mapped && dataset.columns.includes(mapped) ? mapped : null;

  const field = PLATFORM_FIELDS.find((f) => f.id === fieldId);
  return field ? findCol(dataset.columns, field.pattern) : null;
}
