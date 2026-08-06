import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { AlertCircle, ArrowRight, FileSpreadsheet, RotateCcw, Upload } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UploadStepper, { type UploadStep } from '../components/upload/UploadStepper';

interface ExcelPreview {
  fileName: string;
  sheetName: string;
  columns: string[];
  rows: Record<string, string>[];
}

type UploadPhase = 'reading' | 'parsing';

export default function DataUploadPage() {
  const [step, setStep] = useState<UploadStep>('select');
  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>('reading');
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      setError('.xlsx 또는 .xls 파일만 업로드할 수 있습니다.');
      return;
    }

    setError(null);
    setUploadProgress(0);
    setUploadPhase('reading');
    setStep('uploading');

    const reader = new FileReader();

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setUploadProgress((e.loaded / e.total) * 100);
      }
    };

    reader.onload = (e) => {
      setUploadProgress(100);
      setUploadPhase('parsing');

      // parsing은 동기 블로킹이라 먼저 UI가 '분석 중'으로 전환되도록 대기
      setTimeout(() => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });

          const sheetName = workbook.SheetNames[0];
          if (!sheetName) throw new Error('시트를 찾을 수 없습니다.');

          const worksheet = workbook.Sheets[sheetName];
          const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
            header: 1,
            defval: '',
          });

          if (rawRows.length === 0) throw new Error('시트에 데이터가 없습니다.');

          const headerRow = rawRows[0] as unknown[];
          const columnEntries = headerRow
            .map((cell, idx) => ({ name: String(cell), idx }))
            .filter(({ name }) => name.trim() !== '');

          if (columnEntries.length === 0)
            throw new Error('유효한 열 이름을 찾을 수 없습니다. 첫 번째 행에 열 이름이 있는지 확인하세요.');

          const columns = columnEntries.map(({ name }) => name);
          const dataRows = rawRows.slice(1, 11).map((row) => {
            const arr = row as unknown[];
            return Object.fromEntries(
              columnEntries.map(({ name, idx }) => [name, String(arr[idx] ?? '')]),
            );
          });

          setPreview({ fileName: file.name, sheetName, columns, rows: dataRows });
          setStep('columns');
        } catch (err) {
          const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
          setError(`파일 읽기 실패: ${message}`);
          setStep('select');
        }
      }, 50);
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
    setStep('select');
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
              isDragging
                ? 'border-teal-400 bg-teal-50'
                : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
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

      {/* ── 로딩 중 ── */}
      {step === 'uploading' && (
        <section className="flex flex-col items-center gap-5 rounded-xl border border-slate-200 bg-white p-10 text-center">
          {uploadPhase === 'reading' ? (
            <>
              <p className="text-sm font-medium text-slate-800">파일 로딩 중...</p>

              {/* 로딩바 */}
              <div className="w-full max-w-sm">
                <div className="mb-1.5 flex justify-between text-xs text-slate-400">
                  <span>로딩</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all duration-200"
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
                <p className="mt-1 text-xs text-slate-400">열 구조와 내용을 파악하고 있습니다.</p>
              </div>
            </>
          )}
        </section>
      )}

      {/* ── 열 인식 결과 & 미리보기 ── */}
      {step === 'columns' && preview && (
        <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
          {/* 파일 정보 */}
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={24} className="shrink-0 text-teal-600" />
            <div>
              <p className="text-sm font-semibold text-slate-900">{preview.fileName}</p>
              <p className="text-xs text-slate-500">시트: {preview.sheetName}</p>
            </div>
          </div>

          {/* 열 이름 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              인식된 열{' '}
              <span className="font-normal text-slate-400">({preview.columns.length}개)</span>
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {preview.columns.map((col) => (
                <span
                  key={col}
                  className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* 데이터 미리보기 */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700">
              데이터 미리보기{' '}
              <span className="font-normal text-slate-400">
                (최대 10행 · {preview.rows.length}행 표시)
              </span>
            </h3>
            {preview.rows.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">데이터 행이 없습니다 (헤더 행만 존재).</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
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
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {preview.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-slate-50">
                        {preview.columns.map((col) => (
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

          {/* 버튼 영역 */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setStep('validation')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              다음: 누락·중복·오류 확인
              <ArrowRight size={16} />
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RotateCcw size={16} />
              새 파일 선택
            </button>
          </div>
        </section>
      )}

      {/* ── 누락·중복·오류 확인 (준비 중) ── */}
      {step === 'validation' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">누락·중복·오류 확인</h3>
          <p className="mt-1 text-sm text-slate-500">
            업로드된 데이터의 누락·중복·오류 항목을 검사합니다.
          </p>
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-500" />
            <p className="text-sm text-amber-700">이 기능은 현재 개발 중입니다.</p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <RotateCcw size={16} />
            새 파일 선택
          </button>
        </section>
      )}
    </div>
  );
}
