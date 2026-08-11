import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { actionKindCounts, operationActionItems, type ActionKind } from '../../data/actionItems';

/** 첫 화면에서 스크롤 없이 보여줄 조치 건수 */
const VISIBLE_LIMIT = 4;

const KIND_STYLES: Record<ActionKind, { bar: string; badge: string }> = {
  '부족': { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  '유통기한 임박': { bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  '자료 확인 필요': { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};

/**
 * 오늘 확인이 필요한 사항.
 * 부족 → 유통기한 임박 → 자료 확인 필요 순서로 정렬된 파생 목록(`actionItems`)의
 * 상위 몇 건을 확인 버튼과 함께 보여준다. 대시보드의 최우선 구역이다.
 * 전부 거점 시연 데이터(mockSites) 기준이라 실제 제출 자료와는 무관하다.
 */
export default function TodayActionSection() {
  const visible = operationActionItems.slice(0, VISIBLE_LIMIT);
  const restCount = operationActionItems.length - visible.length;

  return (
    <section aria-label="오늘 확인이 필요한 사항" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold text-slate-900">오늘 확인이 필요한 사항</h3>
          <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
            거점 시연 데이터
          </span>
          <span className="flex flex-wrap items-center gap-1">
            {actionKindCounts
              .filter(({ count }) => count > 0)
              .map(({ kind, count }) => (
                <span
                  key={kind}
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${KIND_STYLES[kind].badge}`}
                >
                  {kind} {count}
                </span>
              ))}
          </span>
        </div>
        <Link
          to="/regions"
          className="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          거점 운영에서 전체 확인
          <ArrowRight size={13} />
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
          현재 조치가 필요한 사항이 없습니다.
        </p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
          {visible.map((item, index) => {
            const style = KIND_STYLES[item.kind];
            return (
              <li key={item.id} className="relative overflow-hidden rounded-lg border border-slate-200">
                <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
                <div className="flex items-start justify-between gap-3 py-2.5 pl-4 pr-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-slate-400">우선순위 {index + 1}</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.badge}`}
                      >
                        {item.kind}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800">{item.siteName}</span>
                      <span className="text-[11px] text-slate-400">{item.districtName}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{item.summary}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-teal-700">
                      <ArrowRight size={12} className="shrink-0" />
                      {item.suggestion}
                    </p>
                  </div>
                  <Link
                    to={item.to}
                    className="shrink-0 self-center rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                  >
                    {item.ctaLabel}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {restCount > 0 && (
        <p className="mt-2 text-right text-[11px] text-slate-400">
          외 {restCount}건 — 물품 부족·유통기한 임박은 물품 현황, 자료 확인 필요는 자료·데이터 관리에서 이어서 확인합니다.
        </p>
      )}
    </section>
  );
}
