import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ChevronDown,
  FolderOpen,
  RotateCcw,
  Upload,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UploadStepper, { type UploadStep } from '../components/upload/UploadStepper';
import ColumnMapper from '../components/upload/ColumnMapper';
import {
  autoMapColumns,
  getColumnsForType,
  PERFORMANCE_COLUMNS,
  REFERRAL_COLUMNS,
  GENERIC_COLUMNS,
} from '../utils/columnMapping';
import { useDataStore } from '../store/dataStore';
import type { SheetEntry } from '../store/dataStore';
import type {
  SheetParseResult,
  SheetConvertResult,
  SheetType,
  PlatformColumnKey,
  PlatformColumnDef,
} from '../types/upload';

const ALL_FIELD_LABELS: Record<string, string> = {};
for (const def of [...PERFORMANCE_COLUMNS, ...REFERRAL_COLUMNS, ...GENERIC_COLUMNS]) {
  if (!ALL_FIELD_LABELS[def.key]) ALL_FIELD_LABELS[def.key] = def.label;
}

function sheetTypeLabel(type: SheetType): string {
  if (type === 'performance') return '실적';
  if (type === 'referral') return '연계';
  return '일반';
}

function sheetTypeBadgeClass(type: SheetType): string {
  if (type === 'performance') return 'bg-blue-100 text-blue-700';
  if (type === 'referral') return 'bg-purple-100 text-purple-700';
  return 'bg-slate-100 text-slate-600';
}

const MAX_PREVIEW_ERRORS = 20;
const PREVIEW_ROWS = 5;
const SHOWN_FIELD_CHIPS = 4;

/** 자동으로 연결하지 못한 필수 항목. 이것만 기본 화면에서 물어본다. */
interface AttentionItem {
  sheetName: string;
  def: PlatformColumnDef;
}

export default function DataUploadPage() {
  const { addDataset, datasets } = useDataStore();

  const [step, setStep] = useState<UploadStep>('select');
  const [sheets, setSheets] = useState<SheetParseResult[]>([]);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [sheetMappings, setSheetMappings] = useState<
    Record<string, Record<string, PlatformColumnKey | null>>
  >({});
  const [initialMappings, setInitialMappings] = useState<
    Record<string, Record<string, PlatformColumnKey | null>>
  >({});
  const [convertResults, setConvertResults] = useState<SheetConvertResult[]>([]);
  const [savedSheetCount, setSavedSheetCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileNameRef = useRef('');

  // 워커 콜백은 한 번만 만들어지므로, 저장에 필요한 최신 값을 ref로 들고 있는다.
  const sheetsRef = useRef<SheetParseResult[]>([]);
  sheetsRef.current = sheets;
  const sheetMappingsRef = useRef(sheetMappings);
  sheetMappingsRef.current = sheetMappings;
  const addDatasetRef = useRef(addDataset);
  addDatasetRef.current = addDataset;

  /** 변환 결과를 하나의 파일로 저장한다. (원격 구현 유지) */
  function saveResults(results: SheetConvertResult[]) {
    const now = new Date().toISOString();
    const sheetEntries: SheetEntry[] = [];

    for (const result of results) {
      const sheet = sheetsRef.current.find((s) => s.sheetName === result.sheetName);
      if (!sheet) continue;

      const columnDefs = getColumnsForType(sheet.sheetType);
      const mapping = sheetMappingsRef.current[result.sheetName] ?? {};
      const mappedKeys = new Set(
        Object.values(mapping).filter((v): v is PlatformColumnKey => v !== null),
      );
      const orderedDefs = columnDefs.filter((d) => mappedKeys.has(d.key));
      const columns = orderedDefs.map((d) => d.label);

      const records = result.records.map((r) => {
        const obj: Record<string, string> = {};
        for (const def of orderedDefs) {
          const val = (r as Record<string, unknown>)[def.key];
          if (val !== undefined) obj[def.label] = String(val);
        }
        return obj;
      });

      sheetEntries.push({ sheetName: result.sheetName, sheetType: sheet.sheetType, columns, records });
    }

    const first = sheetEntries[0];
    addDatasetRef.current({
      records: first?.records ?? [],
      columns: first?.columns ?? [],
      fileName: fileNameRef.current,
      uploadedAt: now,
      sheetName: first?.sheetName,
      sheetType: first?.sheetType,
      sheets: sheetEntries,
    });

    setSavedSheetCount(sheetEntries.length);
  }

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/excelWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'parse-done': {
          const parsedSheets = msg.sheets as SheetParseResult[];
          const auto: Record<string, Record<string, PlatformColumnKey | null>> = {};
          for (const sheet of parsedSheets) {
            auto[sheet.sheetName] = autoMapColumns(sheet.columns, sheet.sheetType);
          }
          setSheets(parsedSheets);
          sheetsRef.current = parsedSheets;
          setSheetMappings(auto);
          sheetMappingsRef.current = auto;
          setInitialMappings(auto);
          // 실제 데이터가 있는 시트를 기본으로 고른다. 사용자가 시트를 고르지 않아도 되게.
          const firstWithData = parsedSheets.findIndex(
            (s) => s.columns.length > 0 && s.totalRows > 0,
          );
          setActiveSheetIdx(firstWithData >= 0 ? firstWithData : 0);
          setError(null);
          setIsParsing(false);
          setStep('review');
          break;
        }
        case 'convert-done': {
          const results = msg.sheets as SheetConvertResult[];
          setConvertResults(results);
          saveResults(results); // 변환과 저장을 한 번의 동작으로 합친다.
          setStep('done');
          break;
        }
        case 'error':
          setError(msg.message as string);
          setIsParsing(false);
          // 이미 읽어둔 파일이 있으면 확인 화면을 유지한다.
          setStep((prev) => (prev === 'review' || prev === 'importing' ? 'review' : 'select'));
          break;
      }
    };

    worker.onerror = (e) => {
      setError(`처리 중 오류가 발생했습니다: ${e.message}`);
      setIsParsing(false);
      setStep((prev) => (prev === 'review' || prev === 'importing' ? 'review' : 'select'));
    };

    workerRef.current = worker;
    return () => worker.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function processFile(file: File, overrideName?: string) {
    if (!workerRef.current) {
      setError('처리 모듈 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('.xlsx 또는 .xls 파일만 올릴 수 있습니다.');
      return;
    }
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setConvertResults([]);
    setSavedSheetCount(0);
    setStep('uploading');
    fileNameRef.current = overrideName ?? file.name;

    const reader = new FileReader();
    reader.onprogress = (e) => {
      if (e.lengthComputable) setUploadProgress((e.loaded / e.total) * 100);
    };
    reader.onload = (e) => {
      setUploadProgress(100);
      setIsParsing(true);
      const buffer = e.target?.result as ArrayBuffer;
      workerRef.current!.postMessage({ type: 'parse', buffer }, [buffer]);
    };
    reader.onerror = () => {
      setError('파일을 읽는 중 오류가 발생했습니다. 다시 시도해 주세요.');
      setStep('select');
    };
    reader.readAsArrayBuffer(file);
  }

  function handleFileSelected(file: File) {
    if (datasets.some((d) => d.fileName === file.name)) {
      setError(`"${file.name}" 파일은 이미 등록되어 있습니다. 파일 관리에서 지운 뒤 다시 올려주세요.`);
      return;
    }
    processFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  }

  function handleMappingChange(sheetName: string, col: string, target: PlatformColumnKey | null) {
    setSheetMappings((prev) => ({
      ...prev,
      [sheetName]: { ...prev[sheetName], [col]: target },
    }));
  }

  /** 확인 필요 카드에서 고른 엑셀 열을 해당 항목에 연결한다. */
  function resolveAttention(sheetName: string, key: PlatformColumnKey, excelCol: string) {
    setSheetMappings((prev) => {
      const sheetMap = { ...(prev[sheetName] ?? {}) };
      // 같은 항목이 다른 열에 걸려 있으면 먼저 푼다.
      for (const [col, target] of Object.entries(sheetMap)) {
        if (target === key) sheetMap[col] = null;
      }
      if (excelCol) sheetMap[excelCol] = key;
      return { ...prev, [sheetName]: sheetMap };
    });
  }

  function handleImport() {
    setError(null);
    setConvertResults([]);
    setStep('importing');
    workerRef.current?.postMessage({ type: 'convert', sheetMappings });
  }

  function handleReset() {
    setSheets([]);
    setActiveSheetIdx(0);
    setSheetMappings({});
    setInitialMappings({});
    setConvertResults([]);
    setSavedSheetCount(0);
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setStep('select');
  }

  // 전체 시트 중복 매핑 검사 (원격 동작 유지 — 중복이면 가져오기 차단)
  const hasDuplicateMapping = sheets.some((sheet) => {
    const mapping = sheetMappings[sheet.sheetName] ?? {};
    const seen = new Set<PlatformColumnKey>();
    for (const v of Object.values(mapping)) {
      if (v) {
        if (seen.has(v)) return true;
        seen.add(v);
      }
    }
    return false;
  });

  const activeSheet = sheets[activeSheetIdx];
  const activeResult = convertResults.find((r) => r.sheetName === activeSheet?.sheetName);
  const activeMapping = sheetMappings[activeSheet?.sheetName ?? ''] ?? {};
  const activeInitialMapping = initialMappings[activeSheet?.sheetName ?? ''] ?? {};
  const activeColumnDefs = getColumnsForType(activeSheet?.sheetType ?? 'generic');
  const activeMappedDefs = activeColumnDefs.filter((d) =>
    Object.values(activeMapping).includes(d.key),
  );

  const totalErrors = convertResults.reduce((sum, r) => sum + r.errors.length, 0);
  const totalRecords = convertResults.reduce((sum, r) => sum + r.records.length, 0);
  const totalRows = sheets.reduce((s, sh) => s + sh.totalRows, 0);

  // 자동으로 연결된 항목 수 (전체 시트 합계)
  const connectedCount = sheets.reduce((sum, sheet) => {
    const mapping = sheetMappings[sheet.sheetName] ?? {};
    return sum + Object.values(mapping).filter(Boolean).length;
  }, 0);

  const connectedLabels: string[] = [];
  for (const sheet of sheets) {
    const mapping = sheetMappings[sheet.sheetName] ?? {};
    for (const def of getColumnsForType(sheet.sheetType)) {
      if (Object.values(mapping).includes(def.key) && !connectedLabels.includes(def.label)) {
        connectedLabels.push(def.label);
      }
    }
  }

  // 자동으로 못 찾은 필수 항목만 모은다.
  const attentionItems: AttentionItem[] = [];
  for (const sheet of sheets) {
    if (sheet.columns.length === 0) continue;
    const mapping = sheetMappings[sheet.sheetName] ?? {};
    const mapped = new Set(Object.values(mapping).filter(Boolean));
    for (const def of getColumnsForType(sheet.sheetType)) {
      if (def.required && !mapped.has(def.key)) {
        attentionItems.push({ sheetName: sheet.sheetName, def });
      }
    }
  }

  const shownLabels = connectedLabels.slice(0, SHOWN_FIELD_CHIPS);
  const hiddenLabelCount = connectedLabels.length - shownLabels.length;

  function renderSheetTabs(onSelect: (idx: number) => void, results?: SheetConvertResult[]) {
    return (
      <div className="flex overflow-x-auto border-b border-slate-200">
        {sheets.map((sheet, idx) => {
          const result = results?.find((r) => r.sheetName === sheet.sheetName);
          return (
            <button
              key={sheet.sheetName}
              type="button"
              onClick={() => onSelect(idx)}
              className={`mr-1 flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                activeSheetIdx === idx
                  ? 'border-slate-200 bg-white text-slate-800 shadow-[0_1px_0_white]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <span className="max-w-[120px] truncate">{sheet.sheetName}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sheetTypeBadgeClass(sheet.sheetType)}`}
              >
                {sheetTypeLabel(sheet.sheetType)}
              </span>
              {result && result.errors.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  확인 {result.errors.length}
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">
                  {sheet.totalRows.toLocaleString()}행
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="데이터 올리기"
        description="엑셀 파일을 올리면 자동으로 확인해 시스템에 반영합니다."
      />

      <div className="rounded-xl border border-slate-200 bg-white px-6 py-4">
        <UploadStepper currentStep={step} />
      </div>

      {/* ── 1. 파일 선택 ── */}
      {step === 'select' && (
        <section className="rounded-2xl border border-slate-200 bg-white px-8 py-8">
          <h2 className="text-lg font-semibold text-slate-900">엑셀 파일을 올려주세요</h2>
          <p className="mt-1.5 text-sm text-slate-500">
            파일을 올리면 어떤 내용인지 자동으로 확인해 드립니다.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleInputChange}
          />

          <div
            role="button"
            tabIndex={0}
            aria-label="엑셀 파일 선택"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-6 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isDragging
                ? 'border-teal-400 bg-teal-50'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            <FolderOpen size={40} className="text-teal-500" />
            <div>
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700">
                <Upload size={14} className="text-slate-400" />
                파일을 끌어다 놓거나 클릭해서 선택
              </p>
              <p className="mt-1 text-xs text-slate-400">.xlsx, .xls 파일</p>
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </section>
      )}

      {/* ── 2. 파일 읽는 중 ── */}
      {step === 'uploading' && (
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
          {!isParsing ? (
            <>
              <p className="text-sm font-medium text-slate-800">파일을 읽고 있어요</p>
              <div className="w-full max-w-sm">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
              <div>
                <p className="text-sm font-medium text-slate-800">내용을 확인하고 있어요</p>
                <p className="mt-1 text-xs text-slate-400">
                  자료가 많으면 조금 오래 걸릴 수 있습니다.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 3. 확인 ── */}
      {step === 'review' && sheets.length > 0 && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-8 py-8">
            <h2 className="text-xl font-semibold text-slate-900">데이터를 준비했어요</h2>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{fileNameRef.current}</span> · 시트{' '}
              {sheets.length}개 · 총 {totalRows.toLocaleString()}행을 확인했습니다.
            </p>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {connectedCount > 0 && (
              <div className="mt-7">
                <p className="text-sm text-slate-600">
                  {connectedCount}개 항목을 자동으로 연결했습니다.
                </p>
                <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {shownLabels.map((label) => (
                    <li key={label} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Check size={15} className="text-teal-600" strokeWidth={2.5} />
                      {label}
                    </li>
                  ))}
                  {hiddenLabelCount > 0 && (
                    <li className="text-sm text-slate-400">+{hiddenLabelCount}개</li>
                  )}
                </ul>
              </div>
            )}

            {/* 자동으로 찾지 못한 필수 항목만 물어본다. */}
            {attentionItems.map((item) => {
              const sheet = sheets.find((s) => s.sheetName === item.sheetName);
              const mapping = sheetMappings[item.sheetName] ?? {};
              const currentCol =
                Object.entries(mapping).find(([, v]) => v === item.def.key)?.[0] ?? '';
              return (
                <div
                  key={`${item.sheetName}-${item.def.key}`}
                  className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 px-6 py-5"
                >
                  <h3 className="text-base font-semibold text-slate-900">
                    {item.def.label} 항목을 확인해주세요
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">
                    {sheets.length > 1 && (
                      <span className="font-medium text-slate-700">‘{item.sheetName}’ 시트</span>
                    )}
                    {sheets.length > 1 ? '에서 ' : ''}
                    {item.def.label} 정보를 자동으로 찾지 못했습니다.
                  </p>
                  <label className="mt-4 block max-w-sm">
                    <span className="block text-xs font-medium text-slate-500">
                      {item.def.label}
                    </span>
                    <select
                      aria-label={`${item.def.label} 항목 선택`}
                      value={currentCol}
                      onChange={(e) =>
                        resolveAttention(item.sheetName, item.def.key, e.target.value)
                      }
                      className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option value="">선택해주세요</option>
                      {(sheet?.columns ?? []).map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}

            {hasDuplicateMapping && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 px-6 py-5">
                <h3 className="text-base font-semibold text-slate-900">
                  같은 항목이 두 번 연결되어 있어요
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  아래 고급 설정에서 중복으로 연결된 항목을 하나만 남겨주세요.
                </p>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={hasDuplicateMapping}
                className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                데이터 가져오기
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                다른 파일 선택
              </button>
            </div>
          </section>

          {/* 원본 데이터 보기 (기본은 접혀 있음) */}
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-8 py-5 text-sm font-medium text-slate-700">
              원본 데이터 보기
              <ChevronDown
                size={16}
                className="text-slate-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-slate-100 px-8 py-5">
              {sheets.length > 1 && renderSheetTabs(setActiveSheetIdx)}
              {activeSheet && (
                <div className={sheets.length > 1 ? 'pt-4' : ''}>
                  {activeSheet.columns.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      항목 이름을 인식할 수 없습니다. 파일 구조를 확인해 주세요.
                    </p>
                  ) : activeSheet.previewRows.length === 0 ? (
                    <p className="text-sm text-slate-400">데이터 줄이 없습니다.</p>
                  ) : (
                    <>
                      <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-100 text-sm">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr>
                              {activeSheet.columns.map((col) => (
                                <th
                                  key={col}
                                  className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500"
                                >
                                  {col}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50 bg-white">
                            {activeSheet.previewRows.slice(0, PREVIEW_ROWS).map((row, i) => (
                              <tr key={i}>
                                {activeSheet.columns.map((col) => (
                                  <td
                                    key={col}
                                    className="whitespace-nowrap px-4 py-2 text-slate-600"
                                  >
                                    {row[col]}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="mt-2.5 text-xs text-slate-400">
                        처음 {Math.min(PREVIEW_ROWS, activeSheet.previewRows.length)}줄만
                        보여드립니다. 전체 {activeSheet.totalRows.toLocaleString()}줄
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </details>

          {/* 고급 설정 — 기존 열 매핑 UI를 그대로 담는다 (기본은 접혀 있음) */}
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-8 py-5 text-sm font-medium text-slate-700">
              고급 설정
              <ChevronDown
                size={16}
                className="text-slate-400 transition-transform group-open:rotate-180"
              />
            </summary>
            <div className="border-t border-slate-100 px-8 py-7">
              <h3 className="text-sm font-medium text-slate-700">직접 항목 연결하기</h3>
              <p className="mt-1 text-xs text-slate-400">
                자동으로 연결된 항목도 여기서 바꿀 수 있습니다. * 표시는 꼭 필요한 항목입니다.
              </p>

              <div className="mt-4">
                {sheets.length > 1 && renderSheetTabs(setActiveSheetIdx)}
                {activeSheet && (
                  <div className={sheets.length > 1 ? 'pt-4' : ''}>
                    {activeSheet.columns.length === 0 ? (
                      <p className="text-sm text-slate-400">연결할 항목이 없습니다.</p>
                    ) : (
                      <ColumnMapper
                        excelColumns={activeSheet.columns}
                        mappings={activeMapping}
                        initialMappings={activeInitialMapping}
                        columnDefs={activeColumnDefs}
                        onChange={(col, target) =>
                          handleMappingChange(activeSheet.sheetName, col, target)
                        }
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </details>
        </>
      )}

      {/* ── 4. 가져오는 중 ── */}
      {step === 'importing' && (
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
          <div>
            <p className="text-sm font-medium text-slate-800">데이터를 가져오고 있어요</p>
            <p className="mt-3 text-xs text-slate-400">전체 {totalRows.toLocaleString()}행</p>
          </div>
        </section>
      )}

      {/* ── 5. 완료 ── */}
      {step === 'done' && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-8 py-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
                <Check size={20} className="text-teal-600" strokeWidth={2.5} />
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                {totalRecords.toLocaleString()}건을 가져왔어요
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {fileNameRef.current}
              {savedSheetCount > 1 ? ` · 시트 ${savedSheetCount}개` : ''}
            </p>

            <dl className="mt-7 space-y-2.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:max-w-sm">
                <dt className="text-sm text-slate-500">가져온 데이터</dt>
                <dd className="text-sm font-semibold tabular-nums text-slate-800">
                  {totalRecords.toLocaleString()}건
                </dd>
              </div>
              <div className="flex items-center justify-between sm:max-w-sm">
                <dt className="text-sm text-slate-500">확인이 필요한 값</dt>
                <dd
                  className={`text-sm font-semibold tabular-nums ${
                    totalErrors > 0 ? 'text-amber-600' : 'text-slate-800'
                  }`}
                >
                  {totalErrors.toLocaleString()}건
                </dd>
              </div>
            </dl>
            {totalErrors > 0 && (
              <p className="mt-3 text-xs text-slate-400">
                값을 인식하지 못한 칸입니다. 아래에서 엑셀 위치와 함께 확인할 수 있습니다.
              </p>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                대시보드에서 확인
              </Link>
              <Link
                to="/files"
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                파일 관리
              </Link>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-2 py-2.5 text-sm text-slate-400 transition-colors hover:text-slate-600"
              >
                <RotateCcw size={14} /> 다른 파일 올리기
              </button>
            </div>
          </section>

          {/* 시트별 상세 — 변환 결과와 검증 오류(엑셀 셀 위치 포함) */}
          {convertResults.length > 0 && (
            <details className="group rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-8 py-5 text-sm font-medium text-slate-700">
                시트별 결과 자세히 보기
                <ChevronDown
                  size={16}
                  className="text-slate-400 transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="border-t border-slate-100 px-8 py-5">
                {sheets.length > 1 && renderSheetTabs(setActiveSheetIdx, convertResults)}

                {activeResult && (
                  <div className={`space-y-6 ${sheets.length > 1 ? 'pt-4' : ''}`}>
                    <div>
                      <h3 className="text-sm font-medium text-slate-700">가져온 데이터</h3>
                      {activeMappedDefs.length === 0 ? (
                        <p className="mt-2 text-sm text-slate-400">연결된 항목이 없습니다.</p>
                      ) : (
                        <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-200">
                          <table className="min-w-full divide-y divide-slate-100 text-sm">
                            <thead className="sticky top-0 bg-slate-50">
                              <tr>
                                {activeMappedDefs.map((def) => (
                                  <th
                                    key={def.key}
                                    className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500"
                                  >
                                    {def.label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 bg-white">
                              {activeResult.records.slice(0, 50).map((record, i) => (
                                <tr key={i}>
                                  {activeMappedDefs.map((def) => (
                                    <td
                                      key={def.key}
                                      className="whitespace-nowrap px-4 py-2 text-slate-600"
                                    >
                                      {String((record as Record<string, unknown>)[def.key] ?? '')}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {activeResult.records.length > 50 && (
                            <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
                              외 {(activeResult.records.length - 50).toLocaleString()}줄 더 있습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {activeResult.errors.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium text-slate-700">확인이 필요한 값</h3>
                        <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-amber-200">
                          <table className="min-w-full divide-y divide-amber-100 text-sm">
                            <thead className="sticky top-0 bg-amber-50">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">
                                  엑셀 위치
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">
                                  항목
                                </th>
                                <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">
                                  내용
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50 bg-white">
                              {activeResult.errors.slice(0, MAX_PREVIEW_ERRORS).map((err, i) => (
                                <tr key={i}>
                                  <td className="px-4 py-2 font-mono text-xs tabular-nums text-slate-500">
                                    {err.cellAddress ?? `${err.rowIndex}행`}
                                  </td>
                                  <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-slate-600">
                                    {ALL_FIELD_LABELS[err.field] ?? err.field}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-slate-700">{err.message}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {activeResult.errors.length > MAX_PREVIEW_ERRORS && (
                            <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-600">
                              외 {(activeResult.errors.length - MAX_PREVIEW_ERRORS).toLocaleString()}건 더
                              있습니다.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}
