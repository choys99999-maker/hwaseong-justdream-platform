import { useEffect } from 'react';
import { X } from 'lucide-react';
import { JUSTDREAM_SITE_SUMMARY, SITE_COUNT_BY_DISTRICT } from '../../data/justdreamSummary';

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
          <h2 className="text-base font-semibold text-slate-900">운영 거점 구성</h2>
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
          <div className="flex items-center justify-between rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2.5">
            <dt className="text-sm font-medium text-teal-800">전체 운영 거점</dt>
            <dd className="text-sm font-semibold text-teal-900">{total}곳</dd>
          </div>

          <div className="rounded-lg border border-slate-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-700">기관 유형별</dt>
              <dd className="text-xs text-slate-400">{total}곳</dd>
            </div>
            <div className="mt-2 space-y-1.5 pl-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>복지기관</span>
                <span className="font-medium text-slate-700">{welfareOrgCount}곳</span>
              </div>
              <div className="flex items-center justify-between">
                <span>지역사회보장협의체</span>
                <span className="font-medium text-slate-700">{councilCount}곳</span>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-100 px-3 py-2.5">
            <div className="flex items-center justify-between">
              <dt className="text-sm font-medium text-slate-700">구별 분포</dt>
              <dd className="text-xs text-slate-400">{districtCount}개 구</dd>
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
          화성형 그냥드림 실적 자료의 기관명을 기준으로 주소·좌표를 확정한 {total}곳입니다. 복지기관은 실제 시설
          위치, 지역사회보장협의체는 해당 읍면동 행정복지센터를 운영 위치로 봅니다. 구 분류는 확정 좌표를 화성시
          행정동 경계와 대조해 정했습니다.
        </p>
      </div>
    </div>
  );
}
