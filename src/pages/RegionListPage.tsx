import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import { formatDate, formatNumber } from '../utils/format';
import { useDataScope } from '../hooks/useDataScope';

export default function RegionListPage() {
  const { regions } = useDataScope();

  return (
    <div className="space-y-6">
      <PageHeader title="지역별 현황" description="권역별 운영 상태와 주요 지표를 확인합니다." />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {regions.map((region) => (
          <Link
            key={region.id}
            to={`/regions/${region.id}`}
            className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">{region.name}</h3>
              <StatusBadge status={region.status} />
            </div>

            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-slate-400">이용자 수</dt>
              <dd className="text-right font-medium text-slate-700">{formatNumber(region.userCount)}명</dd>
              <dt className="text-slate-400">지원 건수</dt>
              <dd className="text-right font-medium text-slate-700">{formatNumber(region.monthlySupportCount)}건</dd>
              <dt className="text-slate-400">재고 품목</dt>
              <dd className="text-right font-medium text-slate-700">{formatNumber(region.inventoryCount)}종</dd>
              <dt className="text-slate-400">유통기한 임박</dt>
              <dd className="text-right font-medium text-slate-700">{formatNumber(region.expiringSoonCount)}건</dd>
            </dl>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
              <span>최근 업데이트: {formatDate(region.lastUpdated)}</span>
              <span className="flex items-center gap-1 font-medium text-teal-600 group-hover:text-teal-700">
                상세보기
                <ArrowRight size={14} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
