import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Boxes, ClipboardList, TimerReset, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import DataTable from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import RegionTrendChart from '../components/charts/RegionTrendChart';
import { getRegionById } from '../data/mockRegions';
import { districtRiskLevels } from '../data/operationSummary';
import { mockSupportRecords } from '../data/mockSupportRecords';
import { mockInventoryItems } from '../data/mockInventory';
import { formatDate, formatNumber } from '../utils/format';

export default function RegionDetailPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const region = getRegionById(regionId);

  if (!region) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역 상세" />
        <EmptyState title="존재하지 않는 지역입니다" message="지역별 현황 목록에서 다시 선택해 주세요." />
        <Link to="/regions" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700">
          <ArrowLeft size={16} />
          지역별 현황으로 돌아가기
        </Link>
      </div>
    );
  }

  const supportRecords = mockSupportRecords
    .filter((record) => record.regionId === region.id)
    .sort((a, b) => b.supportDate.localeCompare(a.supportDate));
  const inventoryItems = mockInventoryItems.filter((item) => item.regionId === region.id);

  return (
    <div className="space-y-6">
      <Link to="/regions" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600">
        <ArrowLeft size={16} />
        지역별 현황으로 돌아가기
      </Link>

      <PageHeader
        title={region.name}
        description={`운영 거점 ${formatNumber(region.orgCount)}개소 · 최근 업데이트 ${formatDate(region.lastUpdated)}`}
        actions={<SiteStatusBadge status={districtRiskLevels[region.id]} />}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="이용자 수" value={`${formatNumber(region.userCount)}명`} icon={Users} />
        <StatCard label="이번 달 지원 건수" value={`${formatNumber(region.monthlySupportCount)}건`} icon={ClipboardList} />
        <StatCard label="현재 재고 품목" value={`${formatNumber(region.inventoryCount)}종`} icon={Boxes} />
        <StatCard
          label="유통기한 임박 건수"
          value={`${formatNumber(region.expiringSoonCount)}건`}
          icon={TimerReset}
          tone="warning"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">월별 이용 추이</h3>
        <p className="mt-1 text-sm text-slate-500">최근 6개월 지원 건수 추이</p>
        <div className="mt-4">
          <RegionTrendChart data={region.monthlyTrend} />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">최근 지원 내역</h3>
        <DataTable
          columns={[
            { key: 'userName', header: '이용자', render: (row) => row.userName },
            { key: 'supportDate', header: '지원일', render: (row) => formatDate(row.supportDate) },
            { key: 'item', header: '지원 물품', render: (row) => row.item },
            { key: 'quantity', header: '수량', render: (row) => `${row.quantity}개` },
            { key: 'counselingStatus', header: '상담·복지 연계', render: (row) => <StatusBadge status={row.counselingStatus} /> },
          ]}
          data={supportRecords.slice(0, 8)}
          rowKey={(row) => row.id}
          emptyMessage="최근 지원 내역이 없습니다."
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">보유 물품 목록</h3>
        <DataTable
          columns={[
            { key: 'name', header: '품목명', render: (row) => row.name },
            { key: 'inboundQuantity', header: '입고량', render: (row) => formatNumber(row.inboundQuantity) },
            { key: 'outboundQuantity', header: '배부량', render: (row) => formatNumber(row.outboundQuantity) },
            { key: 'currentStock', header: '현재 재고', render: (row) => formatNumber(row.currentStock) },
            { key: 'expiryDate', header: '유통기한', render: (row) => formatDate(row.expiryDate) },
            { key: 'status', header: '상태', render: (row) => <StatusBadge status={row.status} /> },
          ]}
          data={inventoryItems}
          rowKey={(row) => row.id}
          emptyMessage="보유 물품이 없습니다."
        />
      </section>
    </div>
  );
}
