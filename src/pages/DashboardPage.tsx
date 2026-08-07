import { useState } from 'react';
import { Boxes, MapPin, PackageSearch, Repeat2, TimerReset } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import OperationMapSection from '../components/dashboard/OperationMapSection';
import ProgramDetailModal from '../components/dashboard/ProgramDetailModal';
import MonthlyFlowChart from '../components/charts/MonthlyFlowChart';
import DistrictRiskChart from '../components/charts/DistrictRiskChart';
import { mockInventoryItems } from '../data/mockInventory';
import { mockDataIssues } from '../data/mockDataIssues';
import { mockRedistributionRecords } from '../data/mockRedistributions';
import { citySummary } from '../data/operationSummary';
import { PROGRAM_SUMMARY } from '../data/programSummary';
import { formatDate, formatNumber } from '../utils/format';

const expiringItems = mockInventoryItems
  .filter((item) => item.status === '임박')
  .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
const recentRedistributions = [...mockRedistributionRecords]
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 5);

export default function DashboardPage() {
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="통합 대시보드"
        description="거점별 재고 불균형을 확인하고 재배분 여부를 판단합니다."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {/* 운영 프로그램 카드 — 클릭 시 상세 패널 */}
        <button
          type="button"
          onClick={() => setIsProgramModalOpen(true)}
          className="rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-slate-500">운영 프로그램</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{PROGRAM_SUMMARY.total}개</p>
              <p className="mt-1 text-xs text-slate-400">
                화성형 {PROGRAM_SUMMARY.hwaseong} · 국가형 {PROGRAM_SUMMARY.national}
              </p>
              <p className="mt-0.5 text-xs text-teal-600">실제 운영 장소 {PROGRAM_SUMMARY.locationCount}곳 ↗</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <MapPin size={20} />
            </div>
          </div>
        </button>
        <StatCard label="전체 재고 수량" value={`${formatNumber(citySummary.inventoryTotal)}개`} icon={Boxes} />
        <StatCard
          label="7일 내 부족 예상"
          value={`${formatNumber(citySummary.shortageSiteCount)}개소`}
          icon={PackageSearch}
          description={`예상 부족 ${formatNumber(citySummary.shortageQuantity)}개`}
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

      {isProgramModalOpen && <ProgramDetailModal onClose={() => setIsProgramModalOpen(false)} />}

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
