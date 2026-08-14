import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

/** 조치 종류. 색·정렬 순서가 이 순서를 따른다 — 사람 관련 건이 항상 먼저다. */
export type TodayKind = 'help' | 'donation' | 'stale' | 'supply';

export const TODAY_KIND_LABELS: Record<TodayKind, string> = {
  help: '미처리 도움 요청',
  donation: '오늘 들어온 기부',
  stale: '정보 갱신 필요',
  supply: '부족·확인 필요',
};

const KIND_STYLES: Record<TodayKind, { bar: string; chip: string }> = {
  help: { bar: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 ring-teal-600/20' },
  donation: { bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-600/20' },
  stale: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
  supply: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
};

export interface TodayItem {
  id: string;
  kind: TodayKind;
  /** 어디 건인지. 예: '봉담읍' */
  place: string;
  /** 무슨 건인지. 예: '식품 도움 요청' */
  what: string;
  /** 언제·부가. 예: '23:57 접수' */
  when: string;
  /** [확인] 이 데려갈 실제 처리 화면 */
  to: string;
}

/**
 * 오늘 할 일 큐.
 *
 * 숫자만 세지 않고 한 줄이 곧 한 건이 되게 한다 —
 * `봉담읍 · 식품 도움 요청 · 23:57 접수  [확인]`.
 * [확인]은 처리 화면으로 데려가고, 처리 자체는 그 화면 한 곳에서만 한다
 * (같은 건을 두 화면에서 각각 처리할 수 있게 만들지 않는다).
 */
export default function TodayQueue({
  items,
  emptyMessage,
  limit,
}: {
  items: TodayItem[];
  emptyMessage: string;
  /** 첫 화면에서 스크롤 없이 볼 수 있는 만큼만 보여주고 나머지는 건수만 알린다. */
  limit?: number;
}) {
  const visible = limit ? items.slice(0, limit) : items;
  const restCount = items.length - visible.length;

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2 xl:grid-cols-2">
        {visible.map((item) => {
          const style = KIND_STYLES[item.kind];
          return (
            <li key={item.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-white">
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
              <div className="flex items-center justify-between gap-3 py-2.5 pl-4 pr-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${style.chip}`}
                  >
                    {TODAY_KIND_LABELS[item.kind]}
                  </span>
                  <span className="truncate text-sm font-semibold text-slate-800">{item.place}</span>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="truncate text-sm text-slate-600">{item.what}</span>
                  <span className="text-slate-300" aria-hidden>
                    ·
                  </span>
                  <span className="truncate text-xs text-slate-400">{item.when}</span>
                </div>
                <Link
                  to={item.to}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                >
                  확인
                  <ArrowRight size={12} />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
      {restCount > 0 && <p className="mt-2 text-right text-[11px] text-slate-400">외 {restCount}건</p>}
    </>
  );
}
