import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import RegionOverviewSection from '../components/dashboard/RegionOverviewSection';
import type { OperationSite } from '../types';
import { mockRegions } from '../data/mockRegions';
import { mockSites } from '../data/mockSites';
import { REGION_NAMES, REGION_ORDER } from '../data/regionMeta';
import { districtRiskLevels, districtSummaryMap } from '../data/operationSummary';
import { formatDate, formatDateTime, formatNumber } from '../utils/format';

/** 통합 대시보드 지도와 같은 거점 데이터를 쓰므로 두 화면의 숫자가 항상 일치한다. */
const sortedSites = [...mockSites].sort(
  (a, b) =>
    REGION_ORDER.indexOf(a.district) - REGION_ORDER.indexOf(b.district) || a.name.localeCompare(b.name, 'ko'),
);

export default function RegionListPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="지역별 현황"
        description="화성특례시 4개 구의 운영 상태와 거점별 재고 현황을 비교합니다."
      />

      <RegionOverviewSection />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {mockRegions.map((region) => {
          const summary = districtSummaryMap[region.id];
          return (
            <Link
              key={region.id}
              to={`/regions/${region.id}`}
              className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition-colors hover:border-teal-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900">{region.name}</h3>
                <SiteStatusBadge status={districtRiskLevels[region.id]} />
              </div>

              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-400">운영 거점</dt>
                <dd className="text-right font-medium text-slate-700">{formatNumber(summary.siteCount)}개소</dd>
                <dt className="text-slate-400">전체 재고</dt>
                <dd className="text-right font-medium text-slate-700">{formatNumber(summary.inventoryTotal)}개</dd>
                <dt className="text-slate-400">부족 예상 거점</dt>
                <dd className="text-right font-medium text-slate-700">{formatNumber(summary.shortageSiteCount)}개소</dd>
                <dt className="text-slate-400">유통기한 임박</dt>
                <dd className="text-right font-medium text-slate-700">{formatNumber(summary.expiringQuantity)}개</dd>
                <dt className="text-slate-400">재배분 필요</dt>
                <dd className="text-right font-medium text-slate-700">{formatNumber(summary.recommendationCount)}건</dd>
              </dl>

              <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                <span>최근 업데이트: {formatDate(region.lastUpdated)}</span>
                <span className="flex items-center gap-1 font-medium text-teal-600 group-hover:text-teal-700">
                  상세보기
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">거점별 재고 현황</h3>
          <p className="mt-1 text-sm text-slate-500">
            통합 대시보드 지도와 동일한 거점 데이터입니다. 좌표는 행정동 경계 중심점을 사용한 데모 값입니다.
          </p>
        </div>
        <DataTable<OperationSite>
          columns={[
            { key: 'name', header: '거점명', render: (row) => row.name },
            { key: 'district', header: '구', render: (row) => REGION_NAMES[row.district] },
            { key: 'facilityType', header: '시설 유형', render: (row) => row.facilityType },
            { key: 'inventoryCount', header: '현재 재고', render: (row) => `${formatNumber(row.inventoryCount)}개` },
            { key: 'sevenDayDemand', header: '7일 예상 수요', render: (row) => `${formatNumber(row.sevenDayDemand)}개` },
            {
              key: 'expectedShortage',
              header: '예상 부족',
              render: (row) => (row.expectedShortage > 0 ? `${formatNumber(row.expectedShortage)}개` : '-'),
            },
            {
              key: 'expiringCount',
              header: '유통기한 임박',
              render: (row) => (row.expiringCount > 0 ? `${formatNumber(row.expiringCount)}개` : '-'),
            },
            { key: 'status', header: '상태', render: (row) => <SiteStatusBadge status={row.status} /> },
            {
              key: 'lastUpdatedAt',
              header: '최근 입력',
              render: (row) => <span className="text-slate-400">{formatDateTime(row.lastUpdatedAt)}</span>,
            },
          ]}
          data={sortedSites}
          rowKey={(row) => row.id}
          emptyMessage="등록된 거점이 없습니다."
        />
      </section>
    </div>
  );
}
