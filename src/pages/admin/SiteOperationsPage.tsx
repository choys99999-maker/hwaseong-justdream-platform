import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, Zap } from 'lucide-react';
import SiteStatusBadge from '../../components/common/SiteStatusBadge';
import SiteDetailDrawer from '../../components/sites/SiteDetailDrawer';
import InventoryUpdateDrawer from '../../components/inventory/InventoryUpdateDrawer';
import InventoryPage from '../InventoryPage';
import {
  Accent,
  ActionRow,
  AllClear,
  CARD_CLASS,
  DetailSection,
  HS,
  OverviewSection,
  PageIntro,
  SourceNote,
  SubTabs,
  VizCard,
  type ActionTone,
} from '../../components/admin/ui';
import { RankBars, StatusDonut } from '../../components/admin/charts';
import { useCentralData } from '../../hooks/useCentralData';
import { listSiteQuickStatus } from '../../store/citizenSites';
import { REGION_NAMES, REGION_ORDER } from '../../data/regionMeta';
import { buildSiteRows, updateGapLabel, type SiteOperationRow } from '../../utils/siteOperations';
import { formatNumber } from '../../utils/format';
import type { DistrictId, SiteStatus } from '../../types';

/** 목록 필터 — 담당자가 실제로 나누는 세 가지뿐이다. */
type StatusFilter = 'all' | 'shortage' | 'check' | 'normal';

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'shortage', label: '물품 부족' },
  { key: 'check', label: '확인 필요' },
  { key: 'normal', label: '정상' },
];

type SiteTab = 'attention' | 'all';

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

const TONE_BY_STATUS: Record<SiteStatus, ActionTone> = {
  shortage: 'danger',
  expiring: 'warning',
  missing: 'neutral',
  normal: 'info',
};

const TAG_BY_STATUS: Record<SiteStatus, string> = {
  shortage: '물품 부족',
  expiring: '유통기한 임박',
  missing: '자료 확인',
  normal: '정보 확인',
};

/** 이 거점을 지금 봐야 하는 이유 한 줄. 표의 여러 칸을 문장 하나로 대신한다. */
function reasonOf(row: SiteOperationRow): string {
  const { site } = row;
  if (site.status === 'shortage') return `${site.focusItem} ${formatNumber(site.expectedShortage)}개 부족`;
  if (site.status === 'expiring') return `${site.focusItem} 유통기한 임박 ${formatNumber(site.expiringCount)}개`;
  if (site.status === 'missing') return '거점 자료가 등록되지 않았습니다';
  return `최근 갱신 ${updateGapLabel(row)}`;
}

/**
 * 거점 관리.
 *
 * 25곳을 처음부터 표로 펼치지 않는다. 먼저 "전체가 어떤 상태인가 · 어느 권역이 문제인가 ·
 * 지금 어디부터 볼 것인가" 세 가지에만 답하고, 전문 표는 [전체 거점] 을 눌렀을 때만 나온다.
 *
 * 고치는 길은 예전 그대로 [⚡ 재고 업데이트] 하나뿐이고, 거점을 누르면 별도 페이지 대신
 * 같은 화면 오른쪽 패널이 열린다(`/admin/sites/:siteId` 주소는 그대로 남는다).
 */
export default function SiteOperationsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { siteId } = useParams<{ siteId: string }>();
  const [searchParams] = useSearchParams();
  const isInventoryTab = location.pathname.startsWith('/admin/sites/inventory');

  const initialStatus = resolveStatusFilter(searchParams.get('status'));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus);
  const [districtFilter, setDistrictFilter] = useState<DistrictId | 'all'>('all');
  // 기본은 언제나 "확인 필요". 다른 화면에서 상태를 지정해 들어왔을 때만 전체 표로 연다.
  const [tab, setTab] = useState<SiteTab>(
    initialStatus === 'all' || initialStatus === 'check' ? 'attention' : 'all',
  );
  const [updateOpen, setUpdateOpen] = useState(false);
  /** 현황 저장·재고 반영 후 목록이 옛 값을 보여주지 않도록 다시 읽는다. */
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, error, isLoading } = useCentralData(() => listSiteQuickStatus(), [refreshKey]);
  // 현장 입력을 아직/끝내 못 읽은 상태. 못 읽은 것을 "입력 없음"으로 부르지 않기 위해 구분한다.
  const fieldStatusUnknown = data === null;

  const allRows = useMemo(() => buildSiteRows(data ?? null), [data]);

  const byPriority = useMemo(
    () =>
      [...allRows].sort(
        (a, b) =>
          STATUS_PRIORITY[a.site.status] - STATUS_PRIORITY[b.site.status] ||
          b.site.expectedShortage - a.site.expectedShortage ||
          Number(b.needsUpdate) - Number(a.needsUpdate) ||
          a.site.displayName.localeCompare(b.site.displayName, 'ko'),
      ),
    [allRows],
  );

  const attentionRows = useMemo(
    () => byPriority.filter((row) => row.site.status !== 'normal'),
    [byPriority],
  );

  const tableRows = useMemo(
    () =>
      byPriority.filter(
        (row) =>
          matchesFilter(row.site.status, statusFilter) &&
          (districtFilter === 'all' || row.site.district === districtFilter),
      ),
    [byPriority, statusFilter, districtFilter],
  );

  const selectedRow = siteId ? (allRows.find((row) => row.site.id === siteId) ?? null) : null;

  const summary = useMemo(() => {
    const shortage = allRows.filter((row) => row.site.status === 'shortage').length;
    const needsCheck = allRows.filter(
      (row) => row.site.status === 'missing' || row.site.status === 'expiring',
    ).length;
    return {
      total: allRows.length,
      normal: allRows.length - shortage - needsCheck,
      shortage,
      needsCheck,
      needsUpdate: fieldStatusUnknown ? null : allRows.filter((row) => row.needsUpdate).length,
    };
  }, [allRows, fieldStatusUnknown]);

  /** 권역별 확인이 필요한 거점 수. 정상 거점 수는 넣지 않는다 — 답해야 할 질문이 아니다. */
  const districtRanking = useMemo(
    () =>
      REGION_ORDER.map((id) => ({
        key: id,
        label: REGION_NAMES[id],
        value: allRows.filter((row) => row.site.district === id && row.site.status !== 'normal').length,
        sub: `${allRows.filter((row) => row.site.district === id).length}곳 중`,
      }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [allRows],
  );

  /** 지금 확인할 거점 3곳. 문제가 없으면 현장 입력이 가장 오래된 곳을 대신 올린다. */
  const topActions = useMemo(() => {
    if (attentionRows.length > 0) return attentionRows.slice(0, 3);
    return byPriority.filter((row) => row.needsUpdate).slice(0, 3);
  }, [attentionRows, byPriority]);

  function openTable(status: StatusFilter, district: DistrictId | 'all' = 'all') {
    setStatusFilter(status);
    setDistrictFilter(district);
    setTab(status === 'check' ? 'attention' : 'all');
  }

  const updateButton = (
    <button
      type="button"
      onClick={() => setUpdateOpen(true)}
      className="ad-lift inline-flex items-center gap-1.5 rounded-xl bg-[#004696] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#00356F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] focus-visible:ring-offset-2"
    >
      <Zap size={15} /> 재고 업데이트
    </button>
  );

  const screenTabs = (
    <div
      className="inline-flex gap-1 rounded-xl border border-[rgba(20,50,80,0.08)] bg-white p-1"
      role="tablist"
      aria-label="거점 관리 화면"
    >
      {(
        [
          { to: '/admin/sites', label: '거점', active: !isInventoryTab },
          { to: '/admin/sites/inventory', label: '재고', active: isInventoryTab },
        ] as const
      ).map((item) => (
        <Link
          key={item.to}
          to={item.to}
          role="tab"
          aria-selected={item.active}
          className={`rounded-lg px-4 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
            item.active
              ? 'bg-[#EAF3FC] text-[#004696]'
              : 'text-[#667085] hover:bg-[#F3F6FA] hover:text-[#182230]'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );

  if (isInventoryTab) {
    return (
      <>
        <InventoryPage
          // 거점 상세에서 [전체 재고 보기]로 넘어오면 그 읍면동으로 검색된 상태에서 시작한다.
          key={`inventory-${searchParams.get('q') ?? ''}`}
          screenTabs={screenTabs}
          headerActions={updateButton}
          refreshToken={refreshKey}
          initialKeyword={searchParams.get('q') ?? ''}
        />
        {updateOpen && (
          <InventoryUpdateDrawer
            onClose={() => setUpdateOpen(false)}
            onApplied={() => setRefreshKey((k) => k + 1)}
          />
        )}
      </>
    );
  }

  const attentionCount = summary.shortage + summary.needsCheck;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageIntro
        eyebrow="거점 관리"
        headline={
          attentionCount > 0 ? (
            <>
              {summary.total}개 거점 중 <Accent>{attentionCount}곳</Accent>의 확인이 필요합니다
            </>
          ) : (
            <>{summary.total}개 거점이 모두 정상 운영 중입니다</>
          )
        }
        description="문제가 있는 거점을 먼저 확인하고, 필요하면 전체 운영 정보를 자세히 볼 수 있습니다."
        actions={updateButton}
      />

      {screenTabs}

      {/* ── OVERVIEW — 전체 상태 · 어느 권역이 문제인가 · 지금 어디부터 ── */}
      <OverviewSection label="거점 현황 요약">
        {/* 넓은 화면에서는 세 질문이 한 줄에 선다. 1024px 대에서는 그림 둘이 나란히 서고 조치는 아래 한 줄을 다 쓴다. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)_minmax(0,1.1fr)]">
          <VizCard title="전체 상태" question="25개 거점이 지금 어떤 상태인가?" delay={40}>
            <StatusDonut
              total={summary.total}
              centerLabel="전체 거점"
              segments={[
                {
                  key: 'normal',
                  label: '정상 운영',
                  value: summary.normal,
                  color: HS.success,
                  onSelect: () => openTable('normal'),
                },
                {
                  key: 'check',
                  label: '확인 필요',
                  value: summary.needsCheck,
                  color: HS.orange,
                  onSelect: () => openTable('check'),
                },
                {
                  key: 'shortage',
                  label: '물품 부족',
                  value: summary.shortage,
                  color: HS.danger,
                  onSelect: () => openTable('shortage'),
                },
              ]}
            />
          </VizCard>

          <VizCard title="권역별 확인 필요" question="어느 권역이 가장 문제인가?" delay={90}>
            <RankBars
              items={districtRanking.map((item) => ({
                key: item.key,
                label: item.label,
                value: item.value,
                valueText: `${item.value}곳`,
                sub: item.sub,
                onSelect: () => openTable('all', item.key),
              }))}
              emptyMessage="확인이 필요한 권역이 없습니다."
            />
          </VizCard>

          <VizCard
            title="지금 확인할 거점"
            question="무엇부터 보면 되는가?"
            delay={140}
            className="lg:col-span-2 xl:col-span-1"
          >
            {topActions.length === 0 ? (
              <AllClear message="지금 확인이 필요한 거점이 없습니다." />
            ) : (
              <div className="space-y-2">
                {topActions.map((row, i) => (
                  <ActionRow
                    key={row.site.id}
                    index={i}
                    tone={TONE_BY_STATUS[row.site.status]}
                    tag={TAG_BY_STATUS[row.site.status]}
                    title={row.site.displayName}
                    detail={`${reasonOf(row)} · ${REGION_NAMES[row.site.district]}`}
                    cta="상세 보기"
                    as={({ className, style, children }) => (
                      <Link to={`/admin/sites/${row.site.id}`} className={className} style={style}>
                        {children}
                      </Link>
                    )}
                  />
                ))}
              </div>
            )}
            {summary.needsUpdate !== null && summary.needsUpdate > 0 && (
              <p className="mt-3 text-[11.5px] text-[#8A96A8]">
                이와 별개로 현장 입력이 하루 넘게 갱신되지 않은 거점이{' '}
                <strong className="font-semibold text-[#667085]">{summary.needsUpdate}곳</strong> 있습니다.
              </p>
            )}
          </VizCard>
        </div>
      </OverviewSection>

      {/* ── DETAIL — 기본은 확인 필요 목록, 전체 표는 눌렀을 때만 ── */}
      <DetailSection label="거점 목록">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SubTabs
            label="거점 목록 범위"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'attention', label: '확인 필요', count: attentionCount },
              { key: 'all', label: '전체 거점', count: summary.total },
            ]}
          />
          {error && <span className="text-[12px] text-[#B4530F]">현장 입력을 불러오지 못했습니다</span>}
        </div>

        <div className="mt-4">
          {tab === 'attention' ? (
            <AttentionList rows={attentionRows} selectedId={siteId ?? null} />
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="거점 상태 필터">
                  {STATUS_FILTERS.map((filter) => (
                    <Chip
                      key={filter.key}
                      label={filter.label}
                      active={statusFilter === filter.key}
                      onClick={() => setStatusFilter(filter.key)}
                    />
                  ))}
                </div>
                <span aria-hidden className="h-3.5 w-px bg-[#DFE7EF]" />
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="권역 필터">
                  <Chip
                    label="전 권역"
                    active={districtFilter === 'all'}
                    onClick={() => setDistrictFilter('all')}
                  />
                  {REGION_ORDER.map((id) => (
                    <Chip
                      key={id}
                      label={REGION_NAMES[id]}
                      active={districtFilter === id}
                      onClick={() => setDistrictFilter(id)}
                    />
                  ))}
                </div>
                <span className="ml-auto text-[12.5px] text-[#667085]">
                  {formatNumber(tableRows.length)}곳 표시
                </span>
              </div>

              <SiteTable
                rows={tableRows}
                selectedId={siteId ?? null}
                fieldStatusUnknown={fieldStatusUnknown}
                isLoading={isLoading}
              />
            </>
          )}
        </div>
      </DetailSection>

      <SourceNote>
        현재 상태·최근 갱신은 현장 담당자가 저장한 실제 값입니다. 운영 상태·부족 수량은 아직 거점 시연
        수치입니다.
      </SourceNote>

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

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
        active ? 'bg-[#004696] text-white' : 'bg-white text-[#667085] ring-1 ring-inset ring-[#DFE7EF] hover:bg-[#F3F6FA]'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * 확인이 필요한 거점 목록.
 *
 * 7열짜리 표가 아니라 한 줄에 하나의 판단이 담긴다 — 어디가, 무엇이 문제고,
 * 마지막으로 언제 갱신됐는지. 나머지 값은 [전체 거점] 표에 그대로 남아 있다.
 */
function AttentionList({ rows, selectedId }: { rows: SiteOperationRow[]; selectedId: string | null }) {
  if (rows.length === 0) {
    return <AllClear message="확인이 필요한 거점이 없습니다. 25곳 모두 정상 운영 중입니다." />;
  }

  return (
    <ul className="space-y-2">
      {rows.map((row, i) => (
        <li key={row.site.id}>
          <Link
            to={`/admin/sites/${row.site.id}`}
            aria-current={row.site.id === selectedId ? 'true' : undefined}
            style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            className={`ad-rise ad-lift group flex min-h-[68px] items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
              row.site.id === selectedId
                ? 'border-[#004696] bg-[#F3F8FD]'
                : 'border-[#E7EEF6] hover:border-[#C9DCEF] hover:shadow-[0_6px_18px_rgba(30,64,100,0.07)]'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14.5px] font-semibold text-[#182230]" title={row.site.name}>
                  {row.site.displayName}
                </span>
                <SiteStatusBadge status={row.site.status} />
              </div>
              <p className="mt-1 truncate text-[13px] text-[#4C5A6E]">{reasonOf(row)}</p>
              <p className="mt-0.5 text-[11.5px] text-[#8A96A8]">
                최근 갱신 {updateGapLabel(row)} · {REGION_NAMES[row.site.district]}
              </p>
            </div>
            <span className="shrink-0 text-[12.5px] font-semibold text-[#004696]">
              상세 보기 <span aria-hidden>→</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 전체 거점 표. 예전 화면 그대로다 — 다만 눌러서 들어왔을 때만 나온다. */
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
      <p className="rounded-2xl border border-dashed border-[#DFE7EF] bg-white px-4 py-12 text-center text-[13px] text-[#98A2B3]">
        조건에 맞는 거점이 없습니다.
      </p>
    );
  }

  const unknownText = isLoading ? '확인 중' : '—';
  const grid = 'grid grid-cols-[1.6fr_0.9fr_1fr_1fr_1.1fr_0.7fr_28px] gap-4';

  return (
    <div className={`overflow-hidden ${CARD_CLASS}`}>
      <div className={`${grid} border-b border-[#EFF3F8] px-5 py-3 text-[11.5px] font-medium text-[#8A96A8]`}>
        <span>거점명</span>
        <span>지역</span>
        <span>현재 상태</span>
        <span>최근 갱신</span>
        <span>주요 품목</span>
        <span>부족</span>
        <span />
      </div>
      <ul className="divide-y divide-[#F3F6FA]">
        {rows.map((row) => (
          <li key={row.site.id}>
            <Link
              to={`/admin/sites/${row.site.id}`}
              aria-current={row.site.id === selectedId ? 'true' : undefined}
              className={`${grid} items-center px-5 py-3.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#004696] ${
                row.site.id === selectedId ? 'bg-[#EAF3FC]' : 'hover:bg-[#F7FAFD]'
              }`}
            >
              <span className="min-w-0 truncate font-medium text-[#182230]" title={row.site.name}>
                {row.site.displayName}
              </span>

              <span className="text-[#667085]">{REGION_NAMES[row.site.district]}</span>

              <span>
                <SiteStatusBadge status={row.site.status} />
              </span>

              <span
                className={
                  !fieldStatusUnknown && row.needsUpdate ? 'font-medium text-[#B4530F]' : 'text-[#667085]'
                }
              >
                {fieldStatusUnknown ? unknownText : updateGapLabel(row)}
              </span>

              <span className="min-w-0 truncate text-[#4C5A6E]">
                {row.quickStatus?.focusItem ?? row.site.focusItem}
              </span>

              <span>
                {row.site.expectedShortage > 0 ? (
                  <span className="font-semibold text-[#E5484D]">
                    {formatNumber(row.site.expectedShortage)}개
                  </span>
                ) : (
                  <span className="text-[#CBD5E1]">—</span>
                )}
              </span>

              <ChevronRight size={16} className="text-[#CBD5E1]" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
