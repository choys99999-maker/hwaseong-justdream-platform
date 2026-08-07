import { useEffect } from 'react';
import { X } from 'lucide-react';
import { PROGRAM_SUMMARY } from '../../data/programSummary';

interface ProgramDetailModalProps {
  onClose: () => void;
}

export default function ProgramDetailModal({ onClose }: ProgramDetailModalProps) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">운영 프로그램 현황</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={18} />
          </button>
        </div>

        <dl className="mt-4 space-y-2.5">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
            <dt className="text-sm font-medium text-slate-700">전체 운영 프로그램</dt>
            <dd className="text-sm font-semibold text-slate-900">{PROGRAM_SUMMARY.total}개</dd>
          </div>

          <div className="rounded-lg border border-slate-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-700">화성형</dt>
              <dd className="text-sm font-semibold text-teal-700">{PROGRAM_SUMMARY.hwaseong}개</dd>
            </div>
            <div className="mt-2 space-y-1.5 pl-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>읍면동 행정복지센터</span>
                <span className="font-medium text-slate-700">{PROGRAM_SUMMARY.adminCenter}개</span>
              </div>
              <div className="flex items-center justify-between">
                <span>복지관 등 추가 거점</span>
                <span className="font-medium text-slate-700">{PROGRAM_SUMMARY.welfareCenter}개</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2.5">
            <dt className="text-sm font-medium text-slate-700">국가형</dt>
            <dd className="text-sm font-semibold text-sky-700">{PROGRAM_SUMMARY.national}개</dd>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2.5">
            <dt className="text-sm font-medium text-teal-800">실제 운영 장소</dt>
            <dd className="text-sm font-semibold text-teal-900">{PROGRAM_SUMMARY.locationCount}곳</dd>
          </div>
        </dl>

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
          동일 장소에서 여러 사업을 운영하는 경우 프로그램은 각각 집계하고 실제 장소는 한 곳으로 집계합니다.
        </p>
      </div>
    </div>
  );
}
