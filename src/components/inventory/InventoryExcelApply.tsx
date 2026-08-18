import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronRight, FolderOpen, Upload } from 'lucide-react';
import ColumnMapper from '../upload/ColumnMapper';
import { defaultMapping } from '../../utils/excel/engine';
import { getColumnsForType } from '../../utils/excel/schema';
import type {
  PlatformColumnKey,
  SheetConvertResult,
  SheetParseResult,
} from '../../types/upload';
import type { InventoryUpdateLine } from '../../types/inventoryUpdate';

type Mappings = Record<string, Record<string, PlatformColumnKey | null>>;

interface InventoryExcelApplyProps {
  disabled: boolean;
  onRead: (lines: InventoryUpdateLine[], notice: string | null) => void;
  onCancel: () => void;
}

/** 재고 반영에 쓸 수 있는 시트인지. (물품·재고 서식 = generic) */
function isInventorySheet(sheet: SheetParseResult): boolean {
  return sheet.sheetType === 'generic' && sheet.role !== 'guide' && sheet.columns.length > 0;
}

function itemKey(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, '').toLowerCase();
}

/**
 * 변환 결과를 재고 반영 줄로 옮긴다.
 * 같은 품목이 여러 줄 있으면 마지막 줄이 이긴다 — 조용히 넘기지 않고 사유를 남긴다.
 */
function toLines(
  sheets: SheetParseResult[],
  results: SheetConvertResult[],
): { lines: InventoryUpdateLine[]; skippedNoName: number; duplicated: number } {
  const byItem = new Map<string, InventoryUpdateLine>();
  const seenCount = new Map<string, number>();
  let skippedNoName = 0;

  for (const result of results) {
    const sheet = sheets.find((s) => s.sheetName === result.sheetName);
    if (!sheet || !isInventorySheet(sheet)) continue;

    result.records.forEach((record, i) => {
      const itemName = String(record.itemName ?? '').trim();
      if (!itemName) {
        skippedNoName++;
        return;
      }
      const rowNumber = result.sourceRowNumbers[i];
      const stock = typeof record.stock === 'number' ? record.stock : null;
      const key = itemKey(itemName);
      seenCount.set(key, (seenCount.get(key) ?? 0) + 1);

      byItem.set(key, {
        itemName,
        stock,
        expirationDate:
          typeof record.expirationDate === 'string' ? record.expirationDate : null,
        sourceText: `${result.sheetName} ${rowNumber}행`,
        issue:
          stock === null
            ? `현재재고 값이 비어 있습니다. 직접 입력하거나 이 줄을 빼 주세요.`
            : undefined,
      });
    });
  }

  let duplicated = 0;
  const lines = Array.from(byItem, ([key, line]) => {
    const count = seenCount.get(key) ?? 1;
    if (count <= 1) return line;
    duplicated++;
    return {
      ...line,
      issue: line.issue ?? `같은 품목이 ${count}줄 있어 마지막 줄(${line.sourceText}) 값을 씁니다.`,
    };
  });

  return { lines, skippedNoName, duplicated };
}

/**
 * Excel 일괄 반영.
 *
 * 파싱·열 자동 인식·검증은 전부 기존 업로드 엔진(`workers/excelWorker` + `utils/excel/*`)을
 * 그대로 쓴다. 여기서 하는 일은 그 결과를 **재고 반영 줄**로 옮기고, 인식·검증 결과를
 * 담당자에게 보여주는 것뿐이다. (Excel 을 올리는 길은 이 화면 하나뿐이다)
 */
export default function InventoryExcelApply({
  disabled,
  onRead,
  onCancel,
}: InventoryExcelApplyProps) {
  const [sheets, setSheets] = useState<SheetParseResult[]>([]);
  const [mappings, setMappings] = useState<Mappings>({});
  const [results, setResults] = useState<SheetConvertResult[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showMapper, setShowMapper] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const mappingsRef = useRef<Mappings>({});
  mappingsRef.current = mappings;

  // 기존 업로드 화면과 같은 워커·같은 엔진을 쓴다.
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/excelWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'parse-done') {
        const parsed = msg.sheets as SheetParseResult[];
        const auto: Mappings = {};
        for (const sheet of parsed) auto[sheet.sheetName] = defaultMapping(sheet);
        setSheets(parsed);
        setMappings(auto);
        mappingsRef.current = auto;
        setResults(null);
        setBusy(false);
        setShowMapper(false);
      } else if (msg.type === 'convert-done') {
        setResults(msg.sheets as SheetConvertResult[]);
      } else if (msg.type === 'error') {
        setError(msg.message as string);
        setBusy(false);
      }
    };
    worker.onerror = (e) => {
      setError(`파일을 읽는 중 오류가 발생했습니다: ${e.message}`);
      setBusy(false);
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // 열 연결이 바뀌면 저장될 내용을 다시 만든다. (기존 업로드 화면과 같은 동작)
  useEffect(() => {
    if (sheets.length === 0) return;
    setResults(null);
    const timer = setTimeout(() => {
      workerRef.current?.postMessage({ type: 'convert', sheetMappings: mappingsRef.current });
    }, 120);
    return () => clearTimeout(timer);
  }, [sheets, mappings]);

  function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('.xlsx 또는 .xls 파일만 올릴 수 있습니다.');
      return;
    }
    setError(null);
    setBusy(true);
    setFileName(file.name);
    setSheets([]);
    setResults(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      workerRef.current?.postMessage({ type: 'parse', buffer }, [buffer]);
    };
    reader.onerror = () => {
      setError('파일을 읽는 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setBusy(false);
    };
    reader.readAsArrayBuffer(file);
  }

  const inventorySheets = useMemo(() => sheets.filter(isInventorySheet), [sheets]);
  const activeSheet = inventorySheets[0] ?? null;

  const converted = useMemo(
    () => (results ? toLines(sheets, results) : null),
    [sheets, results],
  );

  /** 이 파일에서 재고로 인식한 열. 담당자가 "제대로 붙었나"를 한눈에 본다. */
  const recognized = useMemo(() => {
    if (!activeSheet) return [];
    const mapping = mappings[activeSheet.sheetName] ?? {};
    const defs = getColumnsForType('generic');
    return Object.entries(mapping)
      .filter(([, key]) => key !== null)
      .map(([column, key]) => ({
        column,
        label: defs.find((d) => d.key === key)?.label ?? String(key),
      }));
  }, [activeSheet, mappings]);

  const errorCount = (results ?? []).reduce((sum, r) => sum + r.errors.length, 0);
  const hasItemColumn = recognized.some((r) => r.label === '품목명');
  const hasStockColumn = recognized.some((r) => r.label === '현재재고');
  const usesFlowColumns = recognized.some(
    (r) => r.label === '입고수량' || r.label === '출고수량',
  );

  function handleNext() {
    if (!converted || converted.lines.length === 0) return;
    const notices: string[] = [`${fileName}에서 ${converted.lines.length}개 품목을 읽었습니다.`];
    if (converted.duplicated > 0) {
      notices.push(`같은 품목이 여러 줄인 품목 ${converted.duplicated}개는 마지막 줄 값을 씁니다.`);
    }
    if (converted.skippedNoName > 0) {
      notices.push(`품목명이 비어 있는 ${converted.skippedNoName}줄은 제외했습니다.`);
    }
    if (errorCount > 0) {
      notices.push(`값을 읽지 못한 칸 ${errorCount}곳은 비워 둡니다.`);
    }
    if (usesFlowColumns) {
      notices.push('입고·출고 열은 이번 반영에 쓰지 않습니다. 현재재고만 반영합니다.');
    }
    onRead(converted.lines, notices.join(' '));
  }

  // ── 파일 선택 전 ──
  if (sheets.length === 0) {
    return (
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = '';
          }}
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="재고 Excel 파일 선택"
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !disabled) processFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
            isDragging ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
          } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <FolderOpen size={32} className="text-teal-500" />
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700">
            <Upload size={14} className="text-slate-400" />
            쓰던 재고 Excel을 여기에 놓기 또는 파일 선택
          </p>
          <p className="text-xs text-slate-400">
            {busy ? '파일을 읽고 있어요...' : '.xlsx, .xls · 열 이름은 자동으로 찾습니다'}
          </p>
        </div>

        {error && (
          <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          빠른 수정으로 돌아가기
        </button>
      </div>
    );
  }

  // ── 인식 결과 ──
  return (
    <div className="space-y-3.5">
      <div>
        <p className="text-sm font-medium text-slate-800">{fileName}</p>
        {inventorySheets.length === 0 ? (
          <p className="mt-1 text-sm text-amber-800">
            물품·재고 서식으로 읽을 수 있는 시트를 찾지 못했습니다. 품목명·현재재고 열이 있는 파일인지
            확인해 주세요.
          </p>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            {inventorySheets.map((s) => s.sheetName).join(', ')} 시트를 재고 자료로 읽었습니다.
          </p>
        )}
      </div>

      {inventorySheets.length > 0 && (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <p className="text-xs font-semibold text-slate-500">자동으로 찾은 열</p>
            <p className="mt-1 text-sm text-slate-700">
              {recognized.length === 0
                ? '아직 연결된 열이 없습니다.'
                : recognized.map((r) => `${r.column} → ${r.label}`).join(' · ')}
            </p>
            {!hasItemColumn && (
              <p className="mt-1.5 text-sm text-amber-800">
                품목명 열을 찾지 못했습니다. 아래에서 직접 연결해 주세요.
              </p>
            )}
            {hasItemColumn && !hasStockColumn && (
              <p className="mt-1.5 text-sm text-amber-800">
                현재재고 열을 찾지 못했습니다. 아래에서 연결하거나, 다음 화면에서 수량을 직접 입력해
                주세요.
              </p>
            )}
            {usesFlowColumns && (
              <p className="mt-1.5 text-xs text-slate-500">
                입고·출고 열은 이번 반영에 쓰지 않습니다. 현재재고만 반영합니다.
              </p>
            )}
          </div>

          {activeSheet && (
            <div>
              <button
                type="button"
                onClick={() => setShowMapper((v) => !v)}
                aria-expanded={showMapper}
                className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                열 연결 확인·수정
                <ChevronRight size={15} className={`transition-transform ${showMapper ? 'rotate-90' : ''}`} />
              </button>
              {showMapper && (
                <div className="mt-3">
                  <ColumnMapper
                    diagnostics={activeSheet.columnDiagnostics}
                    mappings={mappings[activeSheet.sheetName] ?? {}}
                    columnDefs={getColumnsForType('generic')}
                    onChange={(col, target) =>
                      setMappings((prev) => ({
                        ...prev,
                        [activeSheet.sheetName]: { ...prev[activeSheet.sheetName], [col]: target },
                      }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          <p className="text-sm text-slate-600">
            {results === null
              ? '내용을 확인하고 있어요...'
              : `읽은 품목 ${converted?.lines.length ?? 0}개` +
                (errorCount > 0 ? ` · 값을 읽지 못한 칸 ${errorCount}곳` : '')}
          </p>
        </>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleNext}
          disabled={disabled || results === null || (converted?.lines.length ?? 0) === 0}
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
        >
          바뀔 재고 확인하기
        </button>
        <button
          type="button"
          onClick={() => {
            setSheets([]);
            setResults(null);
            setFileName('');
            setError(null);
          }}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          다른 파일 선택
        </button>
      </div>
    </div>
  );
}
