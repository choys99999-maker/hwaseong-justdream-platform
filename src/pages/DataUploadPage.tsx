import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  RotateCcw,
  Save,
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
  const [isSaved, setIsSaved] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileNameRef = useRef('');

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
          setSheetMappings(auto);
          setInitialMappings(auto);
          setActiveSheetIdx(0);
          setIsParsing(false);
          setStep('mapping');
          break;
        }
        case 'convert-done': {
          setConvertResults(msg.sheets as SheetConvertResult[]);
          setIsConverting(false);
          setStep('preview');
          break;
        }
        case 'error':
          setError(msg.message as string);
          setIsParsing(false);
          setIsConverting(false);
          setStep('select');
          break;
      }
    };

    worker.onerror = (e) => {
      setError(`처리 중 오류가 발생했습니다: ${e.message}`);
      setIsParsing(false);
      setIsConverting(false);
      setStep('select');
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  function processFile(file: File, overrideName?: string) {
    if (!workerRef.current) {
      setError('처리 모듈 초기화 중입니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('.xlsx 또는 .xls 파일만 업로드할 수 있습니다.');
      return;
    }
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setConvertResults([]);
    setIsSaved(false);
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
    const isDuplicate = datasets.some((d) => d.fileName === file.name);
    if (isDuplicate) {
      const base = file.name.replace(/\.[^.]+$/, '');
      const ext = file.name.match(/(\.[^.]+)$/)?.[1] ?? '';
      setRenameValue(`${base}_복사본${ext}`);
      setPendingFile(file);
      return;
    }
    processFile(file);
  }

  function confirmRename() {
    if (!pendingFile) return;
    const name = renameValue.trim() || pendingFile.name;
    setPendingFile(null);
    processFile(pendingFile, name);
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

  function handleConvert() {
    setIsConverting(true);
    setConvertResults([]);
    workerRef.current?.postMessage({ type: 'convert', sheetMappings });
  }

  function handleSave() {
    const now = new Date().toISOString();
    const sheetEntries: SheetEntry[] = [];

    for (const result of convertResults) {
      const sheet = sheets.find((s) => s.sheetName === result.sheetName);
      if (!sheet) continue;

      const columnDefs = getColumnsForType(sheet.sheetType);
      const mapping = sheetMappings[result.sheetName] ?? {};
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
    addDataset({
      records: first?.records ?? [],
      columns: first?.columns ?? [],
      fileName: fileNameRef.current,
      uploadedAt: now,
      sheetName: first?.sheetName,
      sheetType: first?.sheetType,
      sheets: sheetEntries,
    });

    setIsSaved(true);
  }

  function handleReset() {
    setSheets([]);
    setActiveSheetIdx(0);
    setSheetMappings({});
    setInitialMappings({});
    setConvertResults([]);
    setIsSaved(false);
    setIsConverting(false);
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setStep('select');
  }

  // 전체 시트 중복 매핑 검사
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

  return (
    <div className="space-y-6">
      {/* ── 중복 파일명 다이얼로그 ── */}
      {pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">같은 이름의 파일이 있습니다</h3>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{pendingFile.name}</span> 이름이 이미
              등록되어 있습니다.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600">새 파일 이름</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
                autoComplete="off"
                autoFocus
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={confirmRename}
                disabled={!renameValue.trim()}
                className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                이 이름으로 올리기
              </button>
              <button
                type="button"
                onClick={() => setPendingFile(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title="데이터 업로드"
        description="엑셀 파일을 올리고 열을 매핑하여 공통 데이터로 변환합니다."
      />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <UploadStepper currentStep={step} />
      </div>

      {/* ── 파일 선택 ── */}
      {step === 'select' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">파일 선택</h3>
          <p className="mt-1 text-sm text-slate-500">
            .xlsx 또는 .xls 형식의 엑셀 파일을 선택하거나 끌어다 놓으세요.
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
            className={`mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isDragging
                ? 'border-teal-400 bg-teal-50'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            <FolderOpen size={40} className="text-teal-500" />
            <div>
              <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-slate-700">
                <Upload size={14} className="text-slate-400" />
                파일을 끌어다 놓거나 클릭하여 선택
              </p>
              <p className="mt-1 text-xs text-slate-400">지원 형식: .xlsx, .xls</p>
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

      {/* ── 파일 읽는 중 ── */}
      {step === 'uploading' && (
        <section className="flex flex-col items-center gap-5 rounded-xl border border-slate-200 bg-white p-10 text-center">
          {!isParsing ? (
            <>
              <p className="text-sm font-medium text-slate-800">파일 로딩 중...</p>
              <div className="w-full max-w-sm">
                <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                  <span>로딩</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-150"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">파일을 메모리에 읽어오고 있습니다.</p>
            </>
          ) : (
            <>
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
              <div>
                <p className="text-sm font-medium text-slate-800">시트 구조 분석 중...</p>
                <p className="mt-1 text-xs text-slate-400">
                  잠시만 기다려 주세요. 대용량 파일은 시간이 걸릴 수 있습니다.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 열 매핑 ── */}
      {step === 'mapping' && activeSheet && (
        <section className="rounded-xl border border-slate-200 bg-white">
          {/* 파일 정보 */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <FileSpreadsheet size={22} className="shrink-0 text-teal-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{fileNameRef.current}</p>
              <p className="text-xs text-slate-500">
                시트 {sheets.length}개 · 총{' '}
                {sheets.reduce((s, sh) => s + sh.totalRows, 0).toLocaleString()}행
              </p>
            </div>
          </div>

          {/* 시트 탭 */}
          <div className="flex overflow-x-auto border-b border-slate-200 px-5 pt-3">
            {sheets.map((sheet, idx) => (
              <button
                key={sheet.sheetName}
                type="button"
                onClick={() => setActiveSheetIdx(idx)}
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
                <span className="text-[10px] text-slate-400">
                  {sheet.totalRows.toLocaleString()}행
                </span>
              </button>
            ))}
          </div>

          <div className="space-y-5 p-5">
            {/* 원본 미리보기 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700">
                원본 데이터 미리보기{' '}
                <span className="font-normal text-slate-400">(최대 10행)</span>
              </h3>
              {activeSheet.columns.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  열을 인식할 수 없습니다. 파일 구조를 확인해 주세요.
                </p>
              ) : activeSheet.previewRows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">데이터 행이 없습니다.</p>
              ) : (
                <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50">
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
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {activeSheet.previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {activeSheet.columns.map((col) => (
                            <td key={col} className="whitespace-nowrap px-4 py-2 text-slate-700">
                              {row[col]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 열 매핑 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700">열 매핑</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                자동으로 연결된 항목을 확인하고 필요에 따라 수정하세요. * 표시는 필수 항목입니다.
              </p>
              <div className="mt-3">
                <ColumnMapper
                  excelColumns={activeSheet.columns}
                  mappings={activeMapping}
                  initialMappings={activeInitialMapping}
                  columnDefs={activeColumnDefs}
                  onChange={(col, target) => handleMappingChange(activeSheet.sheetName, col, target)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleConvert}
                disabled={hasDuplicateMapping || isConverting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                {isConverting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    변환 중...
                  </>
                ) : (
                  <>
                    변환 시작 <ArrowRight size={16} />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <RotateCcw size={16} /> 새 파일 선택
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ── 검증 · 미리보기 ── */}
      {step === 'preview' && convertResults.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white">
          {/* 저장 완료 상태 */}
          {isSaved ? (
            <div className="flex flex-col items-center gap-4 p-10 text-center">
              <CheckCircle2 size={40} className="text-teal-500" />
              <div>
                <p className="text-base font-semibold text-slate-900">저장 완료!</p>
                <p className="mt-1 text-sm text-slate-500">
                  시트 {convertResults.length}개 데이터가 저장되었습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <RotateCcw size={16} /> 새 파일 업로드
              </button>
            </div>
          ) : (
            <>
              {/* 요약 헤더 */}
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-5 py-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-teal-500" />
                  <span className="text-sm font-medium text-slate-800">
                    총 <strong>{totalRecords.toLocaleString()}행</strong> 변환 완료
                  </span>
                </div>
                {totalErrors > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle size={18} className="text-amber-500" />
                    <span className="text-sm font-medium text-amber-700">
                      오류 <strong>{totalErrors.toLocaleString()}건</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* 시트 탭 */}
              <div className="flex overflow-x-auto border-b border-slate-200 px-5 pt-3">
                {convertResults.map((result, idx) => {
                  const sheet = sheets.find((s) => s.sheetName === result.sheetName);
                  return (
                    <button
                      key={result.sheetName}
                      type="button"
                      onClick={() => setActiveSheetIdx(idx)}
                      className={`mr-1 flex shrink-0 items-center gap-1.5 rounded-t-lg border border-b-0 px-3 py-2 text-xs font-medium transition-colors ${
                        activeSheetIdx === idx
                          ? 'border-slate-200 bg-white text-slate-800 shadow-[0_1px_0_white]'
                          : 'border-transparent text-slate-400 hover:text-slate-600'
                      }`}
                    >
                      <span className="max-w-[120px] truncate">{result.sheetName}</span>
                      {sheet && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${sheetTypeBadgeClass(sheet.sheetType)}`}
                        >
                          {sheetTypeLabel(sheet.sheetType)}
                        </span>
                      )}
                      {result.errors.length > 0 && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          오류 {result.errors.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {activeResult && (
                <div className="space-y-5 p-5">
                  {/* 변환 데이터 미리보기 */}
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700">
                      변환 데이터 미리보기{' '}
                      <span className="font-normal text-slate-400">(최대 50행)</span>
                    </h3>
                    {activeMappedDefs.length === 0 ? (
                      <p className="mt-2 text-sm text-slate-400">매핑된 열이 없습니다.</p>
                    ) : (
                      <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-sm">
                          <thead className="bg-slate-50">
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
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {activeResult.records.slice(0, 50).map((record, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                {activeMappedDefs.map((def) => (
                                  <td
                                    key={def.key}
                                    className="whitespace-nowrap px-4 py-2 text-slate-700"
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
                            외 {(activeResult.records.length - 50).toLocaleString()}행 더 있습니다.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 오류 목록 */}
                  {activeResult.errors.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-700">검증 오류</h3>
                      <div className="mt-2 overflow-hidden rounded-lg border border-amber-200">
                        <table className="min-w-full divide-y divide-amber-100 text-sm">
                          <thead className="bg-amber-50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">셀</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">항목</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">내용</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-50 bg-white">
                            {activeResult.errors.slice(0, MAX_PREVIEW_ERRORS).map((err, i) => (
                              <tr key={i}>
                                <td className="px-4 py-2 font-mono text-xs tabular-nums text-slate-500">{err.cellAddress ?? `${err.rowIndex}행`}</td>
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
                            외 {(activeResult.errors.length - MAX_PREVIEW_ERRORS).toLocaleString()}건 더 있습니다.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 border-t border-slate-100 px-5 py-4">
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  <Save size={16} /> 전체 저장
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConvertResults([]);
                    setStep('mapping');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <ArrowLeft size={16} /> 열 매핑으로
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  <RotateCcw size={13} /> 새 파일 선택
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
