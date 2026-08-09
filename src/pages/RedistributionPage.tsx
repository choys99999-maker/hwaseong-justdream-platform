import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  ArrowRight,
  Boxes,
  Check,
  ChevronDown,
  ChevronUp,
  Info,
  PackageSearch,
  Repeat2,
  RotateCcw,
  TimerReset,
} from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import DataTable from '../components/common/DataTable';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import EmptyState from '../components/common/EmptyState';
import DistrictRiskChart from '../components/charts/DistrictRiskChart';
import { getSiteById, mockSites } from '../data/mockSites';
import { mockRedistributionRecords } from '../data/mockRedistributions';
import { citySummary, redistributionRecommendations } from '../data/operationSummary';
import { REGION_NAMES } from '../data/regionMeta';
import {
  PLAN_STATUS_ORDER,
  getPlanSnapshot,
  planStatusOf,
  setPlanStatus,
  subscribePlan,
  type PlanStatus,
} from '../store/redistributionPlan';
import { formatDate, formatNumber } from '../utils/format';
import type { OperationSite, RedistributionRecommendation } from '../types';

// ─── 상태 배지 ──────────────────────────────────────────────────────────────

const PLAN_BADGE: Record<PlanStatus, string> = {
  '제안': 'bg-slate-100 text-slate-600 ring-slate-500/20',
  '검토중': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  '승인': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  '완료': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

function PlanStatusBadge({ status }: { status: PlanStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${PLAN_BADGE[status]}`}
    >
      {status}
    </span>
  );
}

// ─── 추천 카드 내부 조각 ─────────────────────────────────────────────────────

/** 출발/도착 기관의 현재 재고 · 7일 예상 수요 · 이동 후 재고 미니 표 */
function SiteFlowBox({
  role,
  site,
  afterStock,
}: {
  role: '출발 기관' | '도착 기관';
  site: OperationSite;
  afterStock: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">{role}</p>
        <SiteStatusBadge status={site.status} />
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-slate-800" title={site.name}>
        {site.displayName}
      </p>
      <p className="text-[11px] text-slate-400">{REGION_NAMES[site.district]}</p>
      <dl className="mt-2 space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">현재 재고</dt>
          <dd className="font-medium tabular-nums text-slate-800">{formatNumber(site.inventoryCount)}개</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-500">7일 예상 수요</dt>
          <dd className="font-medium tabular-nums text-slate-800">{formatNumber(site.sevenDayDemand)}개</dd>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-1">
          <dt className="text-slate-500">이동 후 재고</dt>
          <dd
            className={`font-semibold tabular-nums ${
              afterStock >= site.sevenDayDemand ? 'text-teal-700' : 'text-rose-600'
            }`}
          >
            {formatNumber(afterStock)}개
          </dd>
        </div>
      </dl>
    </div>
  );
}

/** 사람이 검증할 수 있는 추천 근거. 수치는 전부 카드에 보이는 값에서 계산된다. */
function buildReasons(
  rec: RedistributionRecommendation,
  from: OperationSite,
  to: OperationSite,
): string[] {
  const fromAfter = from.inventoryCount - rec.moveQuantity;
  const toAfter = to.inventoryCount + rec.moveQuantity;
  const reasons = [
    `도착 기관 부족 예상 — 7일 예상 수요 ${formatNumber(to.sevenDayDemand)}개 대비 현재 재고 ${formatNumber(
      to.inventoryCount,
    )}개 (${formatNumber(rec.shortageQuantity)}개 부족)`,
    `출발 기관은 이동 후에도 재고 ${formatNumber(fromAfter)}개 — 7일 예상 수요(${formatNumber(
      from.sevenDayDemand,
    )}개)의 120% 이상을 유지`,
    from.district === to.district
      ? `동일 품목(${rec.item})을 같은 구 안에서 보유한 기관을 우선 선정`
      : `같은 구에 여유 기관이 없어 동일 품목(${rec.item}) 여유가 가장 큰 기관을 선정`,
  ];
  if (from.expiringCount > 0) {
    reasons.push(`출발 기관에 유통기한 임박 ${formatNumber(from.expiringCount)}개 존재 — 임박분 우선 이동 권장`);
  }
  if (toAfter < to.sevenDayDemand) {
    reasons.push(
      `이동 후에도 도착 기관에 ${formatNumber(to.sevenDayDemand - toAfter)}개 부족이 남음 — 추가 확보 병행 필요`,
    );
  }
  return reasons;
}

const ACTION_BTN =
  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

/** 상태별 다음 조치 버튼. 제안 → 검토중 → 승인 → 완료 순서로만 진행한다. */
function PlanActions({ id, status }: { id: string; status: PlanStatus }) {
  if (status === '제안') {
    return (
      <button onClick={() => setPlanStatus(id, '검토중')} className={`${ACTION_BTN} bg-teal-600 text-white hover:bg-teal-700`}>
        검토하기
      </button>
    );
  }
  if (status === '검토중') {
    return (
      <div className="flex items-center gap-1.5">
        <button onClick={() => setPlanStatus(id, '승인')} className={`${ACTION_BTN} bg-teal-600 text-white hover:bg-teal-700`}>
          <Check size={13} />
          승인
        </button>
        <button onClick={() => setPlanStatus(id, '제안')} className={`${ACTION_BTN} border border-slate-200 text-slate-600 hover:bg-slate-50`}>
          보류
        </button>
      </div>
    );
  }
  if (status === '승인') {
    return (
      <button onClick={() => setPlanStatus(id, '완료')} className={`${ACTION_BTN} border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100`}>
        이동 완료 처리
      </button>
    );
  }
  return (
    <button onClick={() => setPlanStatus(id, '제안')} className={`${ACTION_BTN} text-slate-400 hover:text-slate-600`}>
      <RotateCcw size={12} />
      초기화
    </button>
  );
}

// ─── 추천 카드 ──────────────────────────────────────────────────────────────

function RecommendationCard({
  rec,
  status,
  expanded,
  onToggle,
}: {
  rec: RedistributionRecommendation;
  status: PlanStatus;
  expanded: boolean;
  onToggle: () => void;
}) {
  const from = getSiteById(rec.fromSiteId);
  const to = getSiteById(rec.toSiteId);
  if (!from || !to) return null;

  const reasons = buildReasons(rec, from, to);

  return (
    <article className={`rounded-xl border bg-white ${status === '완료' ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
      {/* 헤더: 우선순위 · 품목 · 이동량 · 상태 · 조치 버튼 */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
            우선순위 {rec.priority}
          </span>
          <PlanStatusBadge status={status} />
          <h3 className="text-sm font-semibold text-slate-900">
            {rec.item}
            <span className="ml-1.5 text-teal-700">{formatNumber(rec.moveQuantity)}개 이동 검토</span>
          </h3>
        </div>
        <PlanActions id={rec.id} status={status} />
      </div>

      <div className="space-y-3 px-4 py-3">
        {/* 이동 경로 */}
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-slate-700">
          <span className="font-medium">{from.displayName}</span>
          <ArrowRight size={14} className="text-teal-600" />
          <span className="font-medium">{to.displayName}</span>
          <span className="text-xs text-slate-400">
            {from.district === to.district
              ? `${REGION_NAMES[to.district]} 내 이동`
              : `${REGION_NAMES[from.district]} → ${REGION_NAMES[to.district]}`}
          </span>
        </p>

        {/* 출발/도착 재고·수요·이동 후 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SiteFlowBox role="출발 기관" site={from} afterStock={from.inventoryCount - rec.moveQuantity} />
          <SiteFlowBox role="도착 기관" site={to} afterStock={to.inventoryCount + rec.moveQuantity} />
        </div>

        {/* 추천 근거 */}
        <div className="rounded-lg bg-slate-50">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            추천 근거 {expanded ? '접기' : '보기'} · {reasons.length}건
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {expanded && (
            <ul className="space-y-1.5 border-t border-slate-200/70 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
              {reasons.map((reason) => (
                <li key={reason} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500" />
                  {reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </article>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

const shortageTopSites = [...mockSites]
  .filter((site) => site.expectedShortage > 0)
  .sort((a, b) => b.expectedShortage - a.expectedShortage)
  .slice(0, 10);

type StatusFilter = 'all' | PlanStatus;

export default function RedistributionPage() {
  const planStatuses = useSyncExternalStore(subscribePlan, getPlanSnapshot);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  // 우선순위 1번은 근거를 펼친 채로 시작한다.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(redistributionRecommendations.slice(0, 1).map((rec) => rec.id)),
  );

  const statusCounts = useMemo(() => {
    const counts: Record<PlanStatus, number> = { '제안': 0, '검토중': 0, '승인': 0, '완료': 0 };
    for (const rec of redistributionRecommendations) {
      counts[planStatusOf(planStatuses, rec.id)] += 1;
    }
    return counts;
  }, [planStatuses]);

  const visibleRecommendations = useMemo(
    () =>
      redistributionRecommendations.filter(
        (rec) => statusFilter === 'all' || planStatusOf(planStatuses, rec.id) === statusFilter,
      ),
    [planStatuses, statusFilter],
  );

  const pendingCount = statusCounts['제안'] + statusCounts['검토중'];

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="배분·재배분"
        description="부족·과잉·유통기한 정보를 바탕으로 기관 간 이동을 검토하고 확정하는 화면입니다. 추천은 합성 데이터에 부족·여유 규칙을 적용한 결정론적 계산입니다."
      />

      {/* 핵심 지표 */}
      <section aria-label="배분·재배분 지표">
        <div className="mb-1.5 flex items-center gap-1.5">
          <h2 className="text-xs font-medium text-slate-500">수요·재고 요약</h2>
          <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
            시연 데이터
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="부족 예상 기관"
            value={`${formatNumber(citySummary.shortageSiteCount)}개소`}
            icon={PackageSearch}
            description={`부족 수량 ${formatNumber(citySummary.shortageQuantity)}개`}
            tone="danger"
          />
          <StatCard
            label="과잉 재고 기관"
            value={`${formatNumber(citySummary.surplusSiteCount)}개소`}
            icon={Boxes}
            description="7일 수요의 2배 이상 보유"
          />
          <StatCard
            label="유통기한 임박"
            value={`${formatNumber(citySummary.expiringQuantity)}개`}
            icon={TimerReset}
            tone="warning"
            description="우선 배부·이동 검토 대상"
          />
          <StatCard
            label="재배분 검토 대기"
            value={`${formatNumber(pendingCount)}건`}
            icon={Repeat2}
            description={`승인 ${formatNumber(statusCounts['승인'])} · 완료 ${formatNumber(statusCounts['완료'])}`}
          />
        </div>
      </section>

      {/* 추천 목록 */}
      <section className="space-y-3" aria-label="재배분 추천 목록">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-slate-900">재배분 추천</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              부족 예상이 큰 기관부터, 같은 품목을 여유 있게 보유한 기관과 짝지어 추천합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="검토 상태 필터">
            <FilterChip
              label={`전체 ${redistributionRecommendations.length}`}
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
            />
            {PLAN_STATUS_ORDER.map((status) => (
              <FilterChip
                key={status}
                label={`${status} ${statusCounts[status]}`}
                active={statusFilter === status}
                onClick={() => setStatusFilter(status)}
              />
            ))}
          </div>
        </div>

        {visibleRecommendations.length === 0 ? (
          <EmptyState
            message={
              statusFilter === 'all'
                ? '현재 추천할 재배분이 없습니다.'
                : `'${statusFilter}' 상태의 추천이 없습니다.`
            }
          />
        ) : (
          <div className="space-y-3">
            {visibleRecommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                rec={rec}
                status={planStatusOf(planStatuses, rec.id)}
                expanded={expandedIds.has(rec.id)}
                onToggle={() => toggleExpanded(rec.id)}
              />
            ))}
          </div>
        )}

        <p className="flex items-start gap-1.5 text-[11px] text-slate-400">
          <Info size={12} className="mt-0.5 shrink-0" />
          검토 상태는 이 세션에만 저장됩니다. 실제 운영 전환 시 승인·완료 이력이 중앙 저장소에 기록되도록 연결합니다.
        </p>
      </section>

      {/* 보조: 부족 상위 거점 + 구별 위험 차트 */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="보조 분석">
        <div className="space-y-3">
          <div>
            <h3 className="text-base font-semibold text-slate-900">예상 부족 상위 기관</h3>
            <p className="mt-1 text-sm text-slate-500">7일 예상 수요 대비 부족이 큰 기관부터 표시합니다.</p>
          </div>
          <DataTable<OperationSite>
            columns={[
              { key: 'name', header: '기관명', render: (row) => row.displayName },
              { key: 'district', header: '구', render: (row) => REGION_NAMES[row.district] },
              { key: 'inventoryCount', header: '현재 재고', render: (row) => `${formatNumber(row.inventoryCount)}개` },
              { key: 'sevenDayDemand', header: '7일 예상 수요', render: (row) => `${formatNumber(row.sevenDayDemand)}개` },
              { key: 'expectedShortage', header: '예상 부족', render: (row) => `${formatNumber(row.expectedShortage)}개` },
              { key: 'focusItem', header: '주요 품목', render: (row) => row.focusItem },
            ]}
            data={shortageTopSites}
            rowKey={(row) => row.id}
            emptyMessage="부족 예상 기관이 없습니다."
          />
        </div>
        <DistrictRiskChart />
      </section>

      {/* 완료된 재배분 이력 */}
      <section className="space-y-3" aria-label="재배분 이력">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-slate-900">최근 재배분 이력</h3>
          <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
            시연
          </span>
        </div>
        <DataTable
          columns={[
            { key: 'date', header: '일자', render: (row: (typeof mockRedistributionRecords)[number]) => formatDate(row.date) },
            { key: 'item', header: '품목', render: (row) => row.item },
            { key: 'quantity', header: '수량', render: (row) => `${formatNumber(row.quantity)}개` },
            { key: 'from', header: '출발 기관', render: (row) => row.fromSiteName },
            { key: 'to', header: '도착 기관', render: (row) => row.toSiteName },
            { key: 'district', header: '구', render: (row) => row.districtName },
          ]}
          data={[...mockRedistributionRecords].sort((a, b) => b.date.localeCompare(a.date))}
          rowKey={(row) => row.id}
          emptyMessage="재배분 이력이 없습니다."
        />
      </section>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
