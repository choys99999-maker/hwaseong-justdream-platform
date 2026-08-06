import { useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, FileSpreadsheet, RotateCcw } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import UploadStepper, { type UploadStep } from '../components/upload/UploadStepper';
import { COLUMN_MAPPINGS, SAMPLE_UPLOAD_FILES, VALIDATION_FINDINGS, type SampleUploadFile } from '../data/mockUploadSamples';

export default function DataUploadPage() {
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<SampleUploadFile | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function handleSelectFile(file: SampleUploadFile) {
    setSelectedFile(file);
    setStep('uploading');
    timeoutRef.current = setTimeout(() => {
      setStep('columns');
    }, 1200);
  }

  function handleReset() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setSelectedFile(null);
    setStep('select');
  }

  return (
    <div className="space-y-6">
      <PageHeader title="데이터 업로드" description="읍면동별 엑셀 자료를 업로드하고 통합 반영 흐름을 확인합니다." />

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <UploadStepper currentStep={step} />
      </div>

      {step === 'select' && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">샘플 파일 선택</h3>
          <p className="mt-1 text-sm text-slate-500">
            읍면동 담당자가 제출한 그냥드림 엑셀 파일 목록입니다. 파일을 선택하면 업로드가 시작됩니다.
          </p>
          <div className="mt-4 space-y-2">
            {SAMPLE_UPLOAD_FILES.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => handleSelectFile(file)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <div className="flex items-center gap-3">
                  <FileSpreadsheet size={20} className="text-teal-600" />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {file.region} · {file.size}
                    </p>
                  </div>
                </div>
                <ArrowRight size={16} className="text-slate-300" />
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 'uploading' && selectedFile && (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-100 border-t-teal-600" />
          <p className="text-sm font-medium text-slate-800">{selectedFile.name} 업로드 중...</p>
          <p className="text-xs text-slate-400">파일을 분석하고 열 구조를 인식하고 있습니다.</p>
        </section>
      )}

      {step === 'columns' && selectedFile && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">열 인식 결과</h3>
          <p className="mt-1 text-sm text-slate-500">{selectedFile.name}에서 아래와 같이 열을 자동으로 매칭했습니다.</p>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">원본 열</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500"></th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">매칭된 열</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {COLUMN_MAPPINGS.map((mapping) => (
                  <tr key={mapping.source}>
                    <td className="px-4 py-3 text-slate-600">{mapping.source}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <ArrowRight size={16} />
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{mapping.target}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => setStep('validation')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            다음: 누락·중복·오류 확인
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'validation' && selectedFile && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">누락·중복·오류 확인</h3>
          <p className="mt-1 text-sm text-slate-500">통합 반영 전에 아래 항목을 확인해 주세요.</p>

          <div className="mt-4 space-y-2">
            {VALIDATION_FINDINGS.map((finding) => (
              <div key={finding.id} className="flex items-start gap-3 rounded-lg border border-amber-100 bg-amber-50/60 px-4 py-3">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{finding.type}</p>
                  <p className="text-sm text-amber-700">{finding.message}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep('done')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            통합 반영하기
            <ArrowRight size={16} />
          </button>
        </section>
      )}

      {step === 'done' && selectedFile && (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-10 text-center">
          <CheckCircle2 size={40} className="text-emerald-500" />
          <p className="text-base font-semibold text-slate-900">통합 반영이 완료되었습니다</p>
          <p className="text-sm text-slate-500">
            {selectedFile.name} · 총 128건 중 122건 반영, 6건은 확인 필요 항목으로 보류되었습니다.
          </p>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <RotateCcw size={16} />
            새 파일 업로드
          </button>
        </section>
      )}
    </div>
  );
}
