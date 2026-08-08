import { Link } from 'react-router-dom';
import { ClipboardCheck, FileUp, MapPin, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import MonthlySupportChart from '../components/charts/MonthlySupportChart';
import RegionUserChart from '../components/charts/RegionUserChart';
import { useCentralData } from '../hooks/useCentralData';
import {
  getCityOverview,
  listMonthlyActivity,
  listRegionUsage,
  listSubmissionStatus,
  monthLabel,
} from '../store/analytics';
import { formatNumber } from '../utils/format';
import { formatPeriod, formatUpdatedAt } from '../utils/submission';

const TOP_REGIONS = 10;
const RECENT_SUBMISSIONS = 5;

export default function DashboardPage() {
  // 화성시 전체 = 읍면동들이 올린 유효 제출본의 합계. 별도 취합 동작이 없다.
  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([
        getCityOverview(),
        listRegionUsage(),
        listMonthlyActivity(),
        listSubmissionStatus(),
      ]).then(([overview, regions, monthly, submissions]) => ({
        overview,
        regions,
        monthly,
        submissions,
      })),
    [],
  );

  if (isLoading) return null;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="통합 대시보드" description="화성시 전체 그냥드림 운영 현황을 한눈에 확인합니다." />
        <EmptyState title="현황을 불러오지 못했습니다" message={error} />
      </div>
    );
  }

  const { overview, regions, monthly, submissions } = data!;

  if (overview.submissionCount === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="통합 대시보드" description="화성시 전체 그냥드림 운영 현황을 한눈에 확인합니다." />
        <EmptyState
          icon={FileUp}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올리면 현황을 확인할 수 있습니다."
        />
        <Link
          to="/files/upload"
          className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
        >
          <FileUp size={16} /> 자료 올리기
        </Link>
      </div>
    );
  }

  const period =
    overview.periodStart && overview.periodEnd
      ? formatPeriod(overview.periodStart, overview.periodEnd)
      : null;

  const monthlyData = monthly.map((p) => ({ month: monthLabel(p.month), count: p.count }));
  const regionData = regions
    .filter((r) => r.userCount > 0)
    .slice(0, TOP_REGIONS)
    .map((r) => ({ name: r.organizationName, count: r.userCount }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="통합 대시보드"
        description={`${overview.organizationCount}개 읍면동 · 제출 자료 ${formatNumber(overview.submissionCount)}건${period ? ` · ${period}` : ''}`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="전체 이용자"
          value={`${formatNumber(overview.totalUsers)}명`}
          icon={Users}
          description="주간 실적 합계"
        />
        <StatCard
          label="기본 상담"
          value={`${formatNumber(overview.totalConsultations)}건`}
          icon={ClipboardCheck}
        />
        <StatCard
          label="복지 연계 완료"
          value={`${formatNumber(overview.totalLinkageCompleted)}건`}
          icon={ClipboardCheck}
          description={`의뢰 ${formatNumber(overview.totalReferrals)}건 중`}
        />
        <StatCard
          label="제출 읍면동"
          value={`${formatNumber(overview.organizationCount)}곳`}
          icon={MapPin}
        />
      </div>

      {(monthlyData.length > 0 || regionData.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {monthlyData.length > 0 && <MonthlySupportChart data={monthlyData} />}
          {regionData.length > 0 && <RegionUserChart data={regionData} />}
        </div>
      )}

      {submissions.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-semibold text-slate-900">최근 제출 자료</h3>
          <div className="mt-3 space-y-2">
            {submissions.slice(0, RECENT_SUBMISSIONS).map((s) => (
              <Link
                key={s.organizationId}
                to={`/files/${s.submissionId}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                <div>
                  <p className="font-medium text-slate-800">{s.organizationName}</p>
                  <p className="text-xs text-slate-400">
                    {s.regionName}
                    {s.periodStart && s.periodEnd
                      ? ` · ${formatPeriod(s.periodStart, s.periodEnd)}`
                      : ''}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{formatNumber(s.recordCount)}건</p>
                  <p>{formatUpdatedAt(s.lastUploadedAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
