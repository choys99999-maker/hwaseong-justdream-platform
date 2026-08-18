import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import AdminHero from '../../components/common/AdminHero';
import SiteStatusBadge from '../../components/common/SiteStatusBadge';
import SiteDetailDrawer from '../../components/sites/SiteDetailDrawer';
import InventoryUpdateDrawer from '../../components/inventory/InventoryUpdateDrawer';
import InventoryPage from '../InventoryPage';
import { useCentralData } from '../../hooks/useCentralData';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { REGION_NAMES } from '../../data/regionMeta';
import { buildSiteRows, updateGapLabel, type SiteOperationRow } from '../../utils/siteOperations';
import { formatNumber } from '../../utils/format';
import type { SiteStatus } from '../../types';

const HERO_GRADIENT = 'linear-gradient(110deg, #EDF5FD 0%, #F8FBFE 100%)';

const TABS = [
  { to: '/admin/sites', label: '거점' },
  { to: '/admin/sites/inventory', label: '재고' },
] as const;

/** 목록 필터 — 담당자가 실제로 나누는 세 가지뿐이다. */
type StatusFilter = 'all' | 'shortage' | 'check' | 'normal';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'shortage', label: '물품 부족' },
  { key: 'check', label: '확인 필요' },
  { key: 'normal', label: '정상' },
];

/** 운영 현황 KPI의 "확인 필요 거점 전체 보기" 링크(`?status=check`)처럼 다른 화면에서 필터를 지정해 들어온다. */
function resolveStatusFilter(value: string | null): StatusFilter {
  if (value === 'shortage' || value === 'check' || value === 'normal') return value;
  return 'all';
}

function matchesFilter(status: SiteStatus, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'shortage') return status === 'shortage';
  if (filter === 'check') return status === 'missing' || status === 'expiring';
  return status === 'normal';
}

/** 문제 있는 거점이 먼저 온다. */
const STATUS_PRIORITY: Record<SiteStatus, number> = {
  shortage: 0,
  expiring: 1,
  missing: 2,
  normal: 3,
};

/**
 * 거점 관리.
 *
 * 답해야 할 질문은 둘이다 — "거점이 지금 어떤 상태인가", "재고를 어떻게 고치는가".
 * 그래서 화면도 [거점]·[재고] 탭 둘, 고치는 길은 [⚡ 재고 업데이트] 하나뿐이다.
 * 거점을 누르면 별도 페이지로 들어가지 않고 같은 화면 오른쪽 패널이 열린다
 * (`/admin/sites/:siteId` 로 주소는 남아 링크·뒤로가기가 그대로 동작한다).
 */
export default function SiteOperationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();
  const [searchParams] = useSearchParams();
  const isInventoryTab = location.pathname.startsWith('/admin/sites/inventory');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => resolveStatusFilter(searchParams.get('status')));
  const [updateOpen, setUpdateOpen] = useState(false);
  /** 현황 저장·재고 반영 후 목록이 옛 값을 보여주지 않도록 다시 읽는다. */
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, error, isLoading } = useCentralData(() => listSiteQuickStatus(), [refreshKey]);
  // 현장 입력을 아직/끝내 못 읽은 상태. 못 읽은 것을 "입력 없음"으로 부르지 않기 위해 구분한다.
  const fieldStatusUnknown = data === null;

  const allRows = useMemo(() => buildSiteRows(data ?? null), [data]);

  const rows = useMemo(
    () =>
      allRows
        .filter((row) => matchesFilter(row.site.status, statusFilter))
        .sort(
          (a, b) =>
            STATUS_PRIORITY[a.site.status] - STATUS_PRIORITY[b.site.status] ||
            Number(b.needsUpdate) - Number(a.needsUpdate) ||
            a.site.displayName.localeCompare(b.site.displayName, 'ko'),
        ),
    [allRows, statusFilter],
  );

  const selectedRow = siteId ? (allRows.find((row) => row.site.id === siteId) ?? null) : null;

  const summary = useMemo(
    () => ({
      total: allRows.length,
      shortage: allRows.filter((row) => row.site.status === 'shortage').length,
      needsCheck: allRows.filter((row) => row.site.status === 'missing' || row.site.status === 'expiring')
        .length,
      needsUpdate: fieldStatusUnknown ? null : allRows.filter((row) => row.needsUpdate).length,
    }),
    [allRows, fieldStatusUnknown],
  );

  return (
    <div className="space-y-5">
      <AdminHero
        title="거점 관리"
        description="화성시 25개 거점의 운영 상태를 관리합니다. 고칠 때는 [재고 업데이트] 하나로 들어갑니다."
        gradient={HERO_GRADIENT}
        actions={
          <button
            type="button"
            onClick={() => setUpdateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            <Zap size={15} /> 재고 업데이트
          </button>
        }
        summary={
          !isInventoryTab ? (
            <>
              <span className="text-sm font-semibold text-[#182230]">화성시 거점 {summary.total}곳</span>
              <HeroStat dot="#E5484D" label="물품 부족" value={summary.shortage} />
              <HeroStat dot="#DC6E2D" label="확인 필요" value={summary.needsCheck} />
              <HeroStat dot="#98A2B3" label="갱신 필요" value={summary.needsUpdate ?? '—'} />
              {error && <span className="text-xs text-amber-700">현장 입력을 불러오지 못했습니다</span>}
            </>
          ) : undefined
        }
      />

      <div
        className="inline-flex gap-1 rounded-lg border border-slate-200 bg-white p-1"
        role="tablist"
        aria-label="거점 관리 탭"
      >
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
        <InventoryPage
          // 거점 상세에서 [전체 재고 보기]로 넘어오면 그 읍면동으로 검색된 상태에서 시작한다.
          key={`inventory-${searchParams.get('q') ?? ''}`}
          embedded
          refreshToken={refreshKey}
          initialKeyword={searchParams.get('q') ?? ''}
        />
      ) : (
        <>
          <div
            className="flex flex-wrap gap-1.5 rounded-lg border border-[#DCE6F0] bg-white px-3 py-2.5"
            role="group"
            aria-label="거점 상태 필터"
          >
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                aria-pressed={statusFilter === filter.key}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  statusFilter === filter.key
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <SiteTable
            rows={rows}
            selectedId={siteId ?? null}
            fieldStatusUnknown={fieldStatusUnknown}
            isLoading={isLoading}
          />

          <p className="text-xs text-slate-400">
            현재 상태·최근 갱신은 현장 담당자가 저장한 실제 값입니다. 운영 상태·부족 수량은 아직 거점 시연
            수치입니다.
          </p>
        </>
      )}

      {selectedRow && (
        <SiteDetailDrawer
          key={selectedRow.site.id}
          row={selectedRow}
          fieldStatusUnknown={fieldStatusUnknown}
          startEditing={searchParams.get('edit') === '1'}
          onClose={() => navigate('/admin/sites')}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {updateOpen && (
        <InventoryUpdateDrawer
          onClose={() => setUpdateOpen(false)}
          onApplied={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}

/** Hero 하단에 흡수한 작은 숫자 그룹 — 별도 카드를 새로 만들지 않는다. */
function HeroStat({ dot, label, value }: { dot: string; label: string; value: number | string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[#667085]">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: dot }} />
      {label} <strong className="font-semibold tabular-nums text-[#182230]">{value}</strong>
    </span>
  );
}

/** 거점 목록. 한 줄이 곧 한 거점이고, 누르면 오른쪽 패널이 열린다. */
function SiteTable({
  rows,
  selectedId,
  fieldStatusUnknown,
  isLoading,
}: {
  rows: SiteOperationRow[];
  selectedId: string | null;
  /** 현장 입력을 아직 못 읽었다 — 이때는 '입력 없음' 대신 '—'로 둔다. */
  fieldStatusUnknown: boolean;
  isLoading: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-12 text-center text-sm text-slate-400">
        조건에 맞는 거점이 없습니다.
      </p>
    );
  }

  const unknownText = isLoading ? '확인 중' : '—';
  const grid = 'grid grid-cols-[1.6fr_0.9fr_1fr_1fr_1.1fr_0.7fr_28px] gap-4';

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-[#DCE6F0] bg-white">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-[#004696]" aria-hidden />
      <div className={`${grid} border-b border-slate-100 bg-[#F4F8FC] px-5 py-3 text-xs font-medium text-slate-400`}>
        <span>거점명</span>
        <span>지역</span>
        <span>현재 상태</span>
        <span>최근 갱신</span>
        <span>주요 품목</span>
        <span>부족</span>
        <span />
      </div>
      <ul className="divide-y divide-[#EDF1F5]">
        {rows.map((row) => (
          <li key={row.site.id}>
            <Link
              to={`/admin/sites/${row.site.id}`}
              aria-current={row.site.id === selectedId ? 'true' : undefined}
              className={`${grid} items-center px-5 py-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                row.site.id === selectedId
                  ? 'bg-[#EAF3FC]'
                  : row.site.status === 'shortage'
                    ? 'hover:bg-[#FFF5F3]'
                    : row.site.status === 'missing' || row.site.status === 'expiring'
                      ? 'hover:bg-[#FFF9F0]'
                      : 'hover:bg-[#F8FBFE]'
              }`}
            >
              <span className="min-w-0 truncate font-medium text-slate-800" title={row.site.name}>
                {row.site.displayName}
              </span>

              <span className="text-slate-500">{REGION_NAMES[row.site.district]}</span>

              <span>
                <SiteStatusBadge status={row.site.status} />
              </span>

              <span
                className={!fieldStatusUnknown && row.needsUpdate ? 'font-medium text-amber-700' : 'text-slate-500'}
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
