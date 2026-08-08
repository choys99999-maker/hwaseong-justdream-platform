import { ArrowLeft, Check, MinusCircle, TriangleAlert } from 'lucide-react';
import { getColumnsForType } from '../../utils/excel/schema';
import { displayCellValue } from '../../utils/submission';
import type {
  PlatformColumnKey,
  SheetConvertResult,
  SheetParseResult,
} from '../../types/upload';

/** 변환 결과 표에 보여줄 줄 수. */
const PREVIEW_ROWS = 5;

interface Props {
  sheet: SheetParseResult;
  result: SheetConvertResult | undefined;
  mappings: Record<string, PlatformColumnKey | null>;
}

/**
 * 저장 직전에 "실제로 저장될 모양"을 보여준다.
 * 원본 미리보기만으로는 어떤 열이 어떤 항목이 되는지, 값이 어떻게 바뀌는지 알 수 없다.
 * 사용자가 이 화면을 보고 확인한 뒤에만 저장으로 넘어간다.
 */
export default function ConversionPreview({ sheet, result, mappings }: Props) {
  const defs = getColumnsForType(sheet.sheetType);

  // 지금 연결 상태 기준으로 다시 센다. (사용자가 직접 고친 것도 반영되도록)
  const sourceByKey = new Map<PlatformColumnKey, string>();
  for (const [column, key] of Object.entries(mappings)) {
    if (key && !sourceByKey.has(key)) sourceByKey.set(key, column);
  }

  const mappedColumns = Object.values(mappings).filter(Boolean).length;
  const ignored = sheet.columnDiagnostics.filter(
    (d) => d.status === 'ignored' && !mappings[d.name],
  );
  const unrecognized = sheet.columnDiagnostics.filter(
    (d) => !mappings[d.name] && d.status !== 'ignored',
  );
  const suggested = sheet.columnDiagnostics.filter(
    (d) => mappings[d.name] && d.status === 'suggested' && mappings[d.name] === d.mapped,
  );

  const activeDefs = defs.filter((def) => sourceByKey.has(def.key));
  const rows = (result?.records ?? []).slice(0, PREVIEW_ROWS);

  return (
    <div className="space-y-5">
      {/* ── 인식 요약: 몇 개를 읽었고 몇 개가 남았는지 항상 숫자로 ── */}
      <div>
        <p className="text-sm text-slate-700">
          <span className="font-semibold text-slate-900">
            {sheet.columns.length}개 열 중 {mappedColumns}개 인식
          </span>
          {unrecognized.length > 0 && (
            <span className="font-semibold text-amber-700"> · {unrecognized.length}개 확인 필요</span>
          )}
          {ignored.length > 0 && <span className="text-slate-400"> · {ignored.length}개 저장 안 함</span>}
        </p>
      </div>

      {unrecognized.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
            <TriangleAlert size={15} /> 아직 연결하지 않은 열이 있습니다
          </p>
          <ul className="mt-2 space-y-1">
            {unrecognized.map((diag) => (
              <li key={diag.name} className="text-sm text-amber-900">
                <span className="font-medium">{diag.name}</span>
                <span className="text-amber-700"> ({diag.letter}열) — {diag.reason}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">
            이 열의 값은 저장되지 않습니다. 필요하면 아래 "열 연결 확인·수정"에서 지정해 주세요.
          </p>
        </div>
      )}

      {suggested.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">비슷해 보여 자동으로 연결한 열입니다</p>
          <ul className="mt-2 space-y-1">
            {suggested.map((diag) => (
              <li key={diag.name} className="text-sm text-amber-900">
                <span className="font-medium">{diag.name}</span> → {' '}
                {defs.find((d) => d.key === diag.mapped)?.label ?? diag.mapped}
                <span className="text-amber-700"> — {diag.reason}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-700">맞는지 확인해 주세요.</p>
        </div>
      )}

      {/* ── 어떤 열이 어떤 항목이 되는지 ── */}
      <div>
        <p className="text-xs font-medium text-slate-400">인식 결과</p>
        <ul className="mt-2 grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
          {activeDefs.map((def) => (
            <li key={def.key} className="flex items-baseline gap-2 text-sm">
              <Check size={13} className="shrink-0 translate-y-0.5 text-teal-500" />
              <span className="font-medium text-slate-800">{def.label}</span>
              <ArrowLeft size={13} className="shrink-0 translate-y-0.5 text-slate-300" />
              <span className="truncate text-slate-500">{sourceByKey.get(def.key)}</span>
            </li>
          ))}
        </ul>
        {ignored.length > 0 && (
          <ul className="mt-2 space-y-1">
            {ignored.map((diag) => (
              <li key={diag.name} className="flex items-baseline gap-2 text-sm text-slate-400">
                <MinusCircle size={13} className="shrink-0 translate-y-0.5" />
                <span>{diag.name}</span>
                <span className="truncate text-xs">— {diag.reason}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

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

      {/* ── 실제로 저장될 값 ── */}
      <div>
        <p className="text-xs font-medium text-slate-400">
          저장될 내용 {result ? `(전체 ${result.records.length.toLocaleString()}건 중 앞 ${rows.length}건)` : ''}
        </p>
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
          {activeDefs.length === 0 || rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">저장할 내용이 없습니다.</p>
          ) : (
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-right text-xs font-medium text-slate-400">
                    원본 행
                  </th>
                  {activeDefs.map((def) => (
                    <th
                      key={def.key}
                      scope="col"
                      className="whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-600"
                    >
                      {def.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((record, i) => (
                  <tr key={i} className="even:bg-slate-50/50">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                      {result?.sourceRowNumbers[i]}
                    </td>
                    {activeDefs.map((def) => {
                      const value = record[def.key];
                      const text = value === undefined ? '' : String(value);
                      return (
                        <td
                          key={def.key}
                          className="border-b border-slate-100 px-4 py-2 align-top text-slate-700"
                        >
                          <span className="block max-w-[220px] truncate">
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
        <p className="mt-2 text-xs text-slate-400">
          이름·생년월일·주소는 화면에서만 가려서 보여줍니다. 저장되는 값은 원본 그대로입니다.
        </p>
      </div>
    </div>
  );
}
