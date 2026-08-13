import { useMemo, useState } from 'react';
import {
  Boxes,
  FileSpreadsheet,
  HeartHandshake,
  MapPin,
  PackageSearch,
  TimerReset,
  Users,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import CentralDataNotice from '../components/common/CentralDataNotice';
import TodayActionSection from '../components/dashboard/TodayActionSection';
import TodayHelpRequestSection from '../components/dashboard/TodayHelpRequestSection';
import OperationMapSection from '../components/dashboard/OperationMapSection';
import SiteCompositionModal from '../components/dashboard/SiteCompositionModal';
import MonthlyFlowChart from '../components/charts/MonthlyFlowChart';
import DistrictRiskChart from '../components/charts/DistrictRiskChart';
import { useCentralData } from '../hooks/useCentralData';
import { getCityOverview, listInventoryStatus } from '../store/analytics';
import { listOrganizations, listSubmissions } from '../store/remote';
import { citySummary } from '../data/operationSummary';
import { JUSTDREAM_SITE_SUMMARY, JUSTDREAM_PROGRAM_TOTALS } from '../data/justdreamSummary';
import { mockVisits, mockWelfareReferrals } from '../data/mockClientRecords';
import { inventoryStatusOf } from '../utils/inventoryStatus';
import { formatUpdatedAt } from '../utils/submission';
import { formatDate, formatNumber } from '../utils/format';

/** 유통기한 임박 패널에 올릴 최대 건수 */
const EXPIRING_PANEL_LIMIT = 5;
/** 확인 필요 알림 패널에 올릴 최대 건수 */
const ISSUE_PANEL_LIMIT = 5;

/** "이번 주"는 오늘 포함 최근 7일이다. 시연 이용 기록(mockVisits) 기준 사실 집계이며 예측이 아니다. */
function isWithinLastWeek(dateIso: string): boolean {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 6);
  const weekAgoIso = weekAgo.toISOString().slice(0, 10);
  return dateIso >= weekAgoIso;
}

const thisWeekUserCount = mockVisits.filter((visit) => isWithinLastWeek(visit.visitDate)).length;
const linkageNeedsCheckCount = mockWelfareReferrals.filter(
  (referral) => referral.status === '연계요청' || referral.status === '읍면동상담중',
).length;

export default function DashboardPage() {
  const [isCompositionModalOpen, setIsCompositionModalOpen] = useState(false);

  // 중앙 저장소 집계. 지도·거점 현황·조치 목록은 이 조회와 무관하게 항상 그려진다.
  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([
        getCityOverview(),
        listInventoryStatus(),
        listSubmissions(),
        listOrganizations(),
      ]).then(([overview, inventory, submissions, organizations]) => ({
        overview,
        inventory,
        submissions,
        organizations,
      })),
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
  const allFlaggedSubmissions = useMemo(
    () => (data?.submissions ?? []).filter((submission) => submission.issueCount > 0),
    [data],
  );
  const flaggedSubmissions = useMemo(
    () => allFlaggedSubmissions.slice(0, ISSUE_PANEL_LIMIT),
    [allFlaggedSubmissions],
  );

  /** 자료를 한 번이라도 제출한 기관 수. 미제출 기관은 자료·데이터 관리에서 명단을 볼 수 있다. */
  const submittedOrgCount = useMemo(() => {
    const names = new Set((data?.submissions ?? []).map((s) => s.organizationName));
    return names.size;
  }, [data]);
  const totalOrgCount = data?.organizations.length ?? 0;

  const hasCentralData = (overview?.submissionCount ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* 오늘 확인할 요청 — 시민 도움 요청 큐. 확인이 필요한 사람 관련 조치라 맨 위에 둔다. */}
      <TodayHelpRequestSection />

      {/* 사업 규모 Hero — 화성시 그냥드림 전체 규모를 첫눈에 전달한다. 43은 사업 프로그램 수다. */}
      <section
        aria-label="화성시 그냥드림 사업 규모"
        className="rounded-xl border border-slate-200 bg-white px-5 py-3.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className="text-sm font-medium text-slate-500">화성시 그냥드림 통합 운영</h2>
            <p className="text-[26px] font-bold leading-none text-slate-900">
              {JUSTDREAM_PROGRAM_TOTALS.totalPrograms}개 프로그램
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
            <span>
              국가형 <strong className="font-semibold text-slate-800">{JUSTDREAM_PROGRAM_TOTALS.national}</strong>{' '}
              · 화성형 <strong className="font-semibold text-slate-800">{JUSTDREAM_PROGRAM_TOTALS.hwaseong}</strong>
            </span>
            <span className="hidden text-slate-300 sm:inline">|</span>
            <span className="text-xs text-slate-400">
              화성형: 읍면동 {JUSTDREAM_PROGRAM_TOTALS.hwaseongAdminCenter} · 복지관{' '}
              {JUSTDREAM_PROGRAM_TOTALS.hwaseongWelfareCenter}
            </span>
          </div>
        </div>
      </section>

      {/*
        핵심 운영 지표 5개 — 전부 시스템 집계(확정 거점 명단 또는 중앙 저장소 집계)만 쓴다.
        시연/시뮬레이션 값은 여기 섞지 않고 아래 '운영 시뮬레이션' 영역으로 분리했다.
      */}
      <section aria-label="핵심 운영 지표">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <h2 className="text-xs font-medium text-slate-500">핵심 운영 지표</h2>
          <span className="rounded bg-teal-50 px-1.5 py-px text-[10px] font-medium text-teal-700 ring-1 ring-teal-600/20">
            시스템 집계
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() => setIsCompositionModalOpen(true)}
            className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-xs text-slate-500">데이터 등록 거점</p>
                <p className="mt-1.5 text-[28px] font-bold leading-none text-slate-900">
                  {JUSTDREAM_SITE_SUMMARY.total}곳
                </p>
                <p className="mt-1.5 text-xs text-teal-600">
                  복지기관 {JUSTDREAM_SITE_SUMMARY.welfareOrgCount} · 협의체 {JUSTDREAM_SITE_SUMMARY.councilCount} ↗
                </p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <MapPin size={17} />
              </div>
            </div>
          </button>
          <StatCard
            label="자료 제출 완료"
            value={`${formatNumber(submittedOrgCount)} / ${formatNumber(totalOrgCount)}`}
            icon={FileSpreadsheet}
            description="제출 대상 읍면동 기준"
          />
          <StatCard
            label="누적 이용자"
            value={`${formatNumber(overview?.totalUsers ?? 0)}명`}
            icon={Users}
            description="중앙 저장소 제출 자료 기준"
          />
          <StatCard
            label="중앙 집계 재고"
            value={`${formatNumber(overview?.inventoryTotalStock ?? 0)}개`}
            icon={Boxes}
            description={`${formatNumber(overview?.inventoryItemCount ?? 0)}개 품목`}
          />
          <StatCard
            label="데이터 오류·확인 필요"
            value={`${formatNumber(allFlaggedSubmissions.length)}건`}
            icon={TimerReset}
            description="제출 자료 값 검증 기준"
            tone={allFlaggedSubmissions.length > 0 ? 'warning' : 'default'}
          />
        </div>
      </section>

      {isCompositionModalOpen && <SiteCompositionModal onClose={() => setIsCompositionModalOpen(false)} />}

      {/* 지도 — KPI 바로 아래 핵심 영역. 확인이 필요한 위치를 공간적으로 확인한다. */}
      <OperationMapSection />

      {/* 오늘 확인이 필요한 사항 — 거점 시연 데이터 기준이다. */}
      <TodayActionSection />

      {/*
        운영 시뮬레이션 — 아직 확정되지 않은 시연/시뮬레이션 값이다.
        지도·실제 집계보다 아래로 내리고, 카드 크기도 한 단계 낮춰(compact) 시각 위계를 구분한다.
        화성시 전체 현황 판단에는 쓰지 않는다.
      */}
      <section
        aria-label="운영 시뮬레이션"
        className="rounded-xl border border-dashed border-amber-300 bg-amber-50/30 p-3"
      >
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <h2 className="text-xs font-medium text-amber-800">운영 시뮬레이션</h2>
          <span className="rounded bg-amber-100 px-1.5 py-px text-[10px] font-medium text-amber-800 ring-1 ring-amber-600/30">
            시연 데이터 · 실제 값 아님
          </span>
        </div>
        <p className="mb-2 text-[11px] text-amber-800/70">
          거점 시연 데이터(mockSites)와 세션 시드 이용 기록 기준입니다. 화성시 전체 현황 판단에는 사용하지 마세요.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            size="compact"
            label="이번 주 이용자"
            value={`${formatNumber(thisWeekUserCount)}명`}
            icon={Users}
            description="최근 7일 이용 기록(시연)"
          />
          <StatCard
            size="compact"
            label="물품 부족 보고 거점"
            value={`${formatNumber(citySummary.shortageSiteCount)}곳`}
            icon={PackageSearch}
            description="즉시 확인 필요(시연)"
            tone="danger"
          />
          <StatCard
            size="compact"
            label="복지연계 확인 필요"
            value={`${formatNumber(linkageNeedsCheckCount)}건`}
            icon={HeartHandshake}
            description="연계요청·읍면동상담중(시연)"
            tone="warning"
          />
        </div>
      </section>

      {/* 중앙 저장소 집계 — 읍면동이 올린 Excel 자료에서 계산한 실제 값이다. */}
      <section aria-label="중앙 자료 집계">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <h2 className="text-xs font-medium text-slate-500">중앙 자료 집계</h2>
          <span className="rounded bg-teal-50 px-1.5 py-px text-[10px] font-medium text-teal-700 ring-1 ring-teal-600/20">
            테스트 업로드 기반 집계
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
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

        <section className="rounded-xl border border-slate-200 bg-white p-5">
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
