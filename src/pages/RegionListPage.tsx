import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import CentralDataNotice from '../components/common/CentralDataNotice';
import RegionOverviewSection from '../components/dashboard/RegionOverviewSection';
import { useCentralData } from '../hooks/useCentralData';
import { listInventoryStatus, listRegionUsage, type RegionUsage } from '../store/analytics';
import type { OperationSite } from '../types';
import { mockRegions } from '../data/mockRegions';
import { mockSites } from '../data/mockSites';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES, REGION_ORDER } from '../data/regionMeta';
import { districtRiskLevels, districtSummaryMap } from '../data/operationSummary';
import { rollupByDistrict } from '../utils/districtRollup';
import { formatUpdatedAt } from '../utils/submission';
import { formatDateTime, formatNumber } from '../utils/format';

/** 통합 대시보드 지도와 같은 거점 데이터를 쓰므로 두 화면의 숫자가 항상 일치한다. */
const sortedSites = [...mockSites].sort(
  (a, b) =>
    REGION_ORDER.indexOf(a.district) - REGION_ORDER.indexOf(b.district) || a.name.localeCompare(b.name, 'ko'),
);

/** 읍면동 표 한 줄. 소속 구는 행정동 경계 데이터에서 찾는다. */
interface AreaRow extends RegionUsage {
  districtName: string;
}

export default function RegionListPage() {
  // 파일명이 아니라 제출 기관(organizations)을 그대로 쓴다.
  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([listRegionUsage(), listInventoryStatus()]).then(([usage, inventory]) => ({
        usage,
        central: rollupByDistrict(usage, inventory),
      })),
    [],
  );

  const areaRows = useMemo<AreaRow[]>(() => {
    const rows = (data?.usage ?? []).map((row) => {
      const id = districtOfArea(row.organizationName);
      return { ...row, districtName: id ? REGION_NAMES[id] : row.regionName };
    });
    return rows.sort(
      (a, b) => b.userCount - a.userCount || a.organizationName.localeCompare(b.organizationName, 'ko'),
    );
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="지역별 현황"
        description="화성특례시 4개 구의 운영 상태와 거점별 재고 현황을 비교합니다."
      />

      <RegionOverviewSection central={data?.central} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {mockRegions.map((region) => {
          const summary = districtSummaryMap[region.id];
          const central = data?.central[region.id];
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

              {/* 확정 거점 수 + 중앙 저장소 집계 */}
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-slate-400">운영 거점</dt>
                <dd className="text-right font-medium text-slate-700">{formatNumber(summary.siteCount)}개소</dd>
                <dt className="text-slate-400">자료 제출 읍면동</dt>
                <dd className="text-right font-medium text-slate-700">
                  {central ? `${formatNumber(central.organizationCount)}개` : '—'}
                </dd>
                <dt className="text-slate-400">이용자 수</dt>
                <dd className="text-right font-medium text-slate-700">
                  {central ? `${formatNumber(central.userCount)}명` : '—'}
                </dd>
                <dt className="text-slate-400">전체 재고</dt>
                <dd className="text-right font-medium text-slate-700">
                  {central ? `${formatNumber(central.totalStock)}개` : '—'}
                </dd>
                <dt className="text-slate-400">유통기한 임박</dt>
                <dd className="text-right font-medium text-slate-700">
                  {central ? `${formatNumber(central.expiringSoonCount)}건` : '—'}
                </dd>
              </dl>

              {/* 수요 예측 기반 값은 아직 중앙 DB에서 계산할 수 없어 시연 수치로 남겨둔다. */}
              <p className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-400">
                시연 · 부족 예상 {formatNumber(summary.shortageSiteCount)}개소 · 재배분{' '}
                {formatNumber(summary.recommendationCount)}건
              </p>

              <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                <span>
                  {central?.lastUploadedAt ? `최근 제출 ${formatUpdatedAt(central.lastUploadedAt)}` : '제출 자료 없음'}
                </span>
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
          <h3 className="text-base font-semibold text-slate-900">읍면동별 제출 현황</h3>
          <p className="mt-1 text-sm text-slate-500">
            중앙 저장소에 자료를 올린 읍면동입니다. 재제출로 대체된 자료는 집계에서 빠집니다.
          </p>
        </div>

        <CentralDataNotice
          isLoading={isLoading}
          error={error}
          isEmpty={areaRows.length === 0}
          emptyMessage="아직 자료를 제출한 읍면동이 없습니다."
        />

        {areaRows.length > 0 && (
          <DataTable<AreaRow>
            columns={[
              { key: 'organizationName', header: '읍면동', render: (row) => row.organizationName },
              { key: 'districtName', header: '구', render: (row) => row.districtName },
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
              { key: 'itemCount', header: '재고 품목', render: (row) => `${formatNumber(row.itemCount)}종` },
              { key: 'totalStock', header: '현재 재고', render: (row) => `${formatNumber(row.totalStock)}개` },
              {
                key: 'submissionCount',
                header: '제출 건수',
                render: (row) => `${formatNumber(row.submissionCount)}건`,
              },
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
            data={areaRows}
            rowKey={(row) => row.organizationId}
            emptyMessage="제출한 읍면동이 없습니다."
          />
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-slate-900">거점별 재고 현황</h3>
            <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
              시연 데이터
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            통합 대시보드 지도와 동일한 거점 데이터입니다. 기관명·좌표는 확정 값이고, 재고·수요 수치는 아직
            시연용입니다.
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
