import type { ReactNode } from 'react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * 관리자 서브화면 공통 레이아웃.
 *
 * 네 화면(거점 관리 · 재고 · 시민 요청 · 자료 관리)이 같은 제품으로 읽히도록
 * 화면 골격을 여기 한 곳에서만 정한다.
 *
 *   PageIntro   — 무슨 화면인지 / 지금 상황 한 문장 / 어떻게 쓰는지
 *   Overview    — 판단에 필요한 그림. 표가 아니다.
 *   Action      — 지금 확인하거나 처리할 것. 누르면 바로 그 일로 간다.
 *   Detail      — 원하는 사람만 여는 전문 데이터.
 *
 * 색은 화성특례시 시그니처 파랑/주황 두 축만 쓴다. 파랑은 브랜드·정보·선택,
 * 주황은 "사람이 손을 대야 한다"는 뜻 하나로만 쓴다. 빨강은 실제 부족·위험,
 * 초록은 정상. 그 외 색은 만들지 않는다.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const HS = {
  canvas: '#F3F6FA',
  surface: '#FFFFFF',
  /** Overview·Detail 구역 바닥. 캔버스보다 살짝 밝아 층이 나뉘어 보인다. */
  section: '#F7FAFD',
  surfaceBlue: '#F3F8FD',
  surfaceBlueStrong: '#EAF3FC',
  surfaceOrange: '#FFF6EE',
  surfaceMint: '#EFF9F6',
  blue: '#004696',
  blueSoft: '#3D7CB8',
  blueTint: '#BFD6EC',
  orange: '#DC6E2D',
  text: '#182230',
  textSub: '#667085',
  border: '#DFE7EF',
  track: '#E7EEF6',
  success: '#159A68',
  warning: '#F59E0B',
  danger: '#E5484D',
} as const;

/** 카드 한 장. 작은 데이터마다 만들지 않고 큰 그룹에만 쓴다(§13). */
export const CARD_CLASS =
  'rounded-2xl border border-[rgba(20,50,80,0.08)] bg-white shadow-[0_8px_24px_rgba(30,64,100,0.05)]';

// ─── 페이지 도입부 ──────────────────────────────────────────────────────────

interface PageIntroProps {
  /** 화면 이름. 큰 문장 위에 작게 붙는다. */
  eyebrow: string;
  /** 이 화면에 들어온 사람이 2초 안에 읽어야 할 한 문장. */
  headline: ReactNode;
  /** 어떻게 쓰는 화면인지. 한 줄을 넘기지 않는다. */
  description: string;
  actions?: ReactNode;
}

export function PageIntro({ eyebrow, headline, description, actions }: PageIntroProps) {
  return (
    <div className="ad-rise flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold tracking-wide text-[#004696]">{eyebrow}</p>
        <h1 className="mt-1 text-[26px] font-bold leading-[1.25] tracking-[-0.01em] text-[#182230]">
          {headline}
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-[#667085]">{description}</p>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div>}
    </div>
  );
}

/** 큰 문장 안에서 눈이 먼저 닿아야 하는 숫자. */
export function Accent({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'blue' }) {
  return (
    <strong className="font-bold" style={{ color: tone === 'orange' ? HS.orange : HS.blue }}>
      {children}
    </strong>
  );
}

// ─── 세 구역 ────────────────────────────────────────────────────────────────

/** 판단에 필요한 그림만. 안에는 흰 카드만 들어간다. */
export function OverviewSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="rounded-[20px] bg-[#F7FAFD] p-4 sm:p-5">
      {children}
    </section>
  );
}

/** 지금 확인하거나 처리할 것. 한 장의 흰 판 위에 행이 쌓인다. */
export function ActionSection({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={`${CARD_CLASS} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[#182230]">{title}</h2>
        {aside}
      </div>
      {hint && <p className="mt-1 text-[12.5px] text-[#667085]">{hint}</p>}
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/** 원하는 사람만 여는 전문 데이터. 첫 화면의 주인공이 아니다. */
export function DetailSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="rounded-[20px] bg-[#F7FAFD] p-4 sm:p-5">
      {children}
    </section>
  );
}

/** Overview 안의 흰 카드. 제목은 그 카드가 답하는 질문 하나다. */
export function VizCard({
  title,
  question,
  children,
  className = '',
  delay = 0,
}: {
  title: string;
  /** 이 카드가 답하는 질문. 없으면 제목만 둔다. */
  question?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={`ad-rise ${CARD_CLASS} flex flex-col p-4 sm:p-5 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 className="text-[13px] font-semibold tracking-[-0.01em] text-[#182230]">{title}</h3>
      {question && <p className="mt-0.5 text-[11.5px] text-[#8A96A8]">{question}</p>}
      {/* 같은 줄의 카드끼리 높이는 맞추되, 내용이 짧은 카드는 가운데에 둔다 — 아래가 텅 비어 보이지 않게. */}
      <div className="mt-4 flex flex-1 flex-col justify-center">{children}</div>
    </div>
  );
}

// ─── 탭 ─────────────────────────────────────────────────────────────────────

export interface SubTab<T extends string> {
  key: T;
  label: string;
  /** 이 탭이 담고 있는 건수. 0이면 숫자를 조용히 둔다. */
  count?: number;
}

/**
 * Detail 구역의 탭. 기본값은 언제나 "확인이 필요한 것"이고,
 * 전체 데이터는 사용자가 직접 눌렀을 때만 나온다.
 */
export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: readonly SubTab<T>[];
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-xl border border-[rgba(20,50,80,0.08)] bg-white p-1"
    >
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
              active ? 'bg-[#EAF3FC] text-[#004696]' : 'text-[#667085] hover:bg-[#F3F6FA] hover:text-[#182230]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`ml-1.5 tabular-nums ${active ? 'font-bold text-[#004696]' : 'text-[#8A96A8]'}`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── 조치 행 ────────────────────────────────────────────────────────────────

export type ActionTone = 'danger' | 'warning' | 'info' | 'neutral';

const TONE_DOT: Record<ActionTone, string> = {
  danger: HS.danger,
  warning: HS.orange,
  info: HS.blue,
  neutral: '#98A2B3',
};

const TONE_TAG: Record<ActionTone, string> = {
  danger: 'bg-[#FDECEC] text-[#B42318]',
  warning: 'bg-[#FFF1E4] text-[#B4530F]',
  info: 'bg-[#EAF3FC] text-[#004696]',
  neutral: 'bg-[#F0F3F7] text-[#5A6678]',
};

/** 조치 행에 붙는 상태 꼬리표. 남발하지 않고 한 행에 하나만 쓴다. */
export function Tag({ tone, children }: { tone: ActionTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${TONE_TAG[tone]}`}
    >
      {children}
    </span>
  );
}

interface ActionRowProps {
  tone: ActionTone;
  title: string;
  tag?: string;
  /** 왜 지금 봐야 하는지. 숫자를 포함한 한 줄. */
  detail: ReactNode;
  meta?: string;
  cta: string;
  index?: number;
  onClick?: () => void;
  href?: string;
  /** react-router Link 를 쓰는 화면에서 넘긴다. */
  as?: (props: { className: string; children: ReactNode; style: React.CSSProperties }) => ReactNode;
}

/**
 * "지금 확인할 것" 한 줄.
 *
 * 표의 한 행이 아니라 하나의 판단 단위다 — 무엇이, 왜, 어디로 가면 되는지가
 * 한 줄 안에서 끝난다. 높이는 64~72px 을 지킨다.
 */
export function ActionRow({ tone, title, tag, detail, meta, cta, index = 0, onClick, as }: ActionRowProps) {
  const className =
    'ad-rise ad-lift group flex w-full items-center gap-3.5 rounded-xl border border-[#E7EEF6] bg-white px-4 py-3 text-left hover:border-[#C9DCEF] hover:bg-[#FAFCFE] hover:shadow-[0_6px_18px_rgba(30,64,100,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]';
  const style = { animationDelay: `${index * 40}ms` };

  const body = (
    <>
      <span
        aria-hidden
        className="mt-0.5 h-2 w-2 shrink-0 self-start rounded-full"
        style={{ background: TONE_DOT[tone], marginTop: 7 }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-[#182230]">{title}</span>
          {tag && <Tag tone={tone}>{tag}</Tag>}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-[#667085]">{detail}</span>
      </span>
      {meta && <span className="hidden shrink-0 text-[12px] text-[#8A96A8] sm:block">{meta}</span>}
      <span className="shrink-0 text-[12.5px] font-semibold text-[#004696] transition-colors group-hover:text-[#00356F]">
        {cta} <span aria-hidden>→</span>
      </span>
    </>
  );

  if (as) return <>{as({ className, style, children: body })}</>;

  return (
    <button type="button" onClick={onClick} className={className} style={style}>
      {body}
    </button>
  );
}

/** 조치할 것이 하나도 없을 때. 빈 표 대신 이 문장만 남는다. */
export function AllClear({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-[#DCEFE6] bg-[#EFF9F6] px-4 py-6 text-center text-[13.5px] font-medium text-[#0F7A52]">
      {message}
    </p>
  );
}

// ─── 작은 요약 ──────────────────────────────────────────────────────────────

export interface SummaryFigure {
  label: string;
  value: number | string;
  unit?: string;
  tone?: 'default' | 'orange' | 'blue' | 'success';
  onClick?: () => void;
  active?: boolean;
}

const FIGURE_COLOR: Record<NonNullable<SummaryFigure['tone']>, string> = {
  default: HS.text,
  orange: HS.orange,
  blue: HS.blue,
  success: HS.success,
};

/**
 * 숫자 몇 개를 한 판 위에 붙여 둔다. KPI 카드를 3~6개 늘어놓지 않는다(§18).
 * 각 숫자는 누르면 그 값으로 걸러진다 — 그림으로 끝나지 않게 한다(§16).
 */
export function SummaryStrip({ figures }: { figures: SummaryFigure[] }) {
  return (
    <dl className="flex flex-wrap items-stretch gap-x-1 gap-y-2">
      {figures.map((figure, i) => {
        const color = FIGURE_COLOR[figure.tone ?? 'default'];
        const inner = (
          <>
            <dt className="text-[12px] text-[#667085]">{figure.label}</dt>
            <dd className="mt-0.5 flex items-baseline gap-1">
              <span className="text-[24px] font-bold leading-none tabular-nums" style={{ color }}>
                {figure.value}
              </span>
              {figure.unit && <span className="text-[12px] text-[#8A96A8]">{figure.unit}</span>}
            </dd>
          </>
        );
        return (
          <div key={figure.label} className="flex items-stretch">
            {i > 0 && <span aria-hidden className="mr-1 w-px self-stretch bg-[#E7EEF6]" />}
            {figure.onClick ? (
              <button
                type="button"
                onClick={figure.onClick}
                aria-pressed={figure.active}
                className={`rounded-lg px-3.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
                  figure.active ? 'bg-[#EAF3FC]' : 'hover:bg-[#F3F6FA]'
                }`}
              >
                {inner}
              </button>
            ) : (
              <div className="px-3.5 py-1.5">{inner}</div>
            )}
          </div>
        );
      })}
    </dl>
  );
}

/** 화면 맨 아래 출처 한 줄. 어느 숫자가 실제 값이고 어느 것이 시연 값인지 밝힌다. */
export function SourceNote({ children }: { children: ReactNode }) {
  return <p className="px-1 text-[11.5px] leading-relaxed text-[#98A2B3]">{children}</p>;
}
