import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface UploadedDataset {
  id: string;
  records: Record<string, string>[];
  columns: string[];
  fileName: string;
  uploadedAt: string;
}

interface DataStoreValue {
  datasets: UploadedDataset[];       // 업로드된 파일 전체 목록
  activeId: string | null;           // 현재 선택된 파일 ID
  dataset: UploadedDataset | null;   // activeId에 해당하는 파일
  addDataset: (data: Omit<UploadedDataset, 'id'>) => void;
  removeDataset: (id: string) => void;
  setActiveId: (id: string) => void;
}

const STORAGE_KEY = 'jd-datasets';
const ACTIVE_KEY = 'jd-active-id';

function loadFromStorage(): { datasets: UploadedDataset[]; activeId: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const datasets: UploadedDataset[] = raw ? JSON.parse(raw) : [];
    const storedActive = localStorage.getItem(ACTIVE_KEY);
    const activeId = datasets.some((d) => d.id === storedActive)
      ? storedActive
      : (datasets[0]?.id ?? null);
    return { datasets, activeId };
  } catch {
    return { datasets: [], activeId: null };
  }
}

function persistToStorage(datasets: UploadedDataset[], activeId: string | null) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
    localStorage.setItem(ACTIVE_KEY, activeId ?? '');
  } catch {
    // 용량 초과 시 무시 (대용량 파일은 새로고침 후 재업로드 필요)
  }
}

const DataStoreContext = createContext<DataStoreValue | null>(null);

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const init = loadFromStorage();
  const [datasets, setDatasets] = useState<UploadedDataset[]>(init.datasets);
  const [activeId, setActiveIdState] = useState<string | null>(init.activeId);

  const dataset = datasets.find((d) => d.id === activeId) ?? datasets[0] ?? null;

  useEffect(() => {
    persistToStorage(datasets, activeId);
  }, [datasets, activeId]);

  function addDataset(data: Omit<UploadedDataset, 'id'>) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next: UploadedDataset = { ...data, id };
    setDatasets((prev) => [...prev, next]);
    setActiveIdState(id);
  }

  function removeDataset(id: string) {
    setDatasets((prev) => {
      const next = prev.filter((d) => d.id !== id);
      if (activeId === id) {
        setActiveIdState(next[0]?.id ?? null);
      }
      return next;
    });
  }

  function setActiveId(id: string) {
    setActiveIdState(id);
  }

  return (
    <DataStoreContext.Provider
      value={{ datasets, activeId, dataset, addDataset, removeDataset, setActiveId }}
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
