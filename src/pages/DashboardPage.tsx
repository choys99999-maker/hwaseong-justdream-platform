import { useMemo } from 'react';
import { AlertTriangle, ClipboardCheck, PackageSearch, TimerReset, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import EmptyState from '../components/common/EmptyState';
import RegionOverviewSection from '../components/dashboard/RegionOverviewSection';
import MonthlySupportChart from '../components/charts/MonthlySupportChart';
import RegionUserChart from '../components/charts/RegionUserChart';
import { formatDate, formatNumber } from '../utils/format';
import { useDataScope } from '../hooks/useDataScope';

export default function DashboardPage() {
  const { regions, supportRecords, inventoryItems, dataIssues, isSystemAdmin, effectiveRegionId } = useDataScope();

  const totalUsers = useMemo(() => regions.reduce((sum, r) => sum + r.userCount, 0), [regions]);
  const monthlySupportCount = useMemo(
    () => supportRecords.filter((r) => r.supportDate.startsWith('2026-08')).length,
    [supportRecords],
  );
  const expiringItems = useMemo(
    () =>
      inventoryItems
        .filter((item) => item.status === '임박')
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)),
    [inventoryItems],
  );
  const recentSupportRecords = useMemo(
    () => [...supportRecords].sort((a, b) => b.supportDate.localeCompare(a.supportDate)).slice(0, 5),
    [supportRecords],
  );

  const scopeLabel =
    isSystemAdmin && effectiveRegionId === null
      ? '화성시 전체 그냥드림 운영 현황을 한눈에 확인합니다.'
      : `${regions[0]?.name ?? ''} 그냥드림 운영 현황을 확인합니다.`;

  return (
    <div className="space-y-6">
      <PageHeader title="통합 대시보드" description={scopeLabel} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="전체 이용자 수" value={`${formatNumber(totalUsers)}명`} icon={Users} />
        <StatCard label="이번 달 지원 건수" value={`${formatNumber(monthlySupportCount)}건`} icon={ClipboardCheck} />
        <StatCard label="관리 중인 물품 수" value={`${formatNumber(inventoryItems.length)}종`} icon={PackageSearch} />
        <StatCard
          label="유통기한 임박 건수"
          value={`${formatNumber(expiringItems.length)}건`}
          icon={TimerReset}
          tone="warning"
        />
        <StatCard
          label="데이터 확인 필요 건수"
          value={`${formatNumber(dataIssues.length)}건`}
          icon={AlertTriangle}
          tone="danger"
        />
      </div>

      <RegionOverviewSection regions={regions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MonthlySupportChart regions={regions} />
        <RegionUserChart regions={regions} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-1">
          <h3 className="text-base font-semibold text-slate-900">최근 지원 내역</h3>
          <div className="mt-3 space-y-2">
            {recentSupportRecords.map((record) => (
              <div key={record.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-slate-800">{record.userName}</p>
                  <p className="text-xs text-slate-400">
                    {record.regionName} · {formatDate(record.supportDate)}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{record.item}</p>
                  <p>{record.quantity}개</p>
                </div>
              </div>
            ))}
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
            {dataIssues.map((issue) => (
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
