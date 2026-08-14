import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import SiteStatusBadge from '../../components/common/SiteStatusBadge';
import DistrictFilter from '../../components/map/DistrictFilter';
import InventoryPage from '../InventoryPage';
import { useCentralData } from '../../hooks/useCentralData';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { availabilityLabel } from '../../components/sites/QuickStatusForm';
import { districtRiskLevels } from '../../data/operationSummary';
import { REGION_NAMES } from '../../data/regionMeta';
import { buildSiteRows, updateGapLabel, type SiteOperationRow } from '../../utils/siteOperations';
import { formatNumber } from '../../utils/format';
import type { DistrictId, SiteStatus } from '../../types';

const TABS = [
  { to: '/admin/sites', label: '거점' },
  { to: '/admin/sites/inventory', label: '재고' },
] as const;

/** 문제 있는 거점이 먼저 온다. 정렬 규칙은 기존 거점 목록과 같다. */
const STATUS_PRIORITY: Record<SiteStatus, number> = {
  shortage: 0,
  expiring: 1,
  missing: 2,
  normal: 3,
};

/**
 * 거점 운영.
 *
 * 흩어져 있던 거점 운영 · 물품 현황 · 빠른 현황 입력 · 재고 관제를 한 메뉴로 합쳤다.
 * 첫 화면은 거점 목록 하나뿐이고, 거점을 누르면 상세(현황·빠른 입력·재고·입력 이력)로 들어간다.
 */
export default function SiteOperationsPage() {
  const location = useLocation();
  const isInventoryTab = location.pathname.startsWith('/admin/sites/inventory');
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);

  const { data, error, isLoading } = useCentralData(() => listSiteQuickStatus(), []);
  // 현장 입력을 아직/끝내 못 읽은 상태. 못 읽은 것을 "입력 없음"으로 부르지 않기 위해 구분한다.
  const fieldStatusUnknown = data === null;

  const rows = useMemo(() => {
    const all = buildSiteRows(data ?? null);
    return all
      .filter((row) => selectedDistrict === null || row.site.district === selectedDistrict)
      .sort(
        (a, b) =>
          STATUS_PRIORITY[a.site.status] - STATUS_PRIORITY[b.site.status] ||
          Number(b.needsUpdate) - Number(a.needsUpdate) ||
          a.site.displayName.localeCompare(b.site.displayName, 'ko'),
      );
  }, [data, selectedDistrict]);

  const summary = useMemo(
    () => ({
      total: rows.length,
      shortage: rows.filter((row) => row.site.status === 'shortage').length,
      needsCheck: rows.filter((row) => row.site.status === 'missing' || row.site.status === 'expiring').length,
      needsUpdate: fieldStatusUnknown ? null : rows.filter((row) => row.needsUpdate).length,
    }),
    [rows, fieldStatusUnknown],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="거점 운영"
        description="거점의 지금 상태와 재고를 한곳에서 봅니다. 거점을 누르면 현황·빠른 입력·재고·입력 이력을 볼 수 있습니다."
        actions={
          <Link
            to="/admin/quick-status"
            className="inline-flex items-center gap-1.5 rounded-lg border border-teal-200 px-3 py-2 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Zap size={15} /> 빠른 현황 입력
          </Link>
        }
      />

      <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1" role="tablist" aria-label="거점 운영 탭">
        {TABS.map((tab) => {
          const active = tab.to === '/admin/sites/inventory' ? isInventoryTab : !isInventoryTab;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              role="tab"
              aria-selected={active}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                active ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {isInventoryTab ? (
        <InventoryPage embedded />
      ) : (
        <>
          <DistrictFilter
            selectedDistrict={selectedDistrict}
            districtRiskLevels={districtRiskLevels}
            onSelect={setSelectedDistrict}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm">
            <span className="font-semibold text-slate-900">
              {selectedDistrict ? REGION_NAMES[selectedDistrict] : '화성시 전체'} 거점 {summary.total}곳
            </span>
            <span className="text-slate-600">
              부족 <strong className="font-semibold tabular-nums text-rose-600">{summary.shortage}</strong>
            </span>
            <span className="text-slate-600">
              확인 필요 <strong className="font-semibold tabular-nums text-amber-600">{summary.needsCheck}</strong>
            </span>
            <span className="text-slate-600">
              갱신 필요{' '}
              <strong className="font-semibold tabular-nums text-slate-800">
                {summary.needsUpdate ?? '—'}
              </strong>
            </span>
            {error && <span className="ml-auto text-xs text-amber-700">현장 입력을 불러오지 못했습니다</span>}
          </div>

          <SiteTable rows={rows} fieldStatusUnknown={fieldStatusUnknown} isLoading={isLoading} />

          <p className="text-xs text-slate-400">
            현재 상태·최근 갱신은 현장 담당자가 저장한 실제 값(빠른 현황 입력)입니다. 운영 상태·부족 수량은 아직 거점
            시연 수치입니다.
          </p>
        </>
      )}
    </div>
  );
}

/** 거점 목록. 한 줄이 곧 한 거점이고, 누르면 상세로 들어간다. */
function SiteTable({
  rows,
  fieldStatusUnknown,
  isLoading,
}: {
  rows: SiteOperationRow[];
  /** 현장 입력을 아직 못 읽었다 — 이때는 '입력 없음' 대신 '—'로 둔다. */
  fieldStatusUnknown: boolean;
  isLoading: boolean;
}) {
  const unknownText = isLoading ? '확인 중' : '—';
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-400">
        선택한 구에 등록된 거점이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr_1.1fr_0.7fr_28px] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-medium text-slate-400">
        <span>거점</span>
        <span>운영 상태</span>
        <span>현장 입력</span>
        <span>최근 갱신</span>
        <span>주요 품목</span>
        <span>부족</span>
        <span />
      </div>
      <ul className="divide-y divide-slate-50">
        {rows.map((row) => (
          <li key={row.site.id}>
            <Link
              to={`/admin/sites/${row.site.id}`}
              className="grid grid-cols-[1.6fr_0.9fr_0.9fr_0.9fr_1.1fr_0.7fr_28px] items-center gap-4 px-5 py-3.5 text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800" title={row.site.name}>
                  {row.site.displayName}
                </span>
                <span className="block text-xs text-slate-400">{REGION_NAMES[row.site.district]}</span>
              </span>

              <span>
                <SiteStatusBadge status={row.site.status} />
              </span>

              <span className={row.quickStatus ? 'text-slate-700' : 'text-slate-400'}>
                {fieldStatusUnknown
                  ? unknownText
                  : row.quickStatus
                    ? availabilityLabel(row.quickStatus.availability)
                    : '입력 없음'}
              </span>

              <span
                className={
                  !fieldStatusUnknown && row.needsUpdate ? 'font-medium text-amber-700' : 'text-slate-500'
                }
              >
                {fieldStatusUnknown ? unknownText : updateGapLabel(row)}
              </span>

              <span className="min-w-0 truncate text-slate-600">
                {row.quickStatus?.focusItem ?? row.site.focusItem}
              </span>

              <span>
                {row.site.expectedShortage > 0 ? (
                  <span className="font-medium text-rose-600">{formatNumber(row.site.expectedShortage)}개</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </span>

              <ChevronRight size={16} className="text-slate-300" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
