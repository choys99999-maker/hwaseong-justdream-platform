import { Check } from 'lucide-react';
import { getColumnsForType } from '../../utils/excel/schema';
import { displayCellValue } from '../../utils/submission';
import type { PlatformColumnKey, SheetConvertResult, SheetType } from '../../types/upload';

interface Props {
  sheetType: SheetType;
  result: SheetConvertResult | undefined;
  mappings: Record<string, PlatformColumnKey | null>;
}

/**
 * "저장될 내용" 탭 — 실제로 DB에 들어갈 값만 사람이 읽기 쉽게 보여준다.
 * 인식/미인식 진단(무엇이 왜 확인 필요한지)은 DataUploadPage의 확인 패널이 따로 맡는다.
 * 여기서 또 보여주면 같은 정보를 두 번 설명하게 된다.
 */
export default function ConversionPreview({ sheetType, result, mappings }: Props) {
  const defs = getColumnsForType(sheetType);

  const sourceByKey = new Map<PlatformColumnKey, string>();
  for (const [column, key] of Object.entries(mappings)) {
    if (key && !sourceByKey.has(key)) sourceByKey.set(key, column);
  }
  const activeDefs = defs.filter((def) => sourceByKey.has(def.key));
  const rows = result?.records ?? [];

  return (
    <div className="space-y-3">
      {result && result.totalsChecks.length > 0 && result.totalsChecks.every((c) => c.matches) && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">
          <Check size={14} className="shrink-0" />
          파일에 적힌 합계와 읽은 값의 합이 일치합니다 ({result.totalsChecks.length}개 항목 검산)
        </p>
      )}

      {result?.filledRegion && (
        <p className="rounded-lg bg-slate-50 px-4 py-2.5 text-sm text-slate-600">
          지역 열이 없어 표 위 제목에서 찾은 <span className="font-semibold">{result.filledRegion}</span>
          을(를) 모든 행의 지역으로 채웠습니다.
        </p>
      )}

      <div className="max-h-[440px] overflow-auto rounded-lg border border-slate-200">
        {activeDefs.length === 0 || rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-400">저장할 내용이 없습니다.</p>
        ) : (
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                {activeDefs.map((def) => (
                  <th
                    key={def.key}
                    scope="col"
                    className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-600"
                  >
                    {def.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((record, i) => (
                <tr key={i} className="even:bg-slate-50/50">
                  {activeDefs.map((def) => {
                    const value = record[def.key];
                    const text = value === undefined ? '' : String(value);
                    return (
                      <td key={def.key} className="border-b border-slate-100 px-4 py-2 align-top text-slate-700">
                        <span className="block max-w-[240px] truncate">
                          {text ? displayCellValue(def.label, text) : <span className="text-slate-300">—</span>}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <p className="text-xs text-slate-400">
          전체 {rows.length.toLocaleString()}건
          {sheetType === 'referral' && ' · 이름·생년월일·주소는 화면에서만 가려서 보여줍니다'}
        </p>
      )}
    </div>
  );
}
