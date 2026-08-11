import { useEffect } from 'react';
import { X } from 'lucide-react';
import {
  JUSTDREAM_SITE_SUMMARY,
  JUSTDREAM_PROGRAM_TOTALS,
  SITE_COUNT_BY_DISTRICT,
} from '../../data/justdreamSummary';

interface SiteCompositionModalProps {
  onClose: () => void;
}

/**
 * 화성형 그냥드림 거점 구성 상세.
 * 모든 수치는 `justdreamSummary` 가 확정 데이터에서 계산한 값이며, 하드코딩한 숫자는 없다.
 */
export default function SiteCompositionModal({ onClose }: SiteCompositionModalProps) {
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

  const { total, welfareOrgCount, councilCount, districtCount } = JUSTDREAM_SITE_SUMMARY;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">데이터 등록 거점 구성</h2>
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
          {/* 전체 사업 규모 */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-700">전체 사업 거점</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {JUSTDREAM_PROGRAM_TOTALS.totalPrograms}개소
              </dd>
            </div>
            <div className="mt-2 space-y-1.5 pl-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>국가형 그냥드림</span>
                <span className="font-medium text-slate-700">
                  {JUSTDREAM_PROGRAM_TOTALS.national}개소
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>
                  화성형 그냥드림
                  <span className="ml-1 text-slate-400">
                    (읍면동 {JUSTDREAM_PROGRAM_TOTALS.hwaseongAdminCenter} ·
                    복지관 {JUSTDREAM_PROGRAM_TOTALS.hwaseongWelfareCenter})
                  </span>
                </span>
                <span className="font-medium text-slate-700">
                  {JUSTDREAM_PROGRAM_TOTALS.hwaseong}개소
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>국가형+화성형 동시 운영 장소</span>
                <span>{JUSTDREAM_PROGRAM_TOTALS.dualProgramLocations}개소</span>
              </div>
            </div>
          </div>

          {/* 위치 확인 현황 */}
          <div className="rounded-lg border border-slate-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-700">위치 확인 현황</dt>
              <dd className="text-xs text-slate-400">거점 명단 기준</dd>
            </div>
            <div className="mt-2 space-y-1.5 pl-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>위치 확인 완료</span>
                <span className="font-medium text-teal-700">
                  {JUSTDREAM_PROGRAM_TOTALS.confirmedLocations}개소
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>주소·좌표 확인 중</span>
                <span className="font-medium text-amber-700">
                  {JUSTDREAM_PROGRAM_TOTALS.pendingLocations}개소
                </span>
              </div>
            </div>
          </div>

          {/* 데이터 등록 거점 */}
          <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-teal-800">데이터 등록 거점</dt>
              <dd className="text-sm font-semibold text-teal-900">{total}곳</dd>
            </div>
            <div className="mt-2 space-y-1.5 pl-3 text-xs text-teal-700/80">
              <div className="flex items-center justify-between">
                <span>복지기관</span>
                <span className="font-medium">{welfareOrgCount}곳</span>
              </div>
              <div className="flex items-center justify-between">
                <span>지역사회보장협의체</span>
                <span className="font-medium">{councilCount}곳</span>
              </div>
            </div>
          </div>

          {/* 구별 분포 (데이터 등록 거점 기준) */}
          <div className="rounded-lg border border-slate-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-700">구별 분포</dt>
              <dd className="text-xs text-slate-400">데이터 등록 거점 기준 · {districtCount}개 구</dd>
            </div>
            <div className="mt-2 space-y-1.5 pl-3 text-xs text-slate-500">
              {SITE_COUNT_BY_DISTRICT.map((district) => (
                <div key={district.id} className="flex items-center justify-between">
                  <span>{district.name}</span>
                  <span className="font-medium text-slate-700">{district.count}곳</span>
                </div>
              ))}
            </div>
          </div>
        </dl>

        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-500">
          전체 사업 거점 {JUSTDREAM_PROGRAM_TOTALS.totalPrograms}개소는 국가형{' '}
          {JUSTDREAM_PROGRAM_TOTALS.national} + 화성형 {JUSTDREAM_PROGRAM_TOTALS.hwaseong}(읍면동{' '}
          {JUSTDREAM_PROGRAM_TOTALS.hwaseongAdminCenter} · 복지관{' '}
          {JUSTDREAM_PROGRAM_TOTALS.hwaseongWelfareCenter})입니다. 데이터 등록 거점 {total}곳은 실적
          자료에서 확인된 기관명으로 주소·좌표를 확정해 현재 시스템에 등록한 범위입니다. 두 값은 다른
          기준이므로 혼용하지 않습니다.
        </p>
      </div>
    </div>
  );
}
