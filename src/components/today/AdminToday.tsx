import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PhoneIncoming } from 'lucide-react';
import TodayQueue, { TODAY_KIND_LABELS, type TodayItem, type TodayKind } from './TodayQueue';
import OperationMapSection from '../dashboard/OperationMapSection';
import OperationAnalytics from '../dashboard/OperationAnalytics';
import CentralDataNotice from '../common/CentralDataNotice';
import { useCentralData } from '../../hooks/useCentralData';
import { listHelpRequests } from '../../store/helpRequests';
import { listDonations } from '../../store/donations';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { getCityOverview, listMonthlyActivity, listRegionUsage } from '../../store/analytics';
import { listOrganizations, listSubmissions } from '../../store/remote';
import { operationActionItems } from '../../data/actionItems';
import { mockSites } from '../../data/mockSites';
import { buildSiteRows, updateGapLabel } from '../../utils/siteOperations';
import { formatUpdatedAt } from '../../utils/submission';
import { formatNumber } from '../../utils/format';

/** 첫 화면에서 스크롤 없이 볼 수 있는 조치 건수. Analytics Zone이 생기며 업무 큐 비중을 낮춘다(§19). */
const QUEUE_LIMIT = 6;

const KIND_ORDER: TodayKind[] = ['help', 'donation', 'stale', 'supply'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * 시 관리자 첫 화면 (Hwaseong Civic Intelligence).
 *
 * KPI 대시보드가 아니라 "화성시 전체가 지금 어떻게 돌아가는지"를 지도 하나로 먼저 답한다.
 *   1) Hero 헤드라인 — 화성시 그냥드림 / 몇 곳을 운영 중인지 / 지금 몇 곳을 확인해야 하는지
 *   2) 화성시 거점 지도 — 첫 화면 시각 비중의 대부분을 차지하는 hero. 그 조치가 어디에서 벌어지는지
 *   3) 운영 분석 — 이용 추이 · 권역별 이용 · 운영 리스크. "왜/어디" 를 답하는 그림
 *   4) 조치 큐 — 미처리 도움 요청 / 오늘 들어온 기부 / 정보 갱신 필요 거점 / 부족·확인 필요 거점
 *   5) 보조 통계 — 판단이 끝난 뒤에 보는 값. 맨 아래에만 둔다.
 */
export default function AdminToday() {
  const [kindFilter, setKindFilter] = useState<TodayKind | null>(null);

  // 시민 큐(도움 요청·기부)와 현장 입력 현황. 하나가 실패해도 나머지는 그린다.
  const { data: queueData, error: queueError, isLoading: queueLoading } = useCentralData(
    () =>
      Promise.all([listHelpRequests(), listDonations(), listSiteQuickStatus()]).then(
        ([helpRequests, donations, quickStatus]) => ({ helpRequests, donations, quickStatus }),
      ),
    [],
  );

  // 보조 통계 + Analytics Zone — 첫 화면의 즉각적인 판단(지도)에는 쓰지 않는 값이라 따로 읽는다.
  const { data: statsData, error: statsError, isLoading: statsLoading } = useCentralData(
    () =>
      Promise.all([
        getCityOverview(),
        listSubmissions(),
        listOrganizations(),
        listMonthlyActivity(),
        listRegionUsage(),
      ]).then(([overview, submissions, organizations, monthly, regionUsage]) => ({
        overview,
        submissions,
        organizations,
        monthly,
        regionUsage,
      })),
    [],
  );
  const hasCentralUsageData = (statsData?.overview.submissionCount ?? 0) > 0;

  const siteRows = useMemo(() => buildSiteRows(queueData?.quickStatus ?? null), [queueData]);

  const items = useMemo<TodayItem[]>(() => {
    const help: TodayItem[] = (queueData?.helpRequests ?? [])
      .filter((request) => request.status === 'NEW')
      .map((request) => ({
        id: `help-${request.id}`,
        kind: 'help' as const,
        place: request.dong,
        what: `${request.itemCategory} 도움 요청${request.channel === 'PHONE' ? ' (전화 접수)' : ''}`,
        when: `${formatTime(request.createdAt)} 접수`,
        to: `/admin/intake?tab=help&id=${request.id}`,
      }));

    const donation: TodayItem[] = (queueData?.donations ?? [])
      .filter((row) => row.status === 'NEW')
      .map((row) => ({
        id: `donation-${row.id}`,
        kind: 'donation' as const,
        place: row.region,
        what: `${row.itemName} ${row.quantity}개 기부`,
        when: `${formatTime(row.createdAt)} 접수`,
        to: `/admin/intake?tab=donation&id=${row.id}`,
      }));

    // 현장 입력이 오래된 거점 — site_quick_status 의 실제 갱신 시각 기준이다.
    // 조회 자체가 안 된 상태에서는 계산하지 않는다. 못 읽은 것을 "미갱신"으로 부르면 거짓말이 된다.
    const stale: TodayItem[] = (queueData ? siteRows : [])
      .filter((row) => row.needsUpdate)
      .sort((a, b) => (b.hoursSinceUpdate ?? Infinity) - (a.hoursSinceUpdate ?? Infinity))
      .map((row) => ({
        id: `stale-${row.site.id}`,
        kind: 'stale' as const,
        place: row.site.displayName,
        what: '거점 현황 갱신 필요',
        when: updateGapLabel(row),
        to: `/admin/sites/${row.site.id}?tab=quick`,
      }));

    const supply: TodayItem[] = operationActionItems.map((action) => ({
      id: action.id,
      kind: 'supply' as const,
      place: action.siteName,
      what: action.summary,
      when: action.suggestion,
      to: `/admin/sites/${action.siteId}`,
    }));

    return [...help, ...donation, ...stale, ...supply];
  }, [queueData, siteRows]);

  const countOf = (kind: TodayKind) => items.filter((item) => item.kind === kind).length;
  const visibleItems = kindFilter ? items.filter((item) => item.kind === kindFilter) : items;

  // 지도 위 요약 — 확정 거점 명단(25곳)과 현장 입력 갱신 시각만 쓴다.
  const statusCounts = useMemo(
    () => ({
      total: mockSites.length,
      normal: mockSites.filter((site) => site.status === 'normal').length,
      shortage: mockSites.filter((site) => site.status === 'shortage').length,
      needsCheck: mockSites.filter((site) => site.status === 'expiring' || site.status === 'missing').length,
    }),
    [],
  );
  const lastFieldUpdate = useMemo(() => {
    const times = siteRows.map((row) => row.quickStatus?.updatedAt).filter((v): v is string => Boolean(v));
    return times.length > 0 ? times.reduce((latest, v) => (v > latest ? v : latest)) : null;
  }, [siteRows]);

  const flaggedCount = (statsData?.submissions ?? []).filter((s) => s.issueCount > 0).length;
  const submittedOrgCount = new Set((statsData?.submissions ?? []).map((s) => s.organizationName)).size;

  /** 헤드라인 "N곳" — 정상이 아닌 거점 수. 지도 위 KPI 칩과 같은 원천(mockSites)이라 숫자가 서로 어긋나지 않는다. */
  const attentionSiteCount = statusCounts.shortage + statusCounts.needsCheck;

  // Hero 보조 지표 — 실제 월별 집계(v_monthly_activity)가 있을 때만 보여준다. 없는 기간을 지어내지 않는다.
  const monthly = statsData?.monthly ?? [];
  const latestMonth = monthly.length > 0 ? monthly[monthly.length - 1] : null;
  const previousMonth = monthly.length > 1 ? monthly[monthly.length - 2] : null;
  const momChangePct =
    latestMonth && previousMonth && previousMonth.count > 0
      ? Math.round(((latestMonth.count - previousMonth.count) / previousMonth.count) * 100)
      : null;

  return (
    <div
      className="space-y-6 rounded-[24px] p-1"
      style={{
        background:
          'radial-gradient(circle at 30% 4%, rgba(0,70,150,0.09), transparent 42%), ' +
          'linear-gradient(180deg, #EDF4FA 0%, #F3F6FA 45%, #EEF3F8 100%)',
      }}
    >
      {/* ── 1. Hero 헤드라인 — 첫 화면의 시선이 여기서 시작해 곧장 지도로 내려간다 ── */}
      <div className="hci-fade-up px-1 pt-1" style={{ animationDelay: '80ms' }}>
        <p className="text-[14px] font-semibold tracking-wide text-[#004696]">화성시 그냥드림</p>
        <h1 className="mt-1 text-[38px] font-extrabold leading-[1.15] tracking-[-0.01em] text-[#172433]">
          {statusCounts.total}개 거점의 흐름을 한눈에
        </h1>
        <p className="mt-1.5 text-sm text-[#667085]">
          현재 <strong className="font-bold text-[#DC6E2D]">{attentionSiteCount}곳</strong>의 확인이 필요합니다
          {lastFieldUpdate && ` · 최근 현황 갱신 ${formatUpdatedAt(lastFieldUpdate)}`}
        </p>

        {/* 실제 집계가 있을 때만 붙는 보조 지표 2~3개. 없는 값은 만들지 않는다(§6). */}
        {(latestMonth || lastFieldUpdate) && (
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
            {latestMonth && (
              <HeroMetric label="이번 달 이용" value={`${formatNumber(latestMonth.count)}건`} />
            )}
            {momChangePct !== null && (
              <HeroMetric
                label="전월 대비"
                value={`${momChangePct > 0 ? '+' : ''}${momChangePct}%`}
                tone={momChangePct >= 0 ? 'blue' : 'orange'}
              />
            )}
            {lastFieldUpdate && <HeroMetric label="최근 현황 갱신" value={formatUpdatedAt(lastFieldUpdate)} />}
          </div>
        )}
      </div>

      {/* ── 2. 화성시 거점 지도 — hero. 화면 시각 비중의 대부분을 차지한다 ── */}
      <section aria-label="화성시 거점 현황">
        <OperationMapSection />
      </section>

      {/* ── 3. 운영 분석 — 이용 추이 · 권역별 이용 · 운영 리스크. 판단이 끝난 뒤에 보는 "왜/어디"(§14~18) ── */}
      {statsError && (
        <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
          운영 분석 자료를 불러오지 못했습니다: {statsError}
        </p>
      )}
      <OperationAnalytics
        monthly={monthly}
        regionUsage={statsData?.regionUsage ?? []}
        sites={mockSites}
        isCentralDataLoading={statsLoading}
        hasCentralData={hasCentralUsageData}
      />

      {/* ── 4. 오늘 처리할 일 — 지도·분석보다 낮은 위계의 실무 처리 큐(§13, §19) ────────── */}
      <section aria-label="오늘 처리할 일" className="rounded-[14px] border border-[rgba(20,50,80,0.08)] bg-white p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[13.5px] font-semibold text-[#475569]">오늘 확인할 업무</h2>
            <span className="rounded-full bg-[#EEF2F6] px-2 py-0.5 text-[11px] font-semibold text-[#5A6678]">
              {items.length}건
            </span>
          </div>
          <Link
            to="/admin/help-requests/new"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#004696] hover:text-[#073B74] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
          >
            <PhoneIncoming size={13} />
            전화로 받은 요청 대신 입력
            <ArrowRight size={13} />
          </Link>
        </div>

        {/* 종류별 건수 — 그대로 큐 필터가 된다. 숫자 카드를 따로 만들지 않는다. */}
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="조치 종류 필터">
          <FilterChip label="전체" count={items.length} active={kindFilter === null} onClick={() => setKindFilter(null)} />
          {KIND_ORDER.map((kind) => (
            <FilterChip
              key={kind}
              label={TODAY_KIND_LABELS[kind]}
              count={countOf(kind)}
              active={kindFilter === kind}
              onClick={() => setKindFilter(kindFilter === kind ? null : kind)}
            />
          ))}
        </div>

        {queueError && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
            시민 접수 큐를 불러오지 못했습니다: {queueError}
          </p>
        )}

        <div className="mt-3">
          {queueLoading ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
              불러오는 중...
            </p>
          ) : (
            <TodayQueue
              items={visibleItems}
              limit={QUEUE_LIMIT}
              emptyMessage="지금 확인이 필요한 건이 없습니다."
            />
          )}
        </div>

        <p className="mt-2 text-[11px] text-slate-400">
          도움 요청·기부·거점 갱신은 실제 접수 자료 기준입니다. 부족·유통기한 임박은 아직 거점 시연 수치입니다.
        </p>
      </section>

      {/* ── 5. 보조 통계 ─────────────────────────────────────── */}
      {statsData && (
        <section aria-label="보조 통계">
          <h2 className="mb-1.5 text-xs font-medium text-slate-500">보조 통계</h2>
          {statsData.overview.submissionCount === 0 ? (
            <CentralDataNotice
              isLoading={false}
              error={null}
              isEmpty
              emptyMessage="아직 올라온 제출 자료가 없습니다. Excel 자료를 올리면 이 값이 채워집니다."
            />
          ) : (
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <MiniStat
                label="자료 제출"
                value={`${formatNumber(submittedOrgCount)} / ${formatNumber(statsData.organizations.length)}곳`}
              />
              <MiniStat label="누적 이용자" value={`${formatNumber(statsData.overview.totalUsers)}명`} />
              <MiniStat
                label="중앙 집계 재고"
                value={`${formatNumber(statsData.overview.inventoryTotalStock)}개`}
              />
              <MiniStat label="자료 오류" value={`${formatNumber(flaggedCount)}건`} to="/admin/files" />
            </dl>
          )}
        </section>
      )}
    </div>
  );
}

/** Hero 아래 보조 지표 한 칸. 카드로 감싸지 않고 숫자만 강조해 헤드라인의 연장처럼 보이게 한다. */
function HeroMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'blue' | 'orange';
}) {
  const color = tone === 'blue' ? '#004696' : tone === 'orange' ? '#DC6E2D' : '#172433';
  return (
    <div>
      <p className="text-[11px] text-[#8A96A8]">{label}</p>
      <p className="text-[17px] font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label} <span className="tabular-nums">{count}</span>
    </button>
  );
}

function MiniStat({ label, value, to }: { label: string; value: string; to?: string }) {
  const body = (
    <>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-800">{value}</dd>
    </>
  );
  if (to) {
    return (
      <Link
        to={to}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 transition-colors hover:border-teal-300 hover:bg-teal-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        {body}
      </Link>
    );
  }
  return <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">{body}</div>;
}
