import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, FileUp, MapPin, Package, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import MonthlySupportChart from '../components/charts/MonthlySupportChart';
import { useCentralData } from '../hooks/useCentralData';
import {
  getRegionUsage,
  listMonthlyActivity,
  listReferralRows,
  monthLabel,
  type ReferralRow,
} from '../store/analytics';
import { formatNumber } from '../utils/format';
import { displayCellValue, formatPeriod, formatUpdatedAt } from '../utils/submission';

const PAGE_SIZE = 20;

/** 표 머리글 = 마스킹 판단 기준. utils/submission의 개인정보 규칙이 그대로 걸린다. */
const COLUMNS: { label: string; get: (r: ReferralRow) => string }[] = [
  { label: '연번', get: (r) => (r.serialNo === null ? '' : String(r.serialNo)) },
  { label: '방문구분', get: (r) => r.visitType ?? '' },
  { label: '대상자 이름', get: (r) => r.clientName ?? '' },
  { label: '생년월일', get: (r) => r.birthDate ?? '' },
  { label: '주소', get: (r) => r.address ?? '' },
  { label: '상담(방문)일자', get: (r) => r.consultDate ?? '' },
  { label: '2차 연계처(읍면동)', get: (r) => r.referralTarget ?? '' },
  { label: '연계 상담 실시 여부', get: (r) => r.consultationDone ?? '' },
  { label: '연계완료', get: (r) => r.linkageType ?? '' },
  { label: '기타 내역', get: (r) => r.serviceDetails ?? '' },
];

export default function RegionDetailPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const regionName = regionId ? decodeURIComponent(regionId) : '';

  const { data, error, isLoading } = useCentralData(async () => {
    const usage = await getRegionUsage(regionName);
    if (!usage) return { usage: null, monthly: [], referrals: [] as ReferralRow[] };
    const [monthly, referrals] = await Promise.all([
      listMonthlyActivity(usage.organizationId),
      listReferralRows(usage.organizationId, PAGE_SIZE),
    ]);
    return { usage, monthly, referrals };
  }, [regionName]);

  const backLink = (
    <Link
      to="/regions"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600"
    >
      <ArrowLeft size={16} /> 지역별 현황으로 돌아가기
    </Link>
  );

  if (isLoading) return null;

  if (error) {
    return (
      <div className="space-y-6">
        {backLink}
        <PageHeader title={regionName || '지역 상세'} />
        <EmptyState title="지역 현황을 불러오지 못했습니다" message={error} />
      </div>
    );
  }

  const usage = data?.usage ?? null;

  if (!usage) {
    return (
      <div className="space-y-6">
        {backLink}
        <PageHeader title={regionName || '지역 상세'} />
        <EmptyState
          icon={FileUp}
          title="해당 지역의 데이터가 없습니다"
          message="이 읍면동이 제출한 자료가 아직 없습니다."
        />
      </div>
    );
  }

  const monthlyData = (data?.monthly ?? []).map((p) => ({
    month: monthLabel(p.month),
    count: p.count,
  }));
  const referrals = data?.referrals ?? [];
  const period =
    usage.periodStart && usage.periodEnd
      ? formatPeriod(usage.periodStart, usage.periodEnd)
      : null;

  return (
    <div className="space-y-6">
      {backLink}

      <PageHeader
        title={usage.organizationName}
        description={`제출 자료 ${formatNumber(usage.submissionCount)}건${period ? ` · ${period}` : ''}${
          usage.lastUploadedAt ? ` · 업데이트 ${formatUpdatedAt(usage.lastUploadedAt)}` : ''
        }`}
        actions={
          <span className="flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
            <MapPin size={12} /> {usage.regionName}
          </span>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="이용자 수" value={`${formatNumber(usage.userCount)}명`} icon={Users} />
        <StatCard
          label="기본 상담"
          value={`${formatNumber(usage.basicConsultation)}건`}
          icon={ClipboardList}
        />
        <StatCard
          label="복지 연계"
          value={`${formatNumber(usage.referralCount)}건`}
          icon={ClipboardList}
          description={`연계완료 ${formatNumber(usage.linkageCompleted)}건`}
        />
        <StatCard
          label="재고 품목"
          value={`${formatNumber(usage.itemCount)}종`}
          icon={Package}
          description={`현재재고 ${formatNumber(usage.totalStock)}개`}
        />
      </div>

      {monthlyData.length > 1 && <MonthlySupportChart data={monthlyData} />}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">
          복지 연계 내역
          <span className="ml-2 text-sm font-normal text-slate-400">
            (최대 {PAGE_SIZE}건 표시)
          </span>
        </h3>

        {referrals.length === 0 ? (
          <p className="text-sm text-slate-400">이 지역의 복지 연계 내역이 없습니다.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.label}
                        className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium text-slate-500"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {referrals.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {COLUMNS.map((col) => (
                        <td
                          key={col.label}
                          className="whitespace-nowrap px-4 py-2.5 text-slate-700"
                        >
                          {displayCellValue(col.label, col.get(row))}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              이름·생년월일·주소 등 개인정보 항목은 가려서 표시합니다.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
