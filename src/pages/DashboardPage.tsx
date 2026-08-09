import { useMemo, useState, useSyncExternalStore } from 'react';
import {
  Boxes,
  FileSpreadsheet,
  MapPin,
  PackageSearch,
  Repeat2,
  TimerReset,
  Users,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import CentralDataNotice from '../components/common/CentralDataNotice';
import TodayActionSection from '../components/dashboard/TodayActionSection';
import OperationMapSection from '../components/dashboard/OperationMapSection';
import SiteCompositionModal from '../components/dashboard/SiteCompositionModal';
import MonthlyFlowChart from '../components/charts/MonthlyFlowChart';
import DistrictRiskChart from '../components/charts/DistrictRiskChart';
import { useCentralData } from '../hooks/useCentralData';
import { getCityOverview, listInventoryStatus } from '../store/analytics';
import { listSubmissions } from '../store/remote';
import { mockRedistributionRecords } from '../data/mockRedistributions';
import { citySummary, redistributionRecommendations } from '../data/operationSummary';
import { EXPIRING_THRESHOLD, mockSites } from '../data/mockSites';
import { JUSTDREAM_SITE_SUMMARY } from '../data/justdreamSummary';
import { countPendingReview, getPlanSnapshot, subscribePlan } from '../store/redistributionPlan';
import { inventoryStatusOf } from '../utils/inventoryStatus';
import { formatUpdatedAt } from '../utils/submission';
import { formatDate, formatNumber } from '../utils/format';

const recentRedistributions = [...mockRedistributionRecords]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5);

/** 유통기한 임박 수량이 기준 이상인 거점 수 (시연 데이터 기준) */
const expiringSiteCount = mockSites.filter((site) => site.expiringCount >= EXPIRING_THRESHOLD).length;

/** 유통기한 임박 패널에 올릴 최대 건수 */
const EXPIRING_PANEL_LIMIT = 5;
/** 확인 필요 알림 패널에 올릴 최대 건수 */
const ISSUE_PANEL_LIMIT = 5;

export default function DashboardPage() {
  const [isCompositionModalOpen, setIsCompositionModalOpen] = useState(false);

  // 재배분 검토 상태 — 배분·재배분 화면에서 처리하면 이 KPI가 즉시 줄어든다.
  const planStatuses = useSyncExternalStore(subscribePlan, getPlanSnapshot);
  const pendingRedistribution = countPendingReview(
    planStatuses,
    redistributionRecommendations.map((rec) => rec.id),
  );

  // 중앙 저장소 집계. 지도·거점 현황·조치 목록은 이 조회와 무관하게 항상 그려진다.
  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([getCityOverview(), listInventoryStatus(), listSubmissions()]).then(
        ([overview, inventory, submissions]) => ({ overview, inventory, submissions }),
      ),
    [],
  );

  const overview = data?.overview ?? null;

  /** 유통기한이 가까운 순. 이미 지난 품목이 먼저 온다. */
  const expiringItems = useMemo(
    () =>
      (data?.inventory ?? [])
        .filter((item) => item.isExpiringSoon || item.isExpired)
        .sort((a, b) => (a.expirationDate ?? '').localeCompare(b.expirationDate ?? ''))
        .slice(0, EXPIRING_PANEL_LIMIT),
    [data],
  );

  /** 저장 시 검증이 값 오류를 잡은 제출 자료. */
  const flaggedSubmissions = useMemo(
    () =>
      (data?.submissions ?? [])
        .filter((submission) => submission.issueCount > 0)
        .slice(0, ISSUE_PANEL_LIMIT),
    [data],
  );

  const hasCentralData = (overview?.submissionCount ?? 0) > 0;

  return (
    <div className="space-y-3">
      {/*
        핵심 KPI 4개 — 담당자가 화면을 열자마자 "어디에 문제가 있는지"를 판단하는 값.
        운영 기관 수는 확정 자료(justdream_sites_25), 부족·임박·재배분은 시연용 합성 수치다.
      */}
      <section aria-label="핵심 운영 지표">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <h2 className="text-xs font-medium text-slate-500">핵심 운영 지표</h2>
          <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
            부족·임박·재배분은 시연 데이터
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setIsCompositionModalOpen(true)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">운영 기관</p>
                <p className="mt-1.5 text-xl font-semibold text-slate-900">{JUSTDREAM_SITE_SUMMARY.total}곳</p>
                <p className="mt-0.5 text-xs text-teal-600">
                  복지기관 {JUSTDREAM_SITE_SUMMARY.welfareOrgCount} · 협의체 {JUSTDREAM_SITE_SUMMARY.councilCount} ↗
                </p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <MapPin size={17} />
              </div>
            </div>
          </button>
          <StatCard
            label="부족 위험 기관"
            value={`${formatNumber(citySummary.shortageSiteCount)}곳`}
            icon={PackageSearch}
            description={`7일 내 ${formatNumber(citySummary.shortageQuantity)}개 부족 예상`}
            tone="danger"
          />
          <StatCard
            label="유통기한 임박 수량"
            value={`${formatNumber(citySummary.expiringQuantity)}개`}
            icon={TimerReset}
            description={`임박 기준 초과 기관 ${formatNumber(expiringSiteCount)}곳`}
            tone="warning"
          />
          <StatCard
            label="재배분 검토"
            value={`${formatNumber(pendingRedistribution)}건`}
            icon={Repeat2}
            description={`전체 제안 ${formatNumber(redistributionRecommendations.length)}건`}
          />
        </div>
      </section>

      {isCompositionModalOpen && <SiteCompositionModal onClose={() => setIsCompositionModalOpen(false)} />}

      {/* 오늘 조치가 필요한 사항 — KPI 바로 아래, 지도보다 먼저 온다. */}
      <TodayActionSection />

      {/* 지도 — 조치가 필요한 위치를 공간적으로 확인한다. */}
      <OperationMapSection />

      {/* 중앙 저장소 집계 — 읍면동이 올린 Excel 자료에서 계산한 실제 값이다. */}
      <section aria-label="중앙 자료 집계">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <h2 className="text-xs font-medium text-slate-500">중앙 자료 집계</h2>
          <span className="rounded bg-teal-50 px-1.5 py-px text-[10px] font-medium text-teal-700 ring-1 ring-teal-600/20">
            실제 제출 데이터
          </span>
          <span className="text-[11px] text-slate-400">
            재제출로 대체된 자료와 누계 시트는 빼고 집계합니다
            {overview?.lastUploadedAt ? ` · 최근 제출 ${formatUpdatedAt(overview.lastUploadedAt)}` : ''}
          </span>
        </div>

        <CentralDataNotice
          isLoading={isLoading}
          error={error}
          isEmpty={!hasCentralData}
          emptyMessage="아직 올라온 제출 자료가 없습니다. Excel 자료를 올리면 이 구역의 값이 채워집니다."
        />

        {hasCentralData && overview && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="제출 자료"
              value={`${formatNumber(overview.submissionCount)}건`}
              icon={FileSpreadsheet}
              description={`${formatNumber(overview.organizationCount)}개 읍면동 제출`}
            />
            <StatCard
              label="누적 이용자"
              value={`${formatNumber(overview.totalUsers)}명`}
              icon={Users}
              description={`기본상담 ${formatNumber(overview.totalConsultations)}건 · 연계 완료 ${formatNumber(
                overview.totalLinkageCompleted,
              )}건`}
            />
            <StatCard
              label="전체 재고 수량"
              value={`${formatNumber(overview.inventoryTotalStock)}개`}
              icon={Boxes}
              description={`${formatNumber(overview.inventoryItemCount)}개 품목`}
            />
            <StatCard
              label="유통기한 임박"
              value={`${formatNumber(overview.expiringSoonCount)}건`}
              icon={TimerReset}
              description={`기한 경과 ${formatNumber(overview.expiredCount)}건`}
              tone="warning"
            />
          </div>
        )}
      </section>

      {/* 보조 차트 — 추이 확인용. 조치 판단은 위 구역에서 끝나는 것이 원칙이다. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyFlowChart />
        <DistrictRiskChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-slate-900">최근 재배분 내역</h3>
            <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
              시연
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {recentRedistributions.length === 0 ? (
              <EmptyState message="최근 재배분 내역이 없습니다." />
            ) : (
              recentRedistributions.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">
                      {record.fromSiteName} → {record.toSiteName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {record.districtName} · {formatDate(record.date)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <p>{record.item}</p>
                    <p>{formatNumber(record.quantity)}개</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <h3 className="text-base font-semibold text-slate-900">유통기한 임박 물품</h3>
          <div className="mt-3 space-y-2">
            {!hasCentralData ? (
              <EmptyState message="제출된 물품 자료가 없습니다." />
            ) : expiringItems.length === 0 ? (
              <EmptyState message="유통기한 임박 물품이 없습니다." />
            ) : (
              expiringItems.map((item) => (
                <div
                  key={`${item.organizationId}-${item.itemName}`}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-800">{item.itemName}</p>
                    <p className="text-xs text-slate-400">{item.organizationName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-slate-500">
                      {item.expirationDate ? formatDate(item.expirationDate) : '—'}
                    </p>
                    <StatusBadge status={inventoryStatusOf(item)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <h3 className="text-base font-semibold text-slate-900">데이터 오류 및 확인 필요 알림</h3>
          <div className="mt-3 space-y-2">
            {!hasCentralData ? (
              <EmptyState message="검증할 제출 자료가 없습니다." />
            ) : flaggedSubmissions.length === 0 ? (
              <EmptyState message="확인이 필요한 제출 자료가 없습니다." />
            ) : (
              flaggedSubmissions.map((submission) => (
                <div key={submission.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-slate-800">{submission.fileName}</p>
                    <StatusBadge status="확인 필요" />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    값 오류 {formatNumber(submission.issueCount)}건 · 전체 {formatNumber(submission.recordCount)}건
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {submission.organizationName} · {formatUpdatedAt(submission.uploadedAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
