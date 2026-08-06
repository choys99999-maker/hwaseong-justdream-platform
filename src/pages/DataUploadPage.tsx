import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UploadStepper, { type UploadStep } from '../components/upload/UploadStepper';

interface ExcelPreview {
  fileName: string;
  sheetName: string;
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

interface SelectedChecks {
  missing: boolean;
  duplicate: boolean;
  errorColumns: string[]; // 오류 검사할 열 이름 목록
}

interface ValidationResult {
  totalRows: number;
  missingByColumn: Record<string, number> | null;   // 열 이름 → 빈 셀 수
  duplicateByColumn: Record<string, number> | null; // 열 이름 → 중복 값 포함 행 수
  errorByColumn: Record<string, number> | null;     // 열 이름 → 형식 오류 수
}

type ColType = 'date' | 'phone' | 'number' | 'text';

function detectColumnType(name: string): ColType {
  if (/일$|날짜|생년/.test(name)) return 'date';
  if (/연락|전화|핸드폰/.test(name)) return 'phone';
  if (/수량|개수|금액|합계/.test(name)) return 'number';
  return 'text';
}

const COL_TYPE_LABEL: Record<ColType, string> = {
  date: '날짜',
  phone: '전화번호',
  number: '숫자',
  text: '텍스트',
};

const COL_TYPE_COLOR: Record<ColType, string> = {
  date: 'bg-blue-50 text-blue-600',
  phone: 'bg-purple-50 text-purple-600',
  number: 'bg-green-50 text-green-600',
  text: 'bg-slate-100 text-slate-500',
};

export default function DataUploadPage() {
  const [step, setStep] = useState<UploadStep>('select');
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [selectedChecks, setSelectedChecks] = useState<SelectedChecks>({
    missing: true,
    duplicate: true,
    errorColumns: [],
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationProgress, setValidationProgress] = useState(0);
  const [isValidating, setIsValidating] = useState(false);

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
          const cols = msg.columns as string[];
          setPreview({
            fileName: fileNameRef.current,
            sheetName: msg.sheetName,
            columns: cols,
            rows: msg.previewRows,
            totalRows: msg.totalRows,
          });
          // 날짜·전화번호·숫자 열을 자동 선택
          setSelectedChecks((prev) => ({
            ...prev,
            errorColumns: cols.filter((c) => detectColumnType(c) !== 'text'),
          }));
          setIsParsing(false);
          setStep('columns');
          break;
        }
        case 'validate-progress':
          setValidationProgress(msg.progress);
          break;
        case 'validate-done':
          setValidationResult({
            totalRows: msg.totalRows,
            missingByColumn: msg.missingByColumn,
            duplicateByColumn: msg.duplicateByColumn,
            errorByColumn: msg.errorByColumn,
          });
          setIsValidating(false);
          break;
        case 'error':
          setError(msg.message);
          setIsParsing(false);
          setIsValidating(false);
          setStep('select');
          break;
      }
    };

    worker.onerror = (e) => {
      setError(`처리 중 오류가 발생했습니다: ${e.message}`);
      setIsParsing(false);
      setIsValidating(false);
      setStep('select');
    };

    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  useEffect(() => {
    if (step === 'validation' && !isValidating && !validationResult) {
      setIsValidating(true);
      setValidationProgress(0);
      workerRef.current?.postMessage({ type: 'validate', checks: selectedChecks });
    }
  }, [step, isValidating, validationResult, selectedChecks]);

  function processFile(file: File) {
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
    setValidationResult(null);
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
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setValidationResult(null);
    setValidationProgress(0);
    setIsValidating(false);
    setSelectedChecks({ missing: true, duplicate: true, errorColumns: [] });
    setStep('select');
  }

  function goBackToColumns() {
    setValidationResult(null);
    setValidationProgress(0);
    setIsValidating(false);
    setStep('columns');
  }

  function toggleErrorColumn(col: string) {
    setSelectedChecks((prev) => ({
      ...prev,
      errorColumns: prev.errorColumns.includes(col)
        ? prev.errorColumns.filter((c) => c !== col)
        : [...prev.errorColumns, col],
    }));
  }

  const noChecksSelected =
    !selectedChecks.missing &&
    !selectedChecks.duplicate &&
    selectedChecks.errorColumns.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="데이터 업로드"
        description="읍면동별 엑셀 자료를 업로드하고 열 구조와 내용을 미리 확인합니다."
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
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isDragging ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            <Upload size={32} className="text-teal-500" />
            <div>
              <p className="text-sm font-medium text-slate-700">파일을 끌어다 놓거나 클릭하여 선택</p>
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

      {/* ── 업로드 ── */}
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
                <p className="text-sm font-medium text-slate-800">데이터 분석 중...</p>
                <p className="mt-1 text-xs text-slate-400">
                  열 구조와 내용을 파악하고 있습니다. 대용량 파일은 시간이 걸릴 수 있습니다.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 열 인식 결과 ── */}
      {step === 'columns' && preview && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="shrink-0 text-teal-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{preview.fileName}</p>
              <p className="text-xs text-slate-500">
                시트: {preview.sheetName} · 총 {preview.totalRows.toLocaleString()}행
              </p>
            </div>
          </div>

          {/* 감지된 열 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              감지된 열 <span className="font-normal text-slate-400">({preview.columns.length}개)</span>
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preview.columns.map((col) => (
                <span key={col} className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* 미리보기 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              데이터 미리보기 <span className="font-normal text-slate-400">(최대 10행)</span>
            </h3>
            {preview.rows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">데이터 행이 없습니다.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {preview.columns.map((col) => (
                        <th key={col} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {preview.columns.map((col) => (
                          <td key={col} className="whitespace-nowrap px-4 py-2 text-slate-700">{row[col]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 검사 항목 선택 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">검사 항목 선택</h3>
            <p className="mt-0.5 text-xs text-slate-400">다음 단계에서 실행할 검사를 선택하세요.</p>

            <div className="mt-3 space-y-2">
              {/* 누락 검사 */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedChecks.missing}
                  onChange={() => setSelectedChecks((p) => ({ ...p, missing: !p.missing }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">누락 검사</p>
                  <p className="text-xs text-slate-400">빈 셀이 있는 행을 찾습니다</p>
                </div>
              </label>

              {/* 중복 검사 */}
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={selectedChecks.duplicate}
                  onChange={() => setSelectedChecks((p) => ({ ...p, duplicate: !p.duplicate }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-600"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">중복 검사</p>
                  <p className="text-xs text-slate-400">동일한 행을 찾습니다</p>
                </div>
              </label>

              {/* 오류 검사 — 열별 선택 */}
              <div className="rounded-lg border border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-800">오류 검사</p>
                    <p className="text-xs text-slate-400">검사할 열을 선택하세요 (날짜·전화번호·숫자 형식 오류를 찾습니다)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedChecks((prev) => ({
                        ...prev,
                        errorColumns:
                          prev.errorColumns.length === preview.columns.length
                            ? []
                            : [...preview.columns],
                      }))
                    }
                    className="shrink-0 text-xs text-teal-600 hover:underline"
                  >
                    {selectedChecks.errorColumns.length === preview.columns.length ? '전체 해제' : '전체 선택'}
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {preview.columns.map((col) => {
                    const type = detectColumnType(col);
                    const checked = selectedChecks.errorColumns.includes(col);
                    return (
                      <label
                        key={col}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 transition-colors ${
                          checked
                            ? 'border-teal-200 bg-teal-50'
                            : 'border-slate-100 bg-slate-50 hover:border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleErrorColumn(col)}
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-teal-600"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-800">{col}</p>
                          <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${COL_TYPE_COLOR[type]}`}>
                            {COL_TYPE_LABEL[type]}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {selectedChecks.errorColumns.length > 0 && (
                  <p className="mt-2 text-xs text-teal-600">
                    {selectedChecks.errorColumns.length}개 열 선택됨
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep('validation')}
              disabled={noChecksSelected}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              다음 <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RotateCcw size={16} /> 새 파일 선택
            </button>
          </div>
        </section>
      )}

      {/* ── 검증 결과 ── */}
      {step === 'validation' && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">데이터 검증 결과</h3>

          {isValidating && (
            <div className="space-y-3 py-2">
              <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                <span>검증 중...</span>
                <span>{validationProgress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all duration-100"
                  style={{ width: `${validationProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                전체 {preview?.totalRows.toLocaleString()}행을 분석 중입니다. 대용량 파일은 시간이 걸릴 수 있습니다.
              </p>
            </div>
          )}

          {validationResult && preview && (
            <>
              <p className="text-sm text-slate-500">
                총 <strong className="text-slate-800">{validationResult.totalRows.toLocaleString()}행</strong> 분석 완료
              </p>

              {/* 열별 검사 결과 테이블 */}
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-500">열 이름</th>
                      {validationResult.missingByColumn && (
                        <th className="px-4 py-2.5 text-center text-xs font-medium text-amber-600">누락 검사</th>
                      )}
                      {validationResult.duplicateByColumn && (
                        <th className="px-4 py-2.5 text-center text-xs font-medium text-orange-600">중복 검사</th>
                      )}
                      {validationResult.errorByColumn && (
                        <th className="px-4 py-2.5 text-center text-xs font-medium text-red-600">오류 검사</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.columns.map((col) => {
                      const missing = validationResult.missingByColumn?.[col] ?? null;
                      const duplicate = validationResult.duplicateByColumn?.[col] ?? null;
                      const error = validationResult.errorByColumn
                        ? (col in validationResult.errorByColumn ? validationResult.errorByColumn[col] : null)
                        : null;
                      const hasAnyIssue =
                        (missing !== null && missing > 0) ||
                        (duplicate !== null && duplicate > 0) ||
                        (error !== null && error > 0);
                      return (
                        <tr key={col} className={hasAnyIssue ? 'bg-slate-50/60' : ''}>
                          <td className="whitespace-nowrap px-4 py-2.5 font-medium text-slate-700">
                            {col}
                            <span className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium ${COL_TYPE_COLOR[detectColumnType(col)]}`}>
                              {COL_TYPE_LABEL[detectColumnType(col)]}
                            </span>
                          </td>
                          {validationResult.missingByColumn && (
                            <td className={`px-4 py-2.5 text-center tabular-nums font-semibold ${missing! > 0 ? 'text-amber-600' : 'text-slate-300'}`}>
                              {missing!.toLocaleString()}
                            </td>
                          )}
                          {validationResult.duplicateByColumn && (
                            <td className={`px-4 py-2.5 text-center tabular-nums font-semibold ${duplicate! > 0 ? 'text-orange-600' : 'text-slate-300'}`}>
                              {duplicate!.toLocaleString()}
                            </td>
                          )}
                          {validationResult.errorByColumn && (
                            <td className={`px-4 py-2.5 text-center tabular-nums font-semibold ${error === null ? 'text-slate-200' : error > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                              {error === null ? '–' : error.toLocaleString()}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={goBackToColumns}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  <ArrowLeft size={16} /> 이전 단계로
                </button>
                <button
                  type="button"
                  onClick={() => setStep('done')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
                >
                  다음 <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 완료 ── */}
      {step === 'done' && (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 size={40} className="text-teal-500" />
          <p className="text-base font-semibold text-slate-900">검증이 완료되었습니다</p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <RotateCcw size={16} /> 새 파일 선택
          </button>
        </section>
      )}
    </div>
  );
}
