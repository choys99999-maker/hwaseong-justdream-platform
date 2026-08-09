import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import SiteStatusBadge from '../components/common/SiteStatusBadge';
import CentralDataNotice from '../components/common/CentralDataNotice';
import DistrictFilter from '../components/map/DistrictFilter';
import { useCentralData } from '../hooks/useCentralData';
import { listInventoryStatus, listRegionUsage, type RegionUsage } from '../store/analytics';
import type { DistrictId, OperationSite } from '../types';
import { mockSites } from '../data/mockSites';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES, REGION_ORDER } from '../data/regionMeta';
import { citySummary, districtRiskLevels, districtSummaryMap } from '../data/operationSummary';
import { rollupByDistrict, type DistrictCentralSummary } from '../utils/districtRollup';
import { formatUpdatedAt } from '../utils/submission';
import { formatDateTime, formatNumber } from '../utils/format';

/** 읍면동 표 한 줄. 소속 구는 행정동 경계 데이터에서 찾는다. */
interface AreaRow extends RegionUsage {
  districtName: string;
  districtId: DistrictId | null;
}

/** 선택 범위(전체/구)의 요약 지표 한 칸 */
function MetricTile({
  label,
  value,
  unit,
  source,
}: {
  label: string;
  value: number | null;
  unit: string;
  source: '확정' | '시연' | '중앙';
}) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="flex items-center justify-between gap-1 text-xs text-slate-500">
        {label}
        <span
          className={`rounded px-1 py-px text-[10px] font-medium ring-1 ring-inset ${
            source === '확정'
              ? 'bg-teal-50 text-teal-700 ring-teal-600/20'
              : source === '중앙'
                ? 'bg-white text-slate-500 ring-slate-200'
                : 'bg-amber-50 text-amber-700 ring-amber-600/20'
          }`}
        >
          {source === '중앙' ? '제출 자료' : source === '확정' ? '확정' : '시연'}
        </span>
      </dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">
        {value === null ? '—' : formatNumber(value)}
        <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </dd>
    </div>
  );
}

/** 중앙 집계를 전체(4개 구 합)로 접는다. */
function sumCentral(central: Record<DistrictId, DistrictCentralSummary>): DistrictCentralSummary {
  const total: DistrictCentralSummary = {
    organizationCount: 0,
    userCount: 0,
    basicConsultation: 0,
    referralTotal: 0,
    linkageCompleted: 0,
    referralCount: 0,
    itemCount: 0,
    totalStock: 0,
    expiringSoonCount: 0,
    expiredCount: 0,
    lastUploadedAt: null,
  };
  for (const id of REGION_ORDER) {
    const summary = central[id];
    total.organizationCount += summary.organizationCount;
    total.userCount += summary.userCount;
    total.basicConsultation += summary.basicConsultation;
    total.referralTotal += summary.referralTotal;
    total.linkageCompleted += summary.linkageCompleted;
    total.referralCount += summary.referralCount;
    total.itemCount += summary.itemCount;
    total.totalStock += summary.totalStock;
    total.expiringSoonCount += summary.expiringSoonCount;
    total.expiredCount += summary.expiredCount;
    if (
      summary.lastUploadedAt &&
      (!total.lastUploadedAt || summary.lastUploadedAt > total.lastUploadedAt)
    ) {
      total.lastUploadedAt = summary.lastUploadedAt;
    }
  }
  return total;
}

export default function RegionListPage() {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);

  // 파일명이 아니라 제출 기관(organizations)을 그대로 쓴다.
  const { data, error, isLoading } = useCentralData(
    () =>
      Promise.all([listRegionUsage(), listInventoryStatus()]).then(([usage, inventory]) => ({
        usage,
        central: rollupByDistrict(usage, inventory),
      })),
    [],
  );

  // 선택 범위의 시연 요약 + 중앙 집계
  const scopeSummary = selectedDistrict ? districtSummaryMap[selectedDistrict] : citySummary;
  const scopeCentral = useMemo(() => {
    if (!data) return null;
    return selectedDistrict ? data.central[selectedDistrict] : sumCentral(data.central);
  }, [data, selectedDistrict]);
  const scopeName = selectedDistrict ? REGION_NAMES[selectedDistrict] : '화성시 전체';

  // 기관 목록 — 문제(부족·임박·미입력)가 있는 기관이 먼저 온다.
  const siteRows = useMemo(() => {
    const STATUS_PRIORITY: Record<OperationSite['status'], number> = {
      shortage: 0,
      expiring: 1,
      missing: 2,
      surplus: 3,
      normal: 4,
    };
    return mockSites
      .filter((site) => selectedDistrict === null || site.district === selectedDistrict)
      .sort(
        (a, b) =>
          STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
          b.expectedShortage - a.expectedShortage ||
          a.displayName.localeCompare(b.displayName, 'ko'),
      );
  }, [selectedDistrict]);

  const areaRows = useMemo<AreaRow[]>(() => {
    const rows = (data?.usage ?? []).map((row) => {
      const id = districtOfArea(row.organizationName);
      return {
        ...row,
        districtId: id,
        districtName: id ? REGION_NAMES[id] : row.regionName,
      };
    });
    return rows
      .filter((row) => selectedDistrict === null || row.districtId === selectedDistrict)
      .sort(
        (a, b) => b.userCount - a.userCount || a.organizationName.localeCompare(b.organizationName, 'ko'),
      );
  }, [data, selectedDistrict]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="지역·기관 현황"
        description="어느 지역·기관에 운영 문제가 있는지 찾아 내려가는 화면입니다. 구를 선택하면 기관 목록과 자료 제출 현황이 함께 좁혀집니다."
      />

      {/* 구 선택 */}
      <DistrictFilter
        selectedDistrict={selectedDistrict}
        districtRiskLevels={districtRiskLevels}
        onSelect={setSelectedDistrict}
      />

      {/* 선택 범위 요약 */}
      <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="선택 지역 요약">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">{scopeName}</h3>
            {selectedDistrict && <SiteStatusBadge status={districtRiskLevels[selectedDistrict]} />}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <CalendarClock size={14} />
              최근 자료 제출{' '}
              {scopeCentral?.lastUploadedAt ? formatUpdatedAt(scopeCentral.lastUploadedAt) : '없음'}
            </span>
            {selectedDistrict && (
              <Link
                to={`/regions/${selectedDistrict}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              >
                구 상세보기
                <ArrowRight size={13} />
              </Link>
            )}
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          <MetricTile label="운영 기관" value={scopeSummary.siteCount} unit="개소" source="확정" />
          <MetricTile label="부족 예상 기관" value={scopeSummary.shortageSiteCount} unit="개소" source="시연" />
          <MetricTile label="유통기한 임박" value={scopeSummary.expiringQuantity} unit="개" source="시연" />
          <MetricTile label="재배분 필요" value={scopeSummary.recommendationCount} unit="건" source="시연" />
          <MetricTile label="이용자 수" value={scopeCentral ? scopeCentral.userCount : null} unit="명" source="중앙" />
          <MetricTile label="현재 재고" value={scopeCentral ? scopeCentral.totalStock : null} unit="개" source="중앙" />
        </dl>
      </section>

      {/* 기관 목록 — 문제 있는 기관부터 */}
      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="기관 목록">
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-slate-900">기관 목록</h3>
            <span className="text-xs text-slate-400">{siteRows.length}개소</span>
            <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
              재고·수요는 시연 데이터
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            부족 → 유통기한 임박 → 데이터 미입력 순서로 정렬합니다. 기관명·유형·위치는 확정 자료입니다.
          </p>
        </div>
        <DataTable<OperationSite>
          columns={[
            {
              key: 'name',
              header: '기관명',
              render: (row) => (
                <span title={row.name} className="font-medium text-slate-800">
                  {row.displayName}
                </span>
              ),
            },
            { key: 'facilityType', header: '기관 유형', render: (row) => row.facilityType },
            { key: 'district', header: '구', render: (row) => REGION_NAMES[row.district] },
            { key: 'inventoryCount', header: '현재 재고', render: (row) => `${formatNumber(row.inventoryCount)}개` },
            {
              key: 'expectedShortage',
              header: '부족 예상',
              render: (row) =>
                row.expectedShortage > 0 ? (
                  <span className="font-medium text-rose-600">{formatNumber(row.expectedShortage)}개</span>
                ) : (
                  '-'
                ),
            },
            {
              key: 'expiringCount',
              header: '임박 수량',
              render: (row) =>
                row.expiringCount > 0 ? (
                  <span className="font-medium text-amber-600">{formatNumber(row.expiringCount)}개</span>
                ) : (
                  '-'
                ),
            },
            { key: 'status', header: '상태', render: (row) => <SiteStatusBadge status={row.status} /> },
            {
              key: 'lastUpdatedAt',
              header: '최근 데이터',
              render: (row) => <span className="text-slate-400">{formatDateTime(row.lastUpdatedAt)}</span>,
            },
          ]}
          data={siteRows}
          rowKey={(row) => row.id}
          emptyMessage="선택한 구에 등록된 기관이 없습니다."
        />
      </section>

      {/* 읍면동 자료 제출 현황 (중앙 저장소) */}
      <section className="rounded-xl border border-slate-200 bg-white p-5" aria-label="읍면동 제출 현황">
        <div className="mb-3">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-semibold text-slate-900">읍면동별 제출 현황</h3>
            <span className="rounded bg-teal-50 px-1.5 py-px text-[10px] font-medium text-teal-700 ring-1 ring-teal-600/20">
              실제 제출 데이터
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            중앙 저장소에 자료를 올린 읍면동입니다. 재제출로 대체된 자료는 집계에서 빠집니다.
          </p>
        </div>

        <CentralDataNotice
          isLoading={isLoading}
          error={error}
          isEmpty={areaRows.length === 0}
          emptyMessage={
            selectedDistrict
              ? `${REGION_NAMES[selectedDistrict]}에서 아직 자료를 제출한 읍면동이 없습니다.`
              : '아직 자료를 제출한 읍면동이 없습니다.'
          }
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
    </div>
  );
}
