import { useState } from 'react';
import { Boxes, Building2, HandHeart, Map, MapPin, PackageSearch, Repeat2, TimerReset } from 'lucide-react';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import OperationMapSection from '../components/dashboard/OperationMapSection';
import SiteCompositionModal from '../components/dashboard/SiteCompositionModal';
import MonthlyFlowChart from '../components/charts/MonthlyFlowChart';
import DistrictRiskChart from '../components/charts/DistrictRiskChart';
import { mockInventoryItems } from '../data/mockInventory';
import { mockDataIssues } from '../data/mockDataIssues';
import { mockRedistributionRecords } from '../data/mockRedistributions';
import { citySummary } from '../data/operationSummary';
import { JUSTDREAM_SITE_SUMMARY, SITE_COUNT_BY_DISTRICT } from '../data/justdreamSummary';
import { formatDate, formatNumber } from '../utils/format';

const expiringItems = mockInventoryItems
  .filter((item) => item.status === '임박')
  .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
const recentRedistributions = [...mockRedistributionRecords]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5);

export default function DashboardPage() {
  const [isCompositionModalOpen, setIsCompositionModalOpen] = useState(false);

  return (
    <div className="space-y-3">
      {/*
        핵심 KPI — 전부 justdream_sites_25(확정 데이터)에서 계산한 값이다.
        아래 운영 지표는 아직 시연용 합성 수치라, 같은 줄에 섞지 않고 구역을 나눠 표기한다.
      */}
      <section aria-label="운영 거점 현황">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => setIsCompositionModalOpen(true)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-slate-500">전체 운영 거점</p>
                <p className="mt-1.5 text-xl font-semibold text-slate-900">{JUSTDREAM_SITE_SUMMARY.total}곳</p>
                <p className="mt-0.5 text-xs text-teal-600">거점 구성 보기 ↗</p>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                <MapPin size={17} />
              </div>
            </div>
          </button>
          <StatCard
            label="복지기관"
            value={`${JUSTDREAM_SITE_SUMMARY.welfareOrgCount}곳`}
            icon={Building2}
            description="종합사회복지관 · 노인/장애인복지관"
          />
          <StatCard
            label="지역사회보장협의체"
            value={`${JUSTDREAM_SITE_SUMMARY.councilCount}곳`}
            icon={HandHeart}
            description="읍면동 행정복지센터 운영"
          />
          <StatCard
            label="운영 권역"
            value={`${JUSTDREAM_SITE_SUMMARY.districtCount}개 구`}
            icon={Map}
            description={SITE_COUNT_BY_DISTRICT.map((d) => `${d.name} ${d.count}`).join(' · ')}
          />
        </div>
      </section>

      {isCompositionModalOpen && <SiteCompositionModal onClose={() => setIsCompositionModalOpen(false)} />}

      {/* 운영 지표 — 재고·수요·유통기한은 아직 확정 자료가 없는 시연용 수치다. */}
      <section aria-label="운영 지표 (시연 데이터)">
        <div className="mb-1.5 flex items-center gap-1.5">
          <h2 className="text-xs font-medium text-slate-500">운영 지표</h2>
          <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
            시연 데이터
          </span>
          <span className="text-[11px] text-slate-400">재고·수요·유통기한 수치는 실제 운영 데이터가 아닙니다</span>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="전체 재고 수량" value={`${formatNumber(citySummary.inventoryTotal)}개`} icon={Boxes} />
          <StatCard
            label="7일 내 부족 예상"
            value={`${formatNumber(citySummary.shortageSiteCount)}개소`}
            icon={PackageSearch}
            description={`부족 ${formatNumber(citySummary.shortageQuantity)}개`}
            tone="danger"
          />
          <StatCard
            label="유통기한 임박"
            value={`${formatNumber(citySummary.expiringQuantity)}개`}
            icon={TimerReset}
            tone="warning"
          />
          <StatCard label="재배분 필요 건수" value={`${formatNumber(citySummary.recommendationCount)}건`} icon={Repeat2} />
        </div>
      </section>

      <OperationMapSection />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlyFlowChart />
        <DistrictRiskChart />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <h3 className="text-base font-semibold text-slate-900">최근 재배분 내역</h3>
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
            {expiringItems.length === 0 ? (
              <EmptyState message="유통기한 임박 물품이 없습니다." />
            ) : (
              expiringItems.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.regionName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500">{formatDate(item.expiryDate)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <h3 className="text-base font-semibold text-slate-900">데이터 오류 및 확인 필요 알림</h3>
          <div className="mt-3 space-y-2">
            {mockDataIssues.map((issue) => (
              <div key={issue.id} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-800">{issue.title}</p>
                  <StatusBadge status={issue.severity === '높음' ? '확인 필요' : issue.severity === '중간' ? '주의' : '정상'} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{issue.description}</p>
                {issue.regionName && <p className="mt-1 text-xs text-slate-400">{issue.regionName}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
