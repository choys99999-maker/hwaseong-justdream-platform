import { useMemo } from 'react';
import { Folder } from 'lucide-react';
import { useDataStore } from '../../store/dataStore';
import { deriveRegions, formatRegions, summarizeTypes } from '../../utils/submission';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const { datasets, activeId, setActiveId } = useDataStore();

  // 목록과 마찬가지로 파일명이 아니라 지역·자료 유형으로 고르게 한다.
  const options = useMemo(
    () =>
      datasets.map((d) => {
        const types = summarizeTypes(d)
          .map((t) => t.label)
          .join(' · ');
        return {
          id: d.id,
          label: `${formatRegions(deriveRegions(d))}${types ? ` · ${types}` : ''}`,
        };
      }),
    [datasets],
  );

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>

      {datasets.length >= 2 && (
        <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300 focus-within:ring-2 focus-within:ring-teal-500">
          <Folder size={16} className="text-teal-500" />
          <span className="sr-only">열람 중인 자료</span>
          <select
            value={activeId ?? ''}
            onChange={(e) => setActiveId(e.target.value)}
            className="cursor-pointer bg-transparent pr-1 text-sm text-slate-700 focus:outline-none"
          >
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </header>
  );
}
