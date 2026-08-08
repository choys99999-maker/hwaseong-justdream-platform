import { Link } from 'react-router-dom';
import { ArrowRight, FileUp, MapPin } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import EmptyState from '../components/common/EmptyState';
import { useCentralData } from '../hooks/useCentralData';
import { listRegionUsage } from '../store/analytics';
import { formatNumber } from '../utils/format';
import { formatUpdatedAt } from '../utils/submission';

export default function RegionListPage() {
  // 파일 안의 지역명을 추론하지 않고, 제출 기관(organizations)을 그대로 쓴다.
  const { data: regions, error, isLoading } = useCentralData(() => listRegionUsage(), []);

  if (isLoading) return null;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역별 현황" description="읍면동별 지원 현황을 확인합니다." />
        <EmptyState title="지역별 현황을 불러오지 못했습니다" message={error} />
      </div>
    );
  }

  if (!regions || regions.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역별 현황" description="읍면동별 지원 현황을 확인합니다." />
        <EmptyState
          icon={MapPin}
          title="업로드된 데이터가 없습니다"
          message="자료 관리에서 Excel 파일을 올리면 지역별 현황을 확인할 수 있습니다."
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="지역별 현황"
        description={`제출 기관 기준 · ${regions.length}개 읍면동`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {regions.map((r) => (
          <Link
            key={r.organizationId}
            to={`/regions/${encodeURIComponent(r.organizationName)}`}
            className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <div className="flex items-center gap-2">
              <MapPin size={16} className="shrink-0 text-teal-500" />
              <h3 className="text-base font-semibold text-slate-900">{r.organizationName}</h3>
              <span className="ml-auto text-xs text-slate-400">{r.regionName}</span>
            </div>

            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-400">이용자 수</dt>
              <dd className="text-right font-medium text-slate-700">
                {formatNumber(r.userCount)}명
              </dd>
              <dt className="text-slate-400">복지 연계</dt>
              <dd className="text-right font-medium text-slate-700">
                {formatNumber(r.referralCount)}건
              </dd>
              <dt className="text-slate-400">재고 품목</dt>
              <dd className="text-right font-medium text-slate-700">
                {formatNumber(r.itemCount)}종
              </dd>
            </dl>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400">
                {r.lastUploadedAt ? `업데이트 ${formatUpdatedAt(r.lastUploadedAt)}` : ''}
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-teal-600 group-hover:text-teal-700">
                상세보기 <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
