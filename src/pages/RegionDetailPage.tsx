import { useEffect, useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Boxes, ClipboardList, ShieldCheck, TimerReset, Users } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import DataTable from '../components/common/DataTable';
import EmptyState from '../components/common/EmptyState';
import CentralDataNotice from '../components/common/CentralDataNotice';
import RegionTrendChart from '../components/charts/RegionTrendChart';
import { useCentralData } from '../hooks/useCentralData';
import {
  listAllReferralRows,
  listInventoryStatus,
  listMonthlyActivityRows,
  listRegionUsage,
  mergeMonthlyPoints,
  monthLabel,
  type CityReferralRow,
  type InventoryStatus as InventoryRow,
  type RegionUsage,
} from '../store/analytics';
import { getRegionById } from '../data/mockRegions';
import { districtOfArea } from '../data/districtByArea';
import { siteAreaOf } from '../data/mockSites';
import { districtRiskLevels } from '../data/operationSummary';
import { inventoryStatusOf } from '../utils/inventoryStatus';
import { displayCellValue, formatUpdatedAt } from '../utils/submission';
import { formatDate, formatNumber, formatStock } from '../utils/format';
import type { MonthlyTrendPoint } from '../types';

export default function RegionDetailPage() {
  const { regionId } = useParams<{ regionId: string }>();
  const [searchParams] = useSearchParams();
  const region = getRegionById(regionId);

  // ?site= 파라미터로 특정 거점의 읍면동 행을 강조한다.
  const siteIdParam = searchParams.get('site');
  const highlightArea = siteIdParam ? siteAreaOf(siteIdParam) : null;

  // 이 구에 속한 읍면동의 중앙 자료만 모아 온다.
  // 어떤 읍면동이 어느 구인지는 지도와 같은 행정동 경계 데이터에서 찾는다.
  const { data, error, isLoading } = useCentralData(async () => {
    if (!region) return null;

    const [usage, inventory, monthly] = await Promise.all([
      listRegionUsage(),
      listInventoryStatus(),
      listMonthlyActivityRows(),
    ]);

    const inDistrict = (organizationName: string) => districtOfArea(organizationName) === region.id;
    const areas: RegionUsage[] = usage.filter((row) => inDistrict(row.organizationName));
    const orgIds = areas.map((row) => row.organizationId);
    const orgIdSet = new Set(orgIds);

    const referrals = await listAllReferralRows(50, orgIds);

    return {
      areas,
      referrals,
      items: inventory.filter((row) => inDistrict(row.organizationName)),
      trend: mergeMonthlyPoints(monthly.filter((row) => orgIdSet.has(row.organizationId))),
    };
  }, [region?.id]);

  const totals = useMemo(() => {
    const areas = data?.areas ?? [];
    const items = data?.items ?? [];
    return {
      organizationCount: areas.length,
      userCount: areas.reduce((sum, row) => sum + row.userCount, 0),
      basicConsultation: areas.reduce((sum, row) => sum + row.basicConsultation, 0),
      itemCount: items.length,
      expiringSoonCount: items.filter((row) => row.isExpiringSoon).length,
      lastUploadedAt: areas.reduce<string | null>(
        (latest, row) => (row.lastUploadedAt && (!latest || row.lastUploadedAt > latest) ? row.lastUploadedAt : latest),
        null,
      ),
    };
  }, [data]);

  const trend = useMemo<MonthlyTrendPoint[]>(
    () => (data?.trend ?? []).map((point) => ({ month: monthLabel(point.month), count: point.count })),
    [data],
  );

  // 읍면동별 현황 테이블에서 강조할 행의 rowKey (organizationId).
  const highlightKey = useMemo(
    () => (highlightArea ? (data?.areas.find((row) => row.organizationName === highlightArea)?.organizationId ?? null) : null),
    [highlightArea, data],
  );

  // 강조 행이 뷰포트 밖이면 스크롤해서 보여준다.
  useEffect(() => {
    if (!highlightKey) return;
    const el = document.querySelector('[data-highlight="true"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightKey]);

  if (!region) {
    return (
      <div className="space-y-6">
        <PageHeader title="지역 상세" />
        <EmptyState title="존재하지 않는 지역입니다" message="지역별 현황 목록에서 다시 선택해 주세요." />
        <Link to="/admin/sites" className="inline-flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700">
          <ArrowLeft size={16} />
          거점 관리로 돌아가기
        </Link>
      </div>
    );
  }

  const hasCentralData = totals.organizationCount > 0 || totals.itemCount > 0;
  const notice = (
    <CentralDataNotice
      isLoading={isLoading}
      error={error}
      isEmpty={!hasCentralData}
      emptyMessage={`${region.name}에서 아직 올라온 자료가 없습니다.`}
    />
  );

  return (
    <div className="space-y-6">
      <Link to="/admin/sites" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600">
        <ArrowLeft size={16} />
        거점 운영으로 돌아가기
      </Link>

      <PageHeader
        title={region.name}
        description={`운영 거점 ${formatNumber(region.orgCount)}개소 · 자료 제출 읍면동 ${formatNumber(
          totals.organizationCount,
        )}개${totals.lastUploadedAt ? ` · 최근 제출 ${formatUpdatedAt(totals.lastUploadedAt)}` : ''}`}
        actions={<SiteStatusBadge status={districtRiskLevels[region.id]} />}
      />

      {notice}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="이용자 수" value={`${formatNumber(totals.userCount)}명`} icon={Users} />
        <StatCard label="기본상담 건수" value={`${formatNumber(totals.basicConsultation)}건`} icon={ClipboardList} />
        <StatCard label="현재 재고 품목" value={`${formatNumber(totals.itemCount)}종`} icon={Boxes} />
        <StatCard
          label="유통기한 임박 건수"
          value={`${formatNumber(totals.expiringSoonCount)}건`}
          icon={TimerReset}
          tone="warning"
        />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">월별 이용 추이</h3>
        <p className="mt-1 text-sm text-slate-500">복지 연계 상담일 기준 월별 건수입니다.</p>
        <div className="mt-4">
          {trend.length === 0 ? (
            <EmptyState message="월별 추이를 계산할 상담일 자료가 없습니다." />
          ) : (
            <RegionTrendChart data={trend} />
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">읍면동별 현황</h3>
        <DataTable<RegionUsage>
          columns={[
            { key: 'organizationName', header: '읍면동', render: (row) => row.organizationName },
            { key: 'userCount', header: '이용자 수', render: (row) => `${formatNumber(row.userCount)}명` },
            {
              key: 'basicConsultation',
              header: '기본상담',
              render: (row) => `${formatNumber(row.basicConsultation)}건`,
            },
            { key: 'referralTotal', header: '연계 의뢰', render: (row) => `${formatNumber(row.referralTotal)}건` },
            {
              key: 'linkageCompleted',
              header: '연계 완료',
              render: (row) => `${formatNumber(row.linkageCompleted)}건`,
            },
            { key: 'totalStock', header: '현재 재고', render: (row) => `${formatNumber(row.totalStock)}개` },
            {
              key: 'lastUploadedAt',
              header: '최근 제출',
              render: (row) => (
                <span className="text-slate-400">
                  {row.lastUploadedAt ? formatUpdatedAt(row.lastUploadedAt) : '—'}
                </span>
              ),
            },
          ]}
          data={data?.areas ?? []}
          rowKey={(row) => row.organizationId}
          highlightKey={highlightKey}
          emptyMessage="자료를 제출한 읍면동이 없습니다."
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">최근 복지 연계 내역</h3>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-inset ring-slate-200">
            <ShieldCheck size={13} className="text-slate-400" />
            개인 식별 항목은 가려서 표시합니다
          </span>
        </div>
        <DataTable<CityReferralRow>
          columns={[
            { key: 'organizationName', header: '읍면동', render: (row) => row.organizationName },
            {
              key: 'clientName',
              header: '대상자',
              render: (row) => displayCellValue('대상자', row.clientName ?? '') || '-',
            },
            {
              key: 'consultDate',
              header: '상담일',
              render: (row) => (row.consultDate ? formatDate(row.consultDate) : '-'),
            },
            { key: 'visitType', header: '방문구분', render: (row) => row.visitType ?? '-' },
            { key: 'referralTarget', header: '2차 연계처', render: (row) => row.referralTarget ?? '-' },
            {
              key: 'consultationDone',
              header: '상담·복지 연계',
              render: (row) =>
                row.linkageType ? (
                  <StatusBadge status="연계 완료" />
                ) : row.consultationDone ? (
                  <StatusBadge status="연계 진행중" />
                ) : (
                  <StatusBadge status="미연계" />
                ),
            },
          ]}
          data={data?.referrals ?? []}
          rowKey={(row) => `${row.organizationId}-${row.serialNo ?? ''}-${row.consultDate ?? ''}-${row.clientName ?? ''}`}
          emptyMessage="최근 복지 연계 내역이 없습니다."
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-base font-semibold text-slate-900">보유 물품 목록</h3>
        <DataTable<InventoryRow>
          columns={[
            { key: 'itemName', header: '품목명', render: (row) => row.itemName },
            { key: 'organizationName', header: '읍면동', render: (row) => row.organizationName },
            { key: 'inboundQuantity', header: '입고량', render: (row) => formatNumber(row.inboundQuantity) },
            { key: 'outboundQuantity', header: '배부량', render: (row) => formatNumber(row.outboundQuantity) },
            { key: 'stock', header: '현재 재고', render: (row) => formatStock(row.stock) },
            {
              key: 'expirationDate',
              header: '유통기한',
              render: (row) => (row.expirationDate ? formatDate(row.expirationDate) : '—'),
            },
            { key: 'status', header: '상태', render: (row) => <StatusBadge status={inventoryStatusOf(row)} /> },
          ]}
          data={data?.items ?? []}
          rowKey={(row) => `${row.organizationId}-${row.itemName}`}
          emptyMessage="보유 물품이 없습니다."
        />
      </section>
    </div>
  );
}
