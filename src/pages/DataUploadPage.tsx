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
  error: boolean;
}

interface ValidationResult {
  totalRows: number;
  missingRows: number | null;
  duplicateRows: number | null;
  errorRows: number | null;
}

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
    error: true,
  });
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationProgress, setValidationProgress] = useState(0);
  const [isValidating, setIsValidating] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const fileNameRef = useRef('');

  // 워커 생성 및 메시지 핸들러 등록
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/excelWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      switch (msg.type) {
        case 'parse-done':
          setPreview({
            fileName: fileNameRef.current,
            sheetName: msg.sheetName,
            columns: msg.columns,
            rows: msg.previewRows,
            totalRows: msg.totalRows,
          });
          setIsParsing(false);
          setStep('columns');
          break;
        case 'validate-progress':
          setValidationProgress(msg.progress);
          break;
        case 'validate-done':
          setValidationResult({
            totalRows: msg.totalRows,
            missingRows: msg.missingRows,
            duplicateRows: msg.duplicateRows,
            errorRows: msg.errorRows,
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

  // validation 단계 진입 시 자동으로 검증 시작
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
      // zero-copy 전송 — 워커가 메모리 소유권을 가져가므로 탭이 튕기지 않음
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
    setStep('select');
  }

  function goBackToColumns() {
    setValidationResult(null);
    setValidationProgress(0);
    setIsValidating(false);
    setStep('columns');
  }

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
              {(
                [
                  { key: 'missing', label: '누락 검사', desc: '빈 셀이 있는 행을 찾습니다' },
                  { key: 'duplicate', label: '중복 검사', desc: '동일한 행을 찾습니다' },
                  { key: 'error', label: '오류 검사', desc: '날짜·연락처 형식 오류 행을 찾습니다' },
                ] as const
              ).map(({ key, label, desc }) => (
                <label key={key} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 px-4 py-3 hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedChecks[key]}
                    onChange={() => setSelectedChecks((p) => ({ ...p, [key]: !p[key] }))}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-teal-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400">{desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep('validation')}
              disabled={!selectedChecks.missing && !selectedChecks.duplicate && !selectedChecks.error}
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

          {validationResult && (
            <>
              <p className="text-sm text-slate-500">
                총 <strong className="text-slate-800">{validationResult.totalRows.toLocaleString()}행</strong> 분석 완료
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {validationResult.missingRows !== null && (
                  <div className={`rounded-lg border p-4 ${validationResult.missingRows > 0 ? 'border-amber-100 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-2xl font-bold tabular-nums ${validationResult.missingRows > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {validationResult.missingRows.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">누락 행</p>
                    <p className="text-xs text-slate-400">빈 셀이 있는 행</p>
                  </div>
                )}
                {validationResult.duplicateRows !== null && (
                  <div className={`rounded-lg border p-4 ${validationResult.duplicateRows > 0 ? 'border-orange-100 bg-orange-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-2xl font-bold tabular-nums ${validationResult.duplicateRows > 0 ? 'text-orange-600' : 'text-slate-400'}`}>
                      {validationResult.duplicateRows.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">중복 행</p>
                    <p className="text-xs text-slate-400">동일한 행</p>
                  </div>
                )}
                {validationResult.errorRows !== null && (
                  <div className={`rounded-lg border p-4 ${validationResult.errorRows > 0 ? 'border-red-100 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className={`text-2xl font-bold tabular-nums ${validationResult.errorRows > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      {validationResult.errorRows.toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-700">형식 오류 행</p>
                    <p className="text-xs text-slate-400">날짜·연락처 오류</p>
                  </div>
                )}
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
