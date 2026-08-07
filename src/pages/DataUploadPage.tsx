import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  FolderOpen,
  RotateCcw,
  Upload,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UploadStepper, { type UploadStep } from '../components/upload/UploadStepper';
import ColumnMapper from '../components/upload/ColumnMapper';
import { autoMapColumns, PLATFORM_COLUMNS } from '../utils/columnMapping';
import type { ConvertResult, MappedRecord, PlatformColumnKey } from '../types/upload';

interface ExcelInfo {
  fileName: string;
  sheetName: string;
  columns: string[];
  previewRows: Record<string, string>[];
  totalRows: number;
}

const PLATFORM_LABEL: Record<PlatformColumnKey, string> = {
  region: '지역',
  organization: '기관명',
  itemName: '품목명',
  inboundQuantity: '입고수량',
  outboundQuantity: '출고수량',
  stock: '현재재고',
  inboundDate: '입고일',
  expirationDate: '유통기한',
};

function recordValue(record: MappedRecord, key: PlatformColumnKey): string {
  const val = (record as Record<string, unknown>)[key];
  if (val === undefined || val === null) return '';
  return String(val);
}

export default function DataUploadPage() {
  const [step, setStep] = useState<UploadStep>('select');
  const [excelInfo, setExcelInfo] = useState<ExcelInfo | null>(null);
  const [columnMappings, setColumnMappings] = useState<Record<string, PlatformColumnKey | null>>({});
  const [initialMappings, setInitialMappings] = useState<Record<string, PlatformColumnKey | null>>({});
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);

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
          const auto = autoMapColumns(cols);
          setColumnMappings(auto);
          setInitialMappings(auto);
          setExcelInfo({
            fileName: fileNameRef.current,
            sheetName: msg.sheetName,
            columns: cols,
            previewRows: msg.previewRows,
            totalRows: msg.totalRows,
          });
          setIsParsing(false);
          setStep('mapping');
          break;
        }
        case 'convert-done': {
          setConvertResult({
            records: msg.records as MappedRecord[],
            errors: msg.errors,
          });
          setIsConverting(false);
          setStep('preview');
          break;
        }
        case 'error':
          setError(msg.message);
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
    setConvertResult(null);
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

  function handleMappingChange(col: string, target: PlatformColumnKey | null) {
    setColumnMappings((prev) => ({ ...prev, [col]: target }));
  }

  function handleConvert() {
    setIsConverting(true);
    setConvertResult(null);
    workerRef.current?.postMessage({ type: 'convert', mapping: columnMappings });
  }

  function handleReset() {
    setExcelInfo(null);
    setColumnMappings({});
    setInitialMappings({});
    setConvertResult(null);
    setIsConverting(false);
    setError(null);
    setUploadProgress(0);
    setIsParsing(false);
    setStep('select');
  }

  // 변환된 열 순서 (매핑된 것만)
  const mappedPlatformCols = PLATFORM_COLUMNS.filter((d) =>
    Object.values(columnMappings).includes(d.key),
  );

  // 중복 매핑 여부
  const hasDuplicateMapping = (() => {
    const seen = new Set<PlatformColumnKey>();
    for (const v of Object.values(columnMappings)) {
      if (v) {
        if (seen.has(v)) return true;
        seen.add(v);
      }
    }
    return false;
  })();

  const MAX_PREVIEW_ERRORS = 20;

  return (
    <div className="space-y-6">
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
                <p className="text-sm font-medium text-slate-800">열 구조 분석 중...</p>
                <p className="mt-1 text-xs text-slate-400">
                  잠시만 기다려 주세요. 대용량 파일은 시간이 걸릴 수 있습니다.
                </p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 열 매핑 ── */}
      {step === 'mapping' && excelInfo && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          {/* 파일 정보 */}
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="shrink-0 text-teal-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{excelInfo.fileName}</p>
              <p className="text-xs text-slate-500">
                시트: {excelInfo.sheetName} · 총 {excelInfo.totalRows.toLocaleString()}행
              </p>
            </div>
          </div>

          {/* 원본 미리보기 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              원본 데이터 미리보기{' '}
              <span className="font-normal text-slate-400">(최대 10행)</span>
            </h3>
            {excelInfo.previewRows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">데이터 행이 없습니다.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {excelInfo.columns.map((col) => (
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
                    {excelInfo.previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {excelInfo.columns.map((col) => (
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
                excelColumns={excelInfo.columns}
                mappings={columnMappings}
                initialMappings={initialMappings}
                onChange={handleMappingChange}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={handleConvert}
              disabled={hasDuplicateMapping}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              변환 시작 <ArrowRight size={16} />
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

      {/* ── 변환 중 ── */}
      {step === 'mapping' && isConverting && (
        <section className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
          <p className="text-sm font-medium text-slate-700">데이터 변환 중...</p>
        </section>
      )}

      {/* ── 검증 · 미리보기 ── */}
      {step === 'preview' && excelInfo && convertResult && (
        <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-5">
          {/* 요약 */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-teal-500" />
              <span className="text-sm font-medium text-slate-800">
                총{' '}
                <strong>{convertResult.records.length.toLocaleString()}행</strong> 변환 완료
              </span>
            </div>
            {convertResult.errors.length > 0 && (
              <div className="flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-500" />
                <span className="text-sm font-medium text-amber-700">
                  오류 <strong>{convertResult.errors.length.toLocaleString()}건</strong>
                </span>
              </div>
            )}
          </div>

          {/* 오류 목록 */}
          {convertResult.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-700">검증 오류</h3>
              <div className="mt-2 overflow-hidden rounded-lg border border-amber-200">
                <table className="min-w-full divide-y divide-amber-100 text-sm">
                  <thead className="bg-amber-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-amber-700">
                        행 번호
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
                    {convertResult.errors.slice(0, MAX_PREVIEW_ERRORS).map((err, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-xs tabular-nums text-slate-500">
                          {err.rowIndex}행
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-xs font-medium text-slate-600">
                          {PLATFORM_LABEL[err.field]}
                        </td>
                        <td className="px-4 py-2 text-xs text-slate-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {convertResult.errors.length > MAX_PREVIEW_ERRORS && (
                  <div className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-600">
                    외 {(convertResult.errors.length - MAX_PREVIEW_ERRORS).toLocaleString()}건 더 있습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 변환 데이터 미리보기 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              변환 데이터 미리보기{' '}
              <span className="font-normal text-slate-400">(최대 50행)</span>
            </h3>
            {mappedPlatformCols.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">매핑된 열이 없습니다.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {mappedPlatformCols.map((def) => (
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
                    {convertResult.records.slice(0, 50).map((record, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {mappedPlatformCols.map((def) => (
                          <td
                            key={def.key}
                            className="whitespace-nowrap px-4 py-2 text-slate-700"
                          >
                            {recordValue(record, def.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {convertResult.records.length > 50 && (
                  <div className="border-t border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-400">
                    외 {(convertResult.records.length - 50).toLocaleString()}행 더 있습니다.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setConvertResult(null);
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
        </section>
      )}
    </div>
  );
}
