import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import { sheetTypeLabel } from '../../utils/submission';
import type {
  PlatformColumnKey,
  RawCell,
  SheetParseResult,
  SheetRowsPage,
} from '../../types/upload';

/** 접힌 미리보기에서 보여주는 줄 수. */
const INLINE_ROWS = 5;
/** 전체 화면에서 한 번에 DOM에 올리는 줄 수. 수천 줄을 한꺼번에 그리지 않는다. */
const PAGE_SIZE = 100;

type SheetMappings = Record<string, Record<string, PlatformColumnKey | null>>;

// ── 시트 고르기 ───────────────────────────────────────────
// '작성 안내' 같은 설명 시트는 업무 시트가 아니다. 기본 선택에서 빼고 맨 뒤로 보낸다.
const GUIDE_NAME = /안내|설명|사용법|가이드|읽어|주의사항|목차|표지|서식/;

export function isGuideSheet(sheet: SheetParseResult): boolean {
  return GUIDE_NAME.test(sheet.sheetName) || sheet.columns.length === 0 || sheet.totalRows === 0;
}

/** 실제 데이터가 있는 첫 업무 시트. 없으면 있는 것 중 앞의 것. */
export function pickDefaultSheetName(sheets: SheetParseResult[]): string {
  const business = sheets.filter((s) => !isGuideSheet(s));
  return business[0]?.sheetName ?? sheets[0]?.sheetName ?? '';
}

/** 업무 시트 먼저, 설명 시트는 맨 뒤. */
function orderSheets(sheets: SheetParseResult[]): SheetParseResult[] {
  return [...sheets.filter((s) => !isGuideSheet(s)), ...sheets.filter(isGuideSheet)];
}

/**
 * 탭에 쓰는 짧은 이름. 시트 이름을 그대로 쓰면 길고("8월 주별 실적 보고"),
 * 자료 유형만 쓰면 같은 유형 시트끼리 구분이 안 된다.
 */
function sheetLabel(sheet: SheetParseResult, all: SheetParseResult[]): string {
  const name = sheet.sheetName.trim();
  if (isGuideSheet(sheet)) return name;
  if (name.includes('누계')) return '누계';

  const base = sheetTypeLabel(sheet.sheetType);
  const sameLabel = all.filter(
    (s) =>
      !isGuideSheet(s) &&
      !s.sheetName.includes('누계') &&
      sheetTypeLabel(s.sheetType) === base,
  );
  return sameLabel.length > 1 ? name : base;
}

// ── 값 보여주기 ───────────────────────────────────────────
// 저장되는 값은 건드리지 않는다. 화면에 그릴 때만 읽기 쉽게 바꾼다.

/** 엑셀이 날짜를 숫자로 저장하는 항목들. */
const DATE_KEYS = new Set<PlatformColumnKey>([
  'consultDate',
  'inboundDate',
  'expirationDate',
  'birthDate',
]);
// 1954-08 ~ 2064-04. 이 밖의 숫자는 날짜라고 단정할 수 없으니 그대로 둔다.
const SERIAL_MIN = 20000;
const SERIAL_MAX = 60000;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** 확실히 엑셀 날짜 일련번호일 때만 YYYY.MM.DD로. 아니면 null. */
function excelSerialToDate(value: number): string | null {
  if (!Number.isFinite(value) || value < SERIAL_MIN || value > SERIAL_MAX) return null;
  const date = new Date((Math.floor(value) - 25569) * 86400000);
  if (isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}.${pad2(date.getUTCMonth() + 1)}.${pad2(date.getUTCDate())}`;
}

function displayCell(
  value: RawCell,
  column: string,
  mapping: Record<string, PlatformColumnKey | null>,
): string {
  if (typeof value === 'number') {
    const key = mapping[column];
    if (key && DATE_KEYS.has(key)) {
      const asDate = excelSerialToDate(value);
      if (asDate) return asDate;
    }
    return String(value);
  }
  return String(value ?? '');
}

// ── 원본 행 가져오기 ──────────────────────────────────────
// 워커가 이미 읽어둔 원본 행을 필요한 만큼만 받아 캐시한다.

function useSheetPages(workerRef: React.RefObject<Worker | null>, enabled: boolean) {
  const [pages, setPages] = useState<Record<string, SheetRowsPage>>({});
  /** 이미 받았거나 요청 중인 구간. 탭을 오갈 때 같은 구간을 다시 묻지 않는다. */
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker || !enabled) return;

    const handler = (e: MessageEvent) => {
      const msg = e.data;
      if (msg?.type !== 'preview-rows-done') return;
      setPages((prev) => ({ ...prev, [`${msg.sheetName}#${msg.start}`]: msg as SheetRowsPage }));
    };

    worker.addEventListener('message', handler);
    return () => worker.removeEventListener('message', handler);
  }, [workerRef, enabled]);

  const request = useCallback(
    (sheetName: string, start: number) => {
      if (!sheetName) return;
      const key = `${sheetName}#${start}`;
      if (seenRef.current.has(key)) return;
      seenRef.current.add(key);
      workerRef.current?.postMessage({ type: 'preview-rows', sheetName, start, limit: PAGE_SIZE });
    },
    [workerRef],
  );

  return { pages, request };
}

// ── 표 ────────────────────────────────────────────────────

interface TableProps {
  page: SheetRowsPage;
  mapping: Record<string, PlatformColumnKey | null>;
  rowLimit?: number;
  /** 왼쪽에 엑셀 행 번호를 붙일지 */
  showRowNumbers?: boolean;
}

function PreviewTable({ page, mapping, rowLimit, showRowNumbers = false }: TableProps) {
  const rows = rowLimit ? page.rows.slice(0, rowLimit) : page.rows;

  return (
    <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
      <thead>
        <tr>
          {showRowNumbers && (
            <th className="sticky left-0 top-0 z-30 border-b border-r border-slate-200 bg-slate-100 px-3 py-2.5 text-right text-xs font-medium text-slate-400">
              행
            </th>
          )}
          {page.columns.map((col) => (
            <th
              key={col}
              scope="col"
              className="sticky top-0 z-10 whitespace-nowrap border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-left text-xs font-semibold text-slate-600"
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="even:bg-slate-50/50">
            {showRowNumbers && (
              <td className="sticky left-0 z-20 border-b border-r border-slate-100 bg-white px-3 py-2 text-right text-xs tabular-nums text-slate-300">
                {page.rowNumbers[i]}
              </td>
            )}
            {page.columns.map((col, c) => {
              const text = displayCell(row[c] ?? '', col, mapping);
              return (
                <td
                  key={col}
                  className="border-b border-slate-100 px-4 py-2 align-top text-slate-700"
                >
                  <span className="block max-w-[260px] truncate" title={text || undefined}>
                    {text}
                  </span>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── 시트 탭 ───────────────────────────────────────────────

interface TabsProps {
  sheets: SheetParseResult[];
  selected: string;
  counts: Record<string, number>;
  onSelect: (name: string) => void;
}

function SheetTabs({ sheets, selected, counts, onSelect }: TabsProps) {
  if (sheets.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {sheets.map((sheet) => {
        const active = sheet.sheetName === selected;
        const guide = isGuideSheet(sheet);
        const count = counts[sheet.sheetName];
        return (
          <button
            key={sheet.sheetName}
            type="button"
            onClick={() => onSelect(sheet.sheetName)}
            aria-pressed={active}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              active
                ? 'bg-slate-800 text-white'
                : guide
                  ? 'text-slate-300 hover:bg-slate-50 hover:text-slate-500'
                  : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            <span className="max-w-[200px] truncate align-middle">
              {sheetLabel(sheet, sheets)}
            </span>
            {!guide && count !== undefined && (
              <span
                className={`ml-1.5 tabular-nums ${active ? 'text-white/60' : 'text-slate-400'}`}
              >
                {count.toLocaleString()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── 전체 화면 ─────────────────────────────────────────────

interface ViewerProps {
  fileName: string;
  sheets: SheetParseResult[];
  mappings: SheetMappings;
  counts: Record<string, number>;
  pages: Record<string, SheetRowsPage>;
  request: (sheetName: string, start: number) => void;
  initialSheet: string;
  onClose: () => void;
}

function FullscreenViewer({
  fileName,
  sheets,
  mappings,
  counts,
  pages,
  request,
  initialSheet,
  onClose,
}: ViewerProps) {
  const [sheetName, setSheetName] = useState(initialSheet);
  const [start, setStart] = useState(0);

  const page = pages[`${sheetName}#${start}`];
  const total = page?.totalRows ?? counts[sheetName] ?? 0;

  useEffect(() => {
    request(sheetName, start);
  }, [request, sheetName, start]);

  // 열려 있는 동안은 뒤 화면이 따라 움직이지 않게 한다.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  function selectSheet(name: string) {
    setSheetName(name);
    setStart(0);
  }

  const from = total === 0 ? 0 : start + 1;
  const to = Math.min(start + PAGE_SIZE, total);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${fileName} 내용 보기`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[92vh] w-[95vw] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{fileName}</p>
            <p className="mt-0.5 text-xs text-slate-400">올리기 전 내용 확인 · 읽기 전용</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={16} /> 닫기
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-2.5">
          <SheetTabs
            sheets={sheets}
            selected={sheetName}
            counts={counts}
            onSelect={selectSheet}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {page ? (
            page.rows.length > 0 ? (
              <PreviewTable
                page={page}
                mapping={mappings[sheetName] ?? {}}
                showRowNumbers
              />
            ) : (
              <p className="px-6 py-10 text-sm text-slate-400">보여줄 내용이 없습니다.</p>
            )
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-6 py-3">
          <p className="text-xs tabular-nums text-slate-400">
            {from.toLocaleString()}–{to.toLocaleString()} / 전체 {total.toLocaleString()}줄
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setStart((s) => Math.max(0, s - PAGE_SIZE))}
              disabled={start === 0}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <ChevronLeft size={16} /> 이전
            </button>
            <button
              type="button"
              onClick={() => setStart((s) => (s + PAGE_SIZE < total ? s + PAGE_SIZE : s))}
              disabled={to >= total}
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              다음 <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── 미리보기 ──────────────────────────────────────────────

interface Props {
  sheets: SheetParseResult[];
  fileName: string;
  mappings: SheetMappings;
  workerRef: React.RefObject<Worker | null>;
}

export default function ExcelPreview({ sheets, fileName, mappings, workerRef }: Props) {
  const ordered = useMemo(() => orderSheets(sheets), [sheets]);
  const [selected, setSelected] = useState(() => pickDefaultSheetName(sheets));
  const [fullscreen, setFullscreen] = useState(false);

  const { pages, request } = useSheetPages(workerRef, true);

  // 탭에 줄 수를 같이 보여주려면 시트마다 첫 장이 필요하다. 첫 장은 100줄뿐이라 가볍다.
  useEffect(() => {
    for (const sheet of ordered) {
      if (!isGuideSheet(sheet)) request(sheet.sheetName, 0);
    }
  }, [ordered, request]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const sheet of sheets) {
      map[sheet.sheetName] = pages[`${sheet.sheetName}#0`]?.totalRows ?? sheet.totalRows;
    }
    return map;
  }, [sheets, pages]);

  useEffect(() => {
    request(selected, 0);
  }, [request, selected]);

  const page = pages[`${selected}#0`];

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <SheetTabs sheets={ordered} selected={selected} counts={counts} onSelect={setSelected} />
        <button
          type="button"
          onClick={() => setFullscreen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Maximize2 size={13} /> 전체 화면으로 보기
        </button>
      </div>

      <div className="mt-3 max-h-[260px] overflow-auto rounded-lg border border-slate-200">
        {page ? (
          page.rows.length > 0 ? (
            <PreviewTable page={page} mapping={mappings[selected] ?? {}} rowLimit={INLINE_ROWS} />
          ) : (
            <p className="px-4 py-6 text-sm text-slate-400">보여줄 내용이 없습니다.</p>
          )
        ) : (
          <div className="flex items-center justify-center py-10">
            <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
          </div>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-400">처음 {INLINE_ROWS}건만 보여드려요</p>

      {fullscreen && (
        <FullscreenViewer
          fileName={fileName}
          sheets={ordered}
          mappings={mappings}
          counts={counts}
          pages={pages}
          request={request}
          initialSheet={selected}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}
