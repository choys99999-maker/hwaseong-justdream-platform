import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { HS } from './ui';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자 서브화면 시각화.
 *
 * 그래프는 장식이 아니다. 각 컴포넌트는 질문 하나에만 답한다(§9).
 *   StatusDonut  — 전체가 어떤 상태인가?
 *   RankBars     — 어디가(무엇이) 가장 문제인가?
 *   SegmentBar   — 상태가 어떻게 구성돼 있는가?
 *   ProgressRows — 어디까지 됐는가?
 *
 * 공통 규칙: 축·grid 없음, 값은 막대 옆에 직접 쓴다, 강한 색은 강조 하나에만,
 * 나머지는 브랜드 파랑의 옅은 톤. 누르면 실제 필터로 이어진다.
 *
 * 도넛만 이미 들어 있는 recharts 를 쓴다(arc 계산·전환을 새로 만들 이유가 없다).
 * 막대는 값 라벨을 막대 옆에 직접 붙여야 해서 CSS 로 그리는 편이 단순하다.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  onSelect?: () => void;
}

/** 전체가 어떤 상태인가. 가운데에는 합계와 그 단위만 둔다. */
export function StatusDonut({
  segments,
  total,
  centerLabel,
  activeKey,
}: {
  segments: DonutSegment[];
  total: number;
  centerLabel: string;
  activeKey?: string | null;
}) {
  const drawn = segments.filter((s) => s.value > 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div className="relative h-[152px] w-[152px] shrink-0">
        {total > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={drawn}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={74}
                paddingAngle={drawn.length > 1 ? 2 : 0}
                cornerRadius={4}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                animationDuration={420}
                animationEasing="ease-out"
                onClick={(_, index) => drawn[index]?.onSelect?.()}
              >
                {drawn.map((segment) => (
                  <Cell
                    key={segment.key}
                    fill={segment.color}
                    opacity={!activeKey || activeKey === segment.key ? 1 : 0.28}
                    className={segment.onSelect ? 'cursor-pointer outline-none' : 'outline-none'}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[32px] font-bold leading-none tabular-nums text-[#182230]">{total}</span>
          <span className="mt-1 text-[11.5px] text-[#8A96A8]">{centerLabel}</span>
        </div>
      </div>

      <ul className="w-full min-w-0 space-y-1">
        {segments.map((segment) => {
          const row = (
            <>
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: segment.color }}
              />
              <span className="min-w-0 flex-1 truncate text-[13px] text-[#4C5A6E]">{segment.label}</span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-[#182230]">
                {segment.value}
              </span>
            </>
          );
          return (
            <li key={segment.key}>
              {segment.onSelect ? (
                <button
                  type="button"
                  onClick={segment.onSelect}
                  aria-pressed={activeKey === segment.key}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
                    activeKey === segment.key ? 'bg-[#EAF3FC]' : 'hover:bg-[#F3F6FA]'
                  }`}
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-2.5 px-2 py-1.5">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface RankItem {
  key: string;
  label: string;
  value: number;
  /** 막대 옆에 그대로 쓰는 값. 없으면 value 를 쓴다. */
  valueText?: string;
  /** 라벨 아래 한 줄. 어디인지·왜인지 같은 짧은 보조 정보. */
  sub?: string;
  onSelect?: () => void;
}

/**
 * 어디가(무엇이) 가장 문제인가. 정렬은 호출부가 이미 끝낸 상태로 넘긴다.
 * 1위 하나만 강한 색이고 나머지는 파랑 톤이다 — 무지개 차트를 만들지 않는다.
 */
export function RankBars({
  items,
  accent = HS.orange,
  emptyMessage = '해당하는 항목이 없습니다.',
}: {
  items: RankItem[];
  accent?: string;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-[12.5px] text-[#98A2B3]">{emptyMessage}</p>;
  }

  const max = Math.max(...items.map((item) => item.value), 1);

  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const pct = Math.max(4, Math.round((item.value / max) * 100));
        const color = i === 0 ? accent : i === 1 ? HS.blueSoft : HS.blueTint;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-[13px] font-medium text-[#182230]">{item.label}</span>
              <span
                className="shrink-0 text-[13px] font-bold tabular-nums"
                style={{ color: i === 0 ? accent : '#4C5A6E' }}
              >
                {item.valueText ?? item.value}
              </span>
            </span>
            <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-[#EDF2F8]">
              <span
                className="ad-grow block h-full rounded-full"
                style={{ width: `${pct}%`, background: color, animationDelay: `${i * 60}ms` }}
              />
            </span>
            {item.sub && <span className="mt-1 block truncate text-[11.5px] text-[#8A96A8]">{item.sub}</span>}
          </>
        );
        return (
          <li key={item.key}>
            {item.onSelect ? (
              <button
                type="button"
                onClick={item.onSelect}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-[#F3F6FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
              >
                {body}
              </button>
            ) : (
              <div className="py-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export interface BarSegment {
  key: string;
  label: string;
  value: number;
  color: string;
  onSelect?: () => void;
}

/**
 * 상태가 어떻게 구성돼 있는가. 파이보다 가로 한 줄이 정확하고 조용하다.
 * 값이 0인 구간은 아예 그리지 않되 범례에는 남긴다(0이라는 사실도 정보다).
 */
export function SegmentBar({ segments, activeKey }: { segments: BarSegment[]; activeKey?: string | null }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-3.5 w-full gap-1 overflow-hidden rounded-full bg-[#EDF2F8]">
        {total > 0 &&
          segments
            .filter((segment) => segment.value > 0)
            .map((segment, i) => (
              <span
                key={segment.key}
                className="ad-grow block h-full rounded-full"
                title={`${segment.label} ${segment.value}`}
                style={{
                  // 작은 값도 보이도록 최소 폭을 준다. 비율 왜곡을 막기 위해 6% 를 넘지 않는다.
                  flex: `${Math.max(segment.value / total, 0.06)} 1 0%`,
                  background: segment.color,
                  opacity: !activeKey || activeKey === segment.key ? 1 : 0.3,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            ))}
      </div>

      <ul className="mt-3.5 flex flex-wrap gap-x-1 gap-y-1">
        {segments.map((segment) => {
          const row = (
            <>
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: segment.color }}
              />
              <span className="text-[12px] text-[#667085]">{segment.label}</span>
              <span className="text-[13px] font-bold tabular-nums text-[#182230]">{segment.value}</span>
            </>
          );
          return (
            <li key={segment.key}>
              {segment.onSelect && segment.value > 0 ? (
                <button
                  type="button"
                  onClick={segment.onSelect}
                  aria-pressed={activeKey === segment.key}
                  className={`flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
                    activeKey === segment.key ? 'bg-[#EAF3FC]' : 'hover:bg-[#F3F6FA]'
                  }`}
                >
                  {row}
                </button>
              ) : (
                <div className="flex items-center gap-1.5 px-2 py-1">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export interface ProgressItem {
  key: string;
  label: string;
  done: number;
  total: number;
  onSelect?: () => void;
}

/**
 * 어디까지 됐는가. 권역별 제출률처럼 "채워진 정도"를 나란히 비교할 때 쓴다.
 * 호출부가 뒤처진 순으로 정렬해 넘기면 맨 위 한 줄만 주황이 된다 —
 * 전부 주황이면 어디부터 챙겨야 할지 알 수 없다.
 */
export function ProgressRows({ items }: { items: ProgressItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item, i) => {
        const ratio = item.total > 0 ? item.done / item.total : 0;
        const behind = i === 0 && items.length > 1;
        const body = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[13px] font-medium text-[#182230]">{item.label}</span>
              <span className="shrink-0 text-[12.5px] tabular-nums text-[#667085]">
                <strong
                  className="text-[13px] font-bold"
                  style={{ color: behind ? HS.orange : HS.blue }}
                >
                  {item.done}
                </strong>
                {' / '}
                {item.total}
              </span>
            </span>
            <span className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-[#EDF2F8]">
              <span
                className="ad-grow block h-full rounded-full"
                style={{
                  width: `${Math.round(ratio * 100)}%`,
                  background: behind ? HS.orange : HS.blue,
                  animationDelay: `${i * 60}ms`,
                }}
              />
            </span>
          </>
        );
        return (
          <li key={item.key}>
            {item.onSelect ? (
              <button
                type="button"
                onClick={item.onSelect}
                className="-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-1 text-left transition-colors hover:bg-[#F3F6FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
              >
                {body}
              </button>
            ) : (
              <div className="py-1">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** 하나의 비율만 크게 보여줄 때. 자료 제출률처럼 "전체 중 얼마"가 곧 결론인 경우. */
export function BigRatioDonut({
  done,
  total,
  doneLabel,
  color = HS.blue,
}: {
  done: number;
  total: number;
  doneLabel: string;
  color?: string;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const data = [
    { key: 'done', value: done },
    { key: 'rest', value: Math.max(total - done, 0) },
  ];

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[168px] w-[168px]">
        {total > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={82}
                cornerRadius={5}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                animationDuration={450}
                animationEasing="ease-out"
              >
                <Cell fill={color} className="outline-none" />
                <Cell fill="#E7EEF6" className="outline-none" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[34px] font-bold leading-none tabular-nums" style={{ color }}>
            {pct}%
          </span>
        </div>
      </div>
      <p className="mt-1 text-[13px] font-semibold tabular-nums text-[#182230]">
        {done} / {total}
      </p>
      <p className="text-[11.5px] text-[#8A96A8]">{doneLabel}</p>
    </div>
  );
}
