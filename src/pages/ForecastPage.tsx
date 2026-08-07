import { Boxes, PackageSearch, Repeat2, TimerReset } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import DataTable from '../components/common/DataTable';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import DistrictRiskChart from '../components/charts/DistrictRiskChart';
import { mockSites } from '../data/mockSites';
import { citySummary, redistributionRecommendations } from '../data/operationSummary';
import { REGION_NAMES } from '../data/regionMeta';
import { formatNumber } from '../utils/format';
import type { OperationSite, RedistributionRecommendation } from '../types';

const forecastedSites = [...mockSites]
  .sort((a, b) => b.expectedShortage - a.expectedShortage)
  .slice(0, 10);

export default function ForecastPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI 수요예측"
        description="기관별 예상 이용수요와 품목별 소진량을 바탕으로 부족·과잉을 예측하고 거점 간 재배분을 추천합니다."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="7일 예상 수요"
          value={`${formatNumber(citySummary.sevenDayDemandTotal)}개`}
          icon={Boxes}
        />
        <StatCard
          label="부족 예상 거점"
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
        <StatCard
          label="재배분 추천 건수"
          value={`${formatNumber(citySummary.recommendationCount)}건`}
          icon={Repeat2}
        />
      </div>

      <DistrictRiskChart />

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">거점별 예상 부족 상위 10곳</h3>
          <p className="mt-1 text-sm text-slate-500">7일 예상 수요 대비 부족이 큰 거점부터 표시합니다.</p>
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
            { key: 'focusItem', header: '주요 품목', render: (row) => row.focusItem },
            { key: 'status', header: '상태', render: (row) => <SiteStatusBadge status={row.status} /> },
          ]}
          data={forecastedSites}
          rowKey={(row) => row.id}
          emptyMessage="예측 대상 거점이 없습니다."
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">기관 간 재배분 추천</h3>
          <p className="mt-1 text-sm text-slate-500">
            같은 품목을 여유 있게 보유한 거점에서 부족 거점으로 이동을 추천합니다.
          </p>
        </div>
        <DataTable<RedistributionRecommendation>
          columns={[
            { key: 'priority', header: '우선순위', render: (row) => row.priority },
            { key: 'item', header: '품목', render: (row) => row.item },
            { key: 'district', header: '구', render: (row) => REGION_NAMES[row.district] },
            { key: 'fromSiteName', header: '출발 거점', render: (row) => row.fromSiteName },
            { key: 'toSiteName', header: '도착 거점', render: (row) => row.toSiteName },
            { key: 'shortageQuantity', header: '부족 수량', render: (row) => `${formatNumber(row.shortageQuantity)}개` },
            { key: 'moveQuantity', header: '이동 추천 수량', render: (row) => `${formatNumber(row.moveQuantity)}개` },
          ]}
          data={redistributionRecommendations}
          rowKey={(row) => row.id}
          emptyMessage="현재 추천할 재배분이 없습니다."
        />
      </section>
    </div>
  );
}
