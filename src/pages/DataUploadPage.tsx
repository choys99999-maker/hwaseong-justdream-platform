import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ChevronDown,
  FileSpreadsheet,
  FolderOpen,
  RotateCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UploadStepper, { type UploadStep } from '../components/upload/UploadStepper';
import { useDataStore } from '../store/dataStore';
import { PLATFORM_FIELDS, autoMatchFields } from '../config/platformFields';

interface SheetInfo {
  name: string;
  rows: number;
  cols: number;
  hasData: boolean;
}

interface HeaderChoice {
  index: number;
  cells: string[];
}

interface ExcelPreview {
  fileName: string;
  sheetName: string;
  sheets: SheetInfo[];
  headerRowIndex: number;
  headerChoices: HeaderChoice[];
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

/** 항목별 사용자 선택. null = 아직 정하지 않음, '' = 가져오지 않음. */
type FieldChoices = Record<string, string | null>;

// 열 이름 → { missing, duplicate, list } 온오프
type SelectedChecks = Record<string, { missing: boolean; duplicate: boolean; list: boolean }>;

interface ValidationResult {
  totalRows: number;
  issueRows: number;
  missingByColumn: Record<string, number> | null;
  duplicateByColumn: Record<string, number> | null;
  listByColumn: Record<string, number> | null;
}

const NONE = '__none__';
const PREVIEW_ROWS = 5;

export default function DataUploadPage() {
  const { datasets, activeId, addDataset, removeDataset, setActiveId } = useDataStore();

  const [step, setStep] = useState<UploadStep>('select');
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [fieldChoices, setFieldChoices] = useState<FieldChoices>({});
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<SelectedChecks>({});
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationProgress, setValidationProgress] = useState(0);
  const [importStage, setImportStage] = useState<'checking' | 'saving'>('checking');
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileNameRef = useRef('');
  const columnsRef = useRef<string[]>([]);
  const fieldMapRef = useRef<Record<string, string>>({});
  const addDatasetRef = useRef(addDataset);
  addDatasetRef.current = addDataset;
  const chunkedRecordsRef = useRef<Record<string, string>[]>([]);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/excelWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'parse-done': {
          const cols = msg.columns as string[];
          columnsRef.current = cols;

          const initChecks: SelectedChecks = {};
          for (const col of cols) {
            initChecks[col] = { missing: true, duplicate: true, list: true };
          }
          setSelectedChecks(initChecks);

          // 자동으로 찾은 항목은 그대로 쓰고, 못 찾은 필수 항목만 사용자에게 물어본다.
          const matched = autoMatchFields(cols);
          const choices: FieldChoices = {};
          for (const field of PLATFORM_FIELDS) {
            choices[field.id] = matched[field.id] ?? (field.required ? null : '');
          }
          setFieldChoices(choices);

          setPreview({
            fileName: fileNameRef.current,
            sheetName: msg.sheetName,
            sheets: msg.sheets ?? [],
            headerRowIndex: msg.headerRowIndex ?? 0,
            headerChoices: msg.headerChoices ?? [],
            columns: cols,
            rows: msg.previewRows,
            totalRows: msg.totalRows,
          });
          setValidationResult(null);
          setError(null);
          setIsParsing(false);
          setStep('review');
          break;
        }
        case 'validate-progress':
          setValidationProgress(msg.progress);
          break;
        case 'validate-done':
          setValidationResult({
            totalRows: msg.totalRows,
            issueRows: msg.issueRows ?? 0,
            missingByColumn: msg.missingByColumn,
            duplicateByColumn: msg.duplicateByColumn,
            listByColumn: msg.listByColumn,
          });
          setImportStage('saving');
          workerRef.current?.postMessage({ type: 'get-all' });
          break;
        case 'all-data-chunk': {
          Array.prototype.push.apply(
            chunkedRecordsRef.current,
            msg.chunk as Record<string, string>[],
          );
          break;
        }
        case 'all-data-done': {
          const records = chunkedRecordsRef.current;
          chunkedRecordsRef.current = [];
          addDatasetRef.current({
            records,
            columns: columnsRef.current,
            fileName: fileNameRef.current,
            uploadedAt: new Date().toISOString(),
            fieldMap: fieldMapRef.current,
          });
          setAppliedCount(records.length);
          setStep('done');
          break;
        }
        case 'error':
          setError(msg.message);
          setIsParsing(false);
          // 이미 읽어둔 파일이 있으면 확인 화면을 유지한다.
          // (예: 고급 설정에서 빈 시트를 골랐을 때 파일을 다시 올리게 하면 안 된다)
          setStep((prev) => (prev === 'review' ? 'review' : 'select'));
          break;
      }
    };

    worker.onerror = (e) => {
      setError(`처리 중 오류가 발생했습니다: ${e.message}`);
      setIsParsing(false);
      setStep('select');
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  function processFile(file: File) {
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
    setValidationResult(null);
    setAppliedCount(null);
    setStep('uploading');
    fileNameRef.current = file.name;

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

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleReset() {
    setPreview(null);
    setFieldChoices({});
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setValidationResult(null);
    setValidationProgress(0);
    setSelectedChecks({});
    setAppliedCount(null);
    chunkedRecordsRef.current = [];
    setStep('select');
  }

  function handleImport() {
    if (!preview) return;

    const map: Record<string, string> = {};
    for (const field of PLATFORM_FIELDS) {
      map[field.id] = fieldChoices[field.id] ?? '';
    }
    fieldMapRef.current = map;

    chunkedRecordsRef.current = [];
    setValidationProgress(0);
    setImportStage('checking');
    setStep('importing');

    const entries = Object.entries(selectedChecks);
    const workerChecks = {
      missingColumns: entries.filter(([, v]) => v.missing).map(([k]) => k),
      duplicateColumns: entries.filter(([, v]) => v.duplicate).map(([k]) => k),
      listColumns: entries.filter(([, v]) => v.list).map(([k]) => k),
    };
    const nothingToCheck =
      workerChecks.missingColumns.length === 0 &&
      workerChecks.duplicateColumns.length === 0 &&
      workerChecks.listColumns.length === 0;

    if (nothingToCheck) {
      setImportStage('saving');
      workerRef.current?.postMessage({ type: 'get-all' });
    } else {
      workerRef.current?.postMessage({ type: 'validate', checks: workerChecks });
    }
  }

  function setFieldChoice(fieldId: string, raw: string) {
    setFieldChoices((prev) => ({
      ...prev,
      [fieldId]: raw === '' ? null : raw === NONE ? '' : raw,
    }));
  }

  function selectValue(choice: string | null | undefined): string {
    if (choice === null || choice === undefined) return '';
    return choice === '' ? NONE : choice;
  }

  function changeSheet(sheetName: string) {
    setValidationResult(null);
    workerRef.current?.postMessage({ type: 'select-sheet', sheetName });
  }

  function changeHeaderRow(rowIndex: number) {
    setValidationResult(null);
    workerRef.current?.postMessage({ type: 'set-header-row', headerRowIndex: rowIndex });
  }

  function toggleCell(col: string, type: 'missing' | 'duplicate' | 'list') {
    setSelectedChecks((prev) => ({
      ...prev,
      [col]: { ...prev[col], [type]: !prev[col]?.[type] },
    }));
  }

  function toggleAllOfType(type: 'missing' | 'duplicate' | 'list') {
    if (!preview) return;
    const allOn = preview.columns.every((c) => selectedChecks[c]?.[type]);
    setSelectedChecks((prev) => {
      const next = { ...prev };
      for (const col of preview.columns) {
        next[col] = { ...next[col], [type]: !allOn };
      }
      return next;
    });
  }

  const connectedFields = PLATFORM_FIELDS.filter((f) => {
    const c = fieldChoices[f.id];
    return typeof c === 'string' && c !== '';
  });
  const needsAttention = PLATFORM_FIELDS.filter((f) => fieldChoices[f.id] === null);
  const shownFields = connectedFields.slice(0, 4);
  const hiddenFieldCount = connectedFields.length - shownFields.length;
  const isEmptyFile = preview !== null && preview.totalRows === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="데이터 올리기"
        description="읍면동별 엑셀 파일을 올리면 자동으로 확인해 시스템에 반영합니다."
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
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
      {step === 'review' && preview && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-8 py-8">
            <h2 className="text-xl font-semibold text-slate-900">데이터를 준비했어요</h2>
            <p className="mt-2 text-sm text-slate-500">
              <span className="font-medium text-slate-700">{preview.fileName}</span> · {preview.totalRows.toLocaleString()}건을 확인했습니다.
            </p>

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 px-4 py-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {isEmptyFile && (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 px-6 py-5">
                <h3 className="text-base font-semibold text-slate-900">가져올 데이터가 없어요</h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  이 시트에는 항목 이름만 있고 내용이 없습니다. 아래 고급 설정에서 다른 시트나 항목 이름이 적힌 줄을 골라 보세요.
                </p>
              </div>
            )}

            {!isEmptyFile && connectedFields.length > 0 && (
              <div className="mt-7">
                <p className="text-sm text-slate-600">
                  {connectedFields.length}개 항목을 자동으로 연결했습니다.
                </p>
                <ul className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                  {shownFields.map((f) => (
                    <li key={f.id} className="flex items-center gap-1.5 text-sm text-slate-700">
                      <Check size={15} className="text-teal-600" strokeWidth={2.5} />
                      {f.label}
                    </li>
                  ))}
                  {hiddenFieldCount > 0 && (
                    <li className="text-sm text-slate-400">+{hiddenFieldCount}개</li>
                  )}
                </ul>
              </div>
            )}

            {preview.headerRowIndex > 0 && (
              <p className="mt-4 text-xs text-slate-400">
                {preview.headerRowIndex}번째 줄까지는 제목으로 보고 건너뛰었어요. 아래 고급 설정에서 바꿀 수 있습니다.
              </p>
            )}

            {/* 시스템이 확신하지 못한 항목만 물어본다. */}
            {!isEmptyFile && needsAttention.map((field) => (
              <div
                key={field.id}
                className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 px-6 py-5"
              >
                <h3 className="text-base font-semibold text-slate-900">
                  {field.label} 항목을 확인해주세요
                </h3>
                <p className="mt-1.5 text-sm text-slate-600">
                  이 파일에서 {field.label} 정보를 자동으로 찾지 못했습니다.
                </p>
                <label className="mt-4 block max-w-sm">
                  <span className="block text-xs font-medium text-slate-500">{field.label}</span>
                  <select
                    aria-label={`${field.label} 항목 선택`}
                    value={selectValue(fieldChoices[field.id])}
                    onChange={(e) => setFieldChoice(field.id, e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="">선택해주세요</option>
                    {preview.columns.map((col) => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                    <option value={NONE}>이 파일에는 없어요</option>
                  </select>
                </label>
                <p className="mt-2 text-xs text-slate-500">{field.example}</p>
              </div>
            ))}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleImport}
                disabled={needsAttention.length > 0 || isEmptyFile}
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
              <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="border-t border-slate-100 px-8 py-5">
              {preview.rows.length === 0 ? (
                <p className="text-sm text-slate-400">데이터 줄이 없습니다.</p>
              ) : (
                <>
                  <div className="max-h-64 overflow-auto rounded-lg border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-100 text-sm">
                      <thead className="sticky top-0 bg-slate-50">
                        <tr>
                          {preview.columns.map((col) => (
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
                        {preview.rows.slice(0, PREVIEW_ROWS).map((row, i) => (
                          <tr key={i}>
                            {preview.columns.map((col) => (
                              <td key={col} className="whitespace-nowrap px-4 py-2 text-slate-600">
                                {row[col]}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-2.5 text-xs text-slate-400">
                    처음 {Math.min(PREVIEW_ROWS, preview.rows.length)}줄만 보여드립니다. 전체 {preview.totalRows.toLocaleString()}줄
                  </p>
                </>
              )}
            </div>
          </details>

          {/* 고급 설정 (기본은 접혀 있음) */}
          <details className="group rounded-2xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between px-8 py-5 text-sm font-medium text-slate-700">
              고급 설정
              <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-10 border-t border-slate-100 px-8 py-7">
              {/* 시트 · 항목 이름 줄 */}
              <div className="grid gap-6 sm:grid-cols-2">
                {preview.sheets.length > 1 && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">읽어올 시트</span>
                    <select
                      aria-label="읽어올 시트"
                      value={preview.sheetName}
                      onChange={(e) => changeSheet(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {[...preview.sheets]
                        .sort((a, b) => Number(b.hasData) - Number(a.hasData))
                        .map((s) => (
                          <option key={s.name} value={s.name}>
                            {s.name}
                            {s.hasData ? ` (${s.rows.toLocaleString()}줄)` : ' — 내용이 거의 없음'}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                {preview.headerChoices.length > 0 && (
                  <label className="block">
                    <span className="text-sm font-medium text-slate-700">항목 이름이 적힌 줄</span>
                    <select
                      aria-label="항목 이름이 적힌 줄"
                      value={preview.headerRowIndex}
                      onChange={(e) => changeHeaderRow(Number(e.target.value))}
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {preview.headerChoices.map((choice) => {
                        const label = choice.cells.filter(Boolean).slice(0, 4).join(' · ');
                        return (
                          <option key={choice.index} value={choice.index}>
                            {choice.index + 1}번째 줄{label ? ` — ${label}` : ' — 빈 줄'}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                )}
              </div>

              {/* 직접 항목 연결하기 */}
              <div>
                <h3 className="text-sm font-medium text-slate-700">직접 항목 연결하기</h3>
                <p className="mt-1 text-xs text-slate-400">
                  자동으로 연결된 항목도 여기서 바꿀 수 있습니다.
                </p>

                <div className="mt-4 space-y-px overflow-hidden rounded-lg bg-slate-100">
                  {PLATFORM_FIELDS.map((field) => {
                    const choice = fieldChoices[field.id];
                    const status =
                      choice === null
                        ? { label: '확인 필요', className: 'text-amber-600' }
                        : choice === ''
                          ? { label: '가져오지 않음', className: 'text-slate-400' }
                          : { label: '자동 인식 완료', className: 'text-slate-400' };
                    return (
                      <div
                        key={field.id}
                        className="flex flex-wrap items-center gap-3 bg-white px-4 py-3"
                      >
                        <span className="w-24 shrink-0 text-sm font-medium text-slate-700">
                          {field.label}
                        </span>
                        <select
                          aria-label={`${field.label} 원본 항목`}
                          value={selectValue(choice)}
                          onChange={(e) => setFieldChoice(field.id, e.target.value)}
                          className="w-full max-w-md min-w-56 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500"
                        >
                          <option value="">선택해주세요</option>
                          {preview.columns.map((col) => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                          <option value={NONE}>가져오지 않음</option>
                        </select>
                        <span className={`w-24 shrink-0 text-right text-xs ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 확인할 내용 */}
              <div>
                <h3 className="text-sm font-medium text-slate-700">확인할 내용</h3>
                <p className="mt-1 text-xs text-slate-400">
                  가져오기 전에 각 항목에서 무엇을 확인할지 고를 수 있습니다. 기본값은 전부 확인입니다.
                </p>

                <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">
                          원본 항목
                        </th>
                        {(['missing', 'duplicate', 'list'] as const).map((type) => (
                          <th key={type} className="px-4 py-3 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-medium text-slate-500">
                                {type === 'missing' ? '빈 값' : type === 'duplicate' ? '중복' : '종류'}
                              </span>
                              <input
                                type="checkbox"
                                checked={preview.columns.every((c) => selectedChecks[c]?.[type])}
                                onChange={() => toggleAllOfType(type)}
                                className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                                aria-label={`${type} 전체 선택`}
                              />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {preview.columns.map((col) => {
                        const checks =
                          selectedChecks[col] ?? { missing: false, duplicate: false, list: false };
                        return (
                          <tr key={col}>
                            <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{col}</td>
                            {(['missing', 'duplicate', 'list'] as const).map((type) => (
                              <td key={type} className="px-4 py-2.5 text-center">
                                <input
                                  type="checkbox"
                                  checked={checks[type]}
                                  onChange={() => toggleCell(col, type)}
                                  className="h-4 w-4 rounded border-slate-300 accent-teal-600"
                                  aria-label={`${col} ${type}`}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </details>
        </>
      )}

      {/* ── 4. 가져오는 중 ── */}
      {step === 'importing' && (
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white px-8 py-16 text-center">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-teal-100 border-t-teal-600" />
          <div className="w-full max-w-sm">
            <p className="text-sm font-medium text-slate-800">
              {importStage === 'checking' ? '데이터를 확인하고 있어요' : '데이터를 가져오고 있어요'}
            </p>
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-500 transition-all duration-100"
                style={{ width: `${importStage === 'checking' ? validationProgress : 100}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-400">
              전체 {preview?.totalRows.toLocaleString()}건
            </p>
          </div>
        </section>
      )}

      {/* ── 5. 완료 ── */}
      {step === 'done' && appliedCount !== null && (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white px-8 py-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
                <Check size={20} className="text-teal-600" strokeWidth={2.5} />
              </span>
              <h2 className="text-xl font-semibold text-slate-900">
                {appliedCount.toLocaleString()}건을 가져왔어요
              </h2>
            </div>
            <p className="mt-2 text-sm text-slate-500">{preview?.fileName}</p>

            {/* 빈 값 검사를 실제로 돌린 경우에만 집계를 보여준다.
                검사하지 않은 항목까지 정상으로 확인된 것처럼 읽히면 안 된다. */}
            {validationResult?.missingByColumn && (
              <>
                <dl className="mt-7 space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 sm:max-w-sm">
                    <dt className="text-sm text-slate-500">값이 모두 채워진 데이터</dt>
                    <dd className="text-sm font-semibold tabular-nums text-slate-800">
                      {(validationResult.totalRows - validationResult.issueRows).toLocaleString()}건
                    </dd>
                  </div>
                  <div className="flex items-center justify-between sm:max-w-sm">
                    <dt className="text-sm text-slate-500">빈 값이 있어 확인 필요</dt>
                    <dd
                      className={`text-sm font-semibold tabular-nums ${
                        validationResult.issueRows > 0 ? 'text-amber-600' : 'text-slate-800'
                      }`}
                    >
                      {validationResult.issueRows.toLocaleString()}건
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-slate-400">
                  빈 값 기준으로 센 결과입니다. 중복·값 종류는 아래에서 항목별로 확인할 수 있습니다.
                </p>
              </>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to="/"
                className="rounded-lg bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
              >
                대시보드에서 확인
              </Link>
              <Link
                to="/support-records"
                className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                {validationResult && validationResult.issueRows > 0
                  ? `${validationResult.issueRows.toLocaleString()}건 검토하기`
                  : '가져온 내역 보기'}
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

          {validationResult && preview && (
            <details className="group rounded-2xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between px-8 py-5 text-sm font-medium text-slate-700">
                항목별 확인 결과 자세히 보기
                <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" />
              </summary>
              <div className="border-t border-slate-100 px-8 py-5">
                <div className="max-h-96 overflow-auto rounded-lg border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="sticky top-0 bg-slate-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                          원본 항목
                        </th>
                        {validationResult.missingByColumn && (
                          <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">빈 값</th>
                        )}
                        {validationResult.duplicateByColumn && (
                          <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">중복</th>
                        )}
                        {validationResult.listByColumn && (
                          <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-500">종류</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 bg-white">
                      {preview.columns.map((col) => {
                        const missing = validationResult.missingByColumn?.[col] ?? null;
                        const duplicate = validationResult.duplicateByColumn?.[col] ?? null;
                        const listCount = validationResult.listByColumn
                          ? col in validationResult.listByColumn
                            ? validationResult.listByColumn[col]
                            : null
                          : null;
                        return (
                          <tr key={col}>
                            <td className="whitespace-nowrap px-4 py-2.5 text-slate-700">{col}</td>
                            {validationResult.missingByColumn && (
                              <td className={`px-4 py-2.5 text-center tabular-nums ${
                                missing ? 'font-semibold text-amber-600' : 'text-slate-300'
                              }`}>
                                {missing === null ? '–' : missing.toLocaleString()}
                              </td>
                            )}
                            {validationResult.duplicateByColumn && (
                              <td className={`px-4 py-2.5 text-center tabular-nums ${
                                duplicate ? 'font-semibold text-amber-600' : 'text-slate-300'
                              }`}>
                                {duplicate === null ? '–' : duplicate.toLocaleString()}
                              </td>
                            )}
                            {validationResult.listByColumn && (
                              <td className="px-4 py-2.5 text-center tabular-nums text-slate-500">
                                {listCount === null ? '–' : `${listCount.toLocaleString()}종`}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          )}
        </>
      )}

      {/* ── 올린 파일 목록 ── */}
      {(step === 'select' || step === 'done') && datasets.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white px-8 py-6">
          <h3 className="text-sm font-medium text-slate-700">
            올린 파일
            <span className="ml-2 font-normal text-slate-400">{datasets.length}개</span>
          </h3>
          <div className="mt-4 space-y-2">
            {[...datasets].reverse().map((d) => {
              const isActive = d.id === activeId;
              const uploadedDate = new Date(d.uploadedAt).toLocaleString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });
              return (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${
                    isActive ? 'border-teal-200 bg-teal-50/50' : 'border-slate-100'
                  }`}
                >
                  <FileSpreadsheet size={18} className={isActive ? 'text-teal-500' : 'text-slate-300'} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-800">{d.fileName}</p>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                          사용 중
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {d.records.length.toLocaleString()}건 · {uploadedDate}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => setActiveId(d.id)}
                        className="rounded-md px-2.5 py-1 text-xs font-medium text-teal-600 hover:bg-teal-50"
                      >
                        사용하기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeDataset(d.id)}
                      className="rounded-md p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                      title="파일 지우기"
                      aria-label={`${d.fileName} 지우기`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
