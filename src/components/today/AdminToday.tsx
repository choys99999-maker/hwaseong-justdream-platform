import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, PhoneIncoming } from 'lucide-react';
import TodayQueue, { TODAY_KIND_LABELS, type TodayItem, type TodayKind } from './TodayQueue';
import OperationMapSection from '../dashboard/OperationMapSection';
import CentralDataNotice from '../common/CentralDataNotice';
import { useCentralData } from '../../hooks/useCentralData';
import { listHelpRequests } from '../../store/helpRequests';
import { listDonations } from '../../store/donations';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { getCityOverview } from '../../store/analytics';
import { listOrganizations, listSubmissions } from '../../store/remote';
import { operationActionItems } from '../../data/actionItems';
import { mockSites } from '../../data/mockSites';
import { buildSiteRows, updateGapLabel } from '../../utils/siteOperations';
import { formatUpdatedAt } from '../../utils/submission';
import { formatNumber } from '../../utils/format';

/** 첫 화면에서 스크롤 없이 볼 수 있는 조치 건수 */
const QUEUE_LIMIT = 8;

const KIND_ORDER: TodayKind[] = ['help', 'donation', 'stale', 'supply'];

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * 시 관리자 첫 화면.
 *
 * KPI 대시보드가 아니라 "오늘 어디를 확인하고 조치해야 하는지"만 먼저 답한다.
 *   1) 조치 큐 — 미처리 도움 요청 / 오늘 들어온 기부 / 정보 갱신 필요 거점 / 부족·확인 필요 거점
 *   2) 화성시 거점 지도 — 그 조치가 어디에서 벌어지는지
 *   3) 보조 통계 — 판단이 끝난 뒤에 보는 값. 맨 아래에만 둔다.
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

  // 보조 통계 — 첫 화면의 판단에는 쓰지 않는 값이라 따로 읽는다.
  const { data: statsData } = useCentralData(
    () =>
      Promise.all([getCityOverview(), listSubmissions(), listOrganizations()]).then(
        ([overview, submissions, organizations]) => ({ overview, submissions, organizations }),
      ),
    [],
  );

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

  return (
    <div className="space-y-5">
      {/* ── 1. 오늘 처리할 일 ────────────────────────────────── */}
      <section aria-label="오늘 처리할 일" className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">오늘 처리할 일</h2>
            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">
              {items.length}건
            </span>
          </div>
          <Link
            to="/admin/help-requests/new"
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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

      {/* ── 2. 화성시 거점 지도 ───────────────────────────────── */}
      <section aria-label="화성시 거점 현황" className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
          <span className="font-semibold text-slate-900">화성시 거점 {statusCounts.total}곳</span>
          <SummaryDot color="bg-emerald-500" label="정상" value={statusCounts.normal} />
          <SummaryDot color="bg-rose-500" label="부족" value={statusCounts.shortage} />
          <SummaryDot color="bg-slate-400" label="확인 필요" value={statusCounts.needsCheck} />
          <span className="ml-auto text-xs text-slate-400">
            최근 현장 갱신 {lastFieldUpdate ? formatUpdatedAt(lastFieldUpdate) : '없음'}
          </span>
        </div>
        <OperationMapSection />
      </section>

      {/* ── 3. 보조 통계 ─────────────────────────────────────── */}
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

function SummaryDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-600">
      <span aria-hidden className={`h-2 w-2 rounded-full ${color}`} />
      {label} <strong className="font-semibold tabular-nums text-slate-800">{value}</strong>
    </span>
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
