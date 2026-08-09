import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, MinusCircle } from 'lucide-react';
import type { ColumnDiagnosis, PlatformColumnDef, PlatformColumnKey } from '../../types/upload';

interface ColumnMapperProps {
  diagnostics: ColumnDiagnosis[];
  mappings: Record<string, PlatformColumnKey | null>;
  columnDefs: PlatformColumnDef[];
  onChange: (excelCol: string, target: PlatformColumnKey | null) => void;
}

/** 자동 인식 결과와 지금 연결 상태가 다르면 "수동"으로 본다. */
function statusBadge(diag: ColumnDiagnosis, current: PlatformColumnKey | null) {
  if (current !== diag.mapped) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
        직접 지정
      </span>
    );
  }
  switch (diag.status) {
    case 'auto':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
          <CheckCircle2 size={12} /> 자동 인식
        </span>
      );
    case 'suggested':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          <HelpCircle size={12} /> 추천 · 확인 필요
        </span>
      );
    case 'ignored':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
          <MinusCircle size={12} /> 저장 안 함
        </span>
      );
    case 'duplicate':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          <AlertTriangle size={12} /> 중복 · 확인 필요
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
          <AlertTriangle size={12} /> 확인 필요
        </span>
      );
  }
}

/**
 * 원본 엑셀 열 ↔ 플랫폼 항목 연결표.
 * 인식이 잘 된 파일에서도 열어서 고칠 수 있어야 하므로, 상태와 무관하게 늘 같은 표를 쓴다.
 * 자동으로 붙이지 못한 열도 반드시 한 줄씩 나온다. (조용히 빠지는 열이 없도록)
 */
export default function ColumnMapper({
  diagnostics,
  mappings,
  columnDefs,
  onChange,
}: ColumnMapperProps) {
  const targetCount = new Map<PlatformColumnKey, number>();
  for (const target of Object.values(mappings)) {
    if (target) targetCount.set(target, (targetCount.get(target) ?? 0) + 1);
  }

  const requiredMissing = columnDefs.filter((d) => d.required && !targetCount.has(d.key));

  return (
    <div className="space-y-4">
      {requiredMissing.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-semibold">꼭 필요한 항목이 연결되지 않았습니다:</span>{' '}
            {requiredMissing.map((d) => d.label).join(', ')}
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">원본 엑셀 열</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">플랫폼 항목</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {diagnostics.map((diag) => {
              const current = mappings[diag.name] ?? null;
              const isDuplicate = current !== null && (targetCount.get(current) ?? 0) > 1;
              const needsAttention =
                current === null && (diag.status === 'unmapped' || diag.status === 'duplicate');

              return (
                <tr
                  key={diag.name}
                  className={isDuplicate ? 'bg-red-50/40' : needsAttention ? 'bg-amber-50/30' : ''}
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-700">{diag.name}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-400">{diag.letter}열</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="relative">
                      <select
                        aria-label={`${diag.name} 열을 연결할 플랫폼 항목`}
                        value={current ?? ''}
                        onChange={(e) => onChange(diag.name, (e.target.value as PlatformColumnKey) || null)}
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
                      <p className="mt-1 text-xs text-red-500">이 항목이 다른 열에도 지정되어 있습니다.</p>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {statusBadge(diag, current)}
                    {diag.reason && (
                      <p className="mt-1 max-w-[280px] text-xs leading-relaxed text-slate-400">
                        {diag.reason}
                      </p>
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
