import { CheckCircle2, ChevronDown } from 'lucide-react';
import type { PlatformColumnDef, PlatformColumnKey } from '../../types/upload';

interface ColumnMapperProps {
  excelColumns: string[];
  mappings: Record<string, PlatformColumnKey | null>;
  initialMappings: Record<string, PlatformColumnKey | null>;
  columnDefs: PlatformColumnDef[];
  onChange: (excelCol: string, target: PlatformColumnKey | null) => void;
}

export default function ColumnMapper({
  excelColumns,
  mappings,
  initialMappings,
  columnDefs,
  onChange,
}: ColumnMapperProps) {
  const targetCount = new Map<PlatformColumnKey, number>();
  for (const target of Object.values(mappings)) {
    if (target) targetCount.set(target, (targetCount.get(target) ?? 0) + 1);
  }

  const requiredMissing = columnDefs.filter(
    (d) => d.required && !Array.from(targetCount.keys()).includes(d.key),
  );

  return (
    <div className="space-y-4">
      {requiredMissing.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
          <span>
            <span className="font-semibold">필수 항목이 지정되지 않았습니다:</span>{' '}
            {requiredMissing.map((d) => d.label).join(', ')}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                원본 엑셀 열
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                플랫폼 항목
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {excelColumns.map((col) => {
              const current = mappings[col] ?? null;
              const isDuplicate = current !== null && (targetCount.get(current) ?? 0) > 1;
              const isAuto = initialMappings[col] !== null && current === initialMappings[col];

              return (
                <tr key={col} className={isDuplicate ? 'bg-red-50/40' : ''}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">
                    {col}
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <select
                        value={current ?? ''}
                        onChange={(e) =>
                          onChange(col, (e.target.value as PlatformColumnKey) || null)
                        }
                        className={`w-full appearance-none rounded-lg border py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                          isDuplicate
                            ? 'border-red-300 text-red-700'
                            : current
                              ? 'border-teal-300 bg-teal-50/50 text-teal-800'
                              : 'border-slate-300 text-slate-500'
                        }`}
                      >
                        <option value="">사용 안 함</option>
                        {columnDefs.map((def) => (
                          <option key={def.key} value={def.key}>
                            {def.label}
                            {def.required ? ' *' : ''}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                    </div>
                    {isDuplicate && (
                      <p className="mt-1 text-xs text-red-500">
                        이 항목이 다른 열에도 지정되어 있습니다.
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isAuto ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                        <CheckCircle2 size={12} />
                        자동
                      </span>
                    ) : current ? (
                      <span className="text-xs text-slate-400">수동</span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
