import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import StatusBadge from '../components/common/StatusBadge';
import CentralDataNotice from '../components/common/CentralDataNotice';
import {
  Accent,
  ActionRow,
  ActionSection,
  AllClear,
  CARD_CLASS,
  DetailSection,
  HS,
  OverviewSection,
  PageIntro,
  SourceNote,
  VizCard,
  type ActionTone,
} from '../components/admin/ui';
import { RankBars, SegmentBar } from '../components/admin/charts';
import { useCentralData } from '../hooks/useCentralData';
import { listInventoryStatus, type InventoryStatus as InventoryRow } from '../store/analytics';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES } from '../data/regionMeta';
import { inventoryStatusOf } from '../utils/inventoryStatus';
import { getOutboundSnapshot, outboundByOrgItem, subscribeOutbound } from '../store/outboundLedger';
import { formatDate, formatNumber, formatStock } from '../utils/format';
import type { DataSource, InventoryStatus } from '../types';

// ─── 상수 ──────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'all',    label: '전체'     },
  { value: '정상',   label: '정상'     },
  { value: '부족',   label: '부족'     },
  { value: '임박',   label: '임박'     },
  { value: '확인 필요', label: '확인 필요' },
] as const;

const EXPIRY_TABS = [
  { value: 'all',  label: '전체'     },
  { value: '7',    label: '7일 이내' },
  { value: '30',   label: '30일 이내' },
  { value: 'over', label: '기한 초과' },
] as const;

const STATUS_DOT: Record<string, string> = {
  '정상':    'bg-emerald-500',
  '임박':    'bg-amber-500',
  '부족':    'bg-rose-500',
  '확인 필요': 'bg-slate-400',
};

/** 상태별 권장 조치. 행이 상태 표시에서 끝나지 않고 다음 행동으로 이어지게 한다. */
const STATUS_ACTIONS: Record<string, { label: string; className: string } | undefined> = {
  '부족':    { label: '발주·확보 필요',     className: 'text-rose-600 font-medium' },
  '임박':    { label: '우선 배부 검토',      className: 'text-amber-600 font-medium' },
  '확인 필요': { label: '데이터 확인 필요',   className: 'text-slate-500' },
};

/** 데이터 출처. 지금은 모든 자료가 Excel 업로드로 들어오므로 실제 값은 EXCEL/NO_DATA 뿐이다. */
const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  EXCEL: 'EXCEL',
  MANUAL: '현장 입력',
  FMS: 'FMS',
  NO_DATA: '자료 없음',
};

/** 화면이 쓰는 한 줄. 상태·소속 구는 중앙 DB 값에서 계산한다. */
interface Row extends InventoryRow {
  id: string;
  status: InventoryStatus;
  districtName: string;
  /** 이용·상담 물품지원에서 발생한 현장 출고 합 (세션 출고 원장 기준) */
  fieldOutboundQuantity: number;
  /** 표시 재고 = 중앙 DB stock − 현장 출고. DB 값 자체는 바꾸지 않는다. */
  displayStock: number | null;
  /** 이 자료가 어디서 들어왔는지. 지금은 전부 Excel 업로드다. */
  dataSource: DataSource;
}

// ─── 유틸리티 ──────────────────────────────────────────────────────────────
// 유통기한 잔여일(daysToExpiration)·상태 판정은 중앙 DB(v_inventory_status)가 한다.
// 여기서는 그 값을 표시·필터에 쓰기만 하고 다시 계산하지 않는다.

function formatDDay(days: number): string {
  if (days < 0) return `D+${Math.abs(days)}`;
  if (days === 0) return 'D-Day';
  return `D-${days}`;
}

function dDayClass(days: number): string {
  if (days < 0) return 'text-rose-700 font-bold';
  if (days <= 7) return 'text-rose-600 font-semibold';
  if (days <= 30) return 'text-amber-600 font-medium';
  return 'text-slate-500';
}

function isDisposalRisk(item: Row): boolean {
  const d = item.daysToExpiration;
  return d !== null && d >= 0 && d <= 21 && (item.displayStock ?? 0) >= 10;
}

// ─── 소형 컴포넌트 ──────────────────────────────────────────────────────────

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#004696] focus:ring-[#004696]"
    />
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
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

function ActionBtn({ icon: Icon, label, danger = false }: { icon: LucideIcon; label: string; danger?: boolean }) {
  return (
    <button
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] ${
        danger ? 'bg-rose-50 text-rose-700 hover:bg-rose-100' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      <Icon size={13} />
      {label}
    </button>
  );
}

type SortKey = 'name' | 'currentStock' | 'expiryDate' | 'status';
type SortDir = 'asc' | 'desc';

function SortTh({
  label, col, sortKey, sortDir, onSort,
}: {
  label: string; col: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-medium text-[#8A96A8] hover:text-[#182230]"
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="text-slate-300" />}
      </span>
    </th>
  );
}

// ─── 드로어 내부 컴포넌트 ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{children}</p>;
}

function FlowRow({
  label, value, sign, max, barColor, textColor, bold = false,
}: {
  label: string; value: number; sign: string; max: number;
  barColor: string; textColor: string; bold?: boolean;
}) {
  const pct = max > 0 ? Math.max(3, Math.round((Math.abs(value) / max) * 100)) : 3;
  return (
    <div className="flex items-center gap-3">
      <span className="w-14 shrink-0 text-xs text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-16 shrink-0 text-right text-sm ${textColor} ${bold ? 'font-bold' : ''}`}>
        {sign}{formatNumber(value)}
      </span>
    </div>
  );
}

// ─── ItemDetailDrawer ────────────────────────────────────────────────────────

function ItemDetailDrawer({
  item, allItems, onClose,
}: {
  item: Row; allItems: Row[]; onClose: () => void;
}) {
  const days = item.daysToExpiration;
  const sameItems = allItems.filter((o) => o.itemName === item.itemName);
  const maxFlow = Math.max(
    item.inboundQuantity,
    item.outboundQuantity,
    item.fieldOutboundQuantity,
    Math.abs(item.displayStock ?? 0),
    1,
  );

  return (
    <aside className="hci-slide-in-right fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{item.itemName}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-slate-500">{item.organizationName}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{item.districtName}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{DATA_SOURCE_LABEL[item.dataSource]}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
        >
          <X size={18} />
        </button>
      </div>

      {/* 스크롤 본문 */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">

        {/* 재고 흐름 */}
        <section className="space-y-3">
          <SectionLabel>재고 흐름 (제출 기간 합계)</SectionLabel>
          <FlowRow label="입고" value={item.inboundQuantity}  sign="+" max={maxFlow} barColor="bg-emerald-500" textColor="text-emerald-700" />
          <FlowRow label="출고" value={item.outboundQuantity} sign="−" max={maxFlow} barColor="bg-sky-500"     textColor="text-sky-700" />
          {item.fieldOutboundQuantity > 0 && (
            // 이용·상담 물품지원이 만든 출고. 중앙 DB 의 기간 출고와 구분해서 보여준다.
            <FlowRow label="현장 출고" value={item.fieldOutboundQuantity} sign="−" max={maxFlow} barColor="bg-teal-400" textColor="text-teal-700" />
          )}
          <div className="border-t border-slate-100 pt-2">
            {item.displayStock === null ? (
              <div className="flex items-center justify-between">
                <span className="w-14 shrink-0 text-xs text-slate-400">현재재고</span>
                <span className="text-sm font-bold text-amber-600">확인 필요</span>
              </div>
            ) : (
              <FlowRow label="현재재고" value={item.displayStock} sign="=" max={maxFlow} barColor="bg-[#004696]" textColor="text-[#004696]" bold />
            )}
          </div>
          {item.hasAnomaly && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              중앙 DB 판정: 재고 근거가 맞지 않아 합계에서 제외된 품목입니다.
            </p>
          )}
        </section>

        {/* 유통기한 */}
        <section className="space-y-2">
          <SectionLabel>유통기한</SectionLabel>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {item.expirationDate ? formatDate(item.expirationDate) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">유통기한</p>
            </div>
            {days !== null && <p className={`text-xl font-bold ${dDayClass(days)}`}>{formatDDay(days)}</p>}
          </div>
        </section>

        {/* 기관별 보유현황 */}
        {sameItems.length > 1 && (
          <section className="space-y-2">
            <SectionLabel>{`기관별 보유현황 · ${item.itemName}`}</SectionLabel>
            <div className="space-y-1.5">
              {sameItems.map((o) => (
                <div
                  key={o.id}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                    o.id === item.id ? 'bg-[#EAF3FC] ring-1 ring-inset ring-[#BFD6EC]' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[o.status] ?? 'bg-slate-400'}`} />
                    <span className={o.id === item.id ? 'font-semibold text-[#004696]' : 'text-slate-700'}>
                      {o.organizationName}
                    </span>
                    {o.id === item.id && (
                      <span className="rounded bg-[#EAF3FC] px-1 py-0.5 text-[10px] font-medium text-[#004696]">현재</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{formatStock(o.displayStock)}개</span>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#004696] py-2.5 text-sm font-medium text-white hover:bg-[#00356F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]">
          <Truck size={15} />출고 등록
        </button>
        <button className="flex items-center justify-center rounded-lg border border-rose-200 px-3.5 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          <Trash2 size={15} />
        </button>
      </div>
    </aside>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

type QuickFilter = 'shortage' | 'expiring' | 'disposal' | null;

interface InventoryPageProps {
  /** [거점 관리 > 재고] 안에서 쓸 때. 상위 화면이 넘겨주는 [거점]/[재고] 전환 탭. */
  screenTabs?: ReactNode;
  headerActions?: ReactNode;
  /** 재고 업데이트가 반영되면 값이 바뀌고, 이 화면이 중앙 DB 를 다시 읽는다. */
  refreshToken?: number;
  /** 거점 상세에서 [전체 재고 보기]로 넘어왔을 때의 초기 검색어(읍면동). */
  initialKeyword?: string;
}

/**
 * 재고 — 화성시 전체 물품을 **확인하는** 화면.
 *
 * 249개 행을 읽는 화면이 아니라 "지금 문제인 품목이 몇 개인가"에 먼저 답하는 화면이다.
 *   1) 어떤 품목이 가장 모자란가 (남은 수량 순)
 *   2) 유통기한이 어떻게 구성돼 있는가
 *   3) 지금 조치할 품목은 무엇인가
 * 전체 표는 [전체 재고 N건 보기]를 눌렀을 때만 펼쳐진다.
 *
 * 여기서는 고치지 않는다. 고치는 길은 [거점 관리 > ⚡ 재고 업데이트] 하나뿐이라
 * 이 화면 안에는 자연어 입력창도 Excel 업로드도 두지 않는다.
 */
export default function InventoryPage({
  screenTabs,
  headerActions,
  refreshToken = 0,
  initialKeyword = '',
}: InventoryPageProps) {
  const [keyword,      setKeyword]      = useState(initialKeyword);
  const [region,       setRegion]       = useState('전체');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [quickFilter,  setQuickFilter]  = useState<QuickFilter>(null);
  const [sortKey,      setSortKey]      = useState<SortKey>('expiryDate');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [drawerItem,   setDrawerItem]   = useState<Row | null>(null);
  // 전체 표는 기본으로 접어 둔다. 거점 상세에서 읍면동을 지정해 넘어온 경우만 펼친 채 시작한다.
  const [detailOpen,   setDetailOpen]   = useState(initialKeyword !== '');

  // 입고/출고는 기간 합계, 현재재고·유통기한은 최신 제출본 기준.
  // 재제출분 제외·누계 시트 제외 규칙은 모두 v_inventory_status 안에 있다.
  const { data, error, isLoading } = useCentralData(() => listInventoryStatus(), [refreshToken]);

  // 이용·상담 물품지원이 만든 현장 출고. 저장 즉시 이 화면의 표시 재고에 반영된다.
  const outboundRecords = useSyncExternalStore(subscribeOutbound, getOutboundSnapshot);
  const fieldOutbound = useMemo(() => outboundByOrgItem(outboundRecords), [outboundRecords]);

  const items = useMemo<Row[]>(() => {
    return (data ?? []).map((row) => {
      const districtId = districtOfArea(row.organizationName);
      const fieldOut = fieldOutbound.get(`${row.organizationName}::${row.itemName}`) ?? 0;
      const built: Row = {
        ...row,
        id: `${row.organizationId}::${row.itemName}`,
        status: inventoryStatusOf(row),
        districtName: districtId ? REGION_NAMES[districtId] : row.regionName,
        fieldOutboundQuantity: fieldOut,
        displayStock: row.stock === null ? null : row.stock - fieldOut,
        // 지금은 중앙 저장소에 Excel 업로드로만 자료가 들어온다. FMS·현장 입력 어댑터가
        // 붙으면 이 값을 실제 출처로 채운다.
        dataSource: 'EXCEL',
      };
      return built;
    });
  }, [data, fieldOutbound]);

  const regions = useMemo(
    () => ['전체', ...Array.from(new Set(items.map((i) => i.organizationName)))],
    [items],
  );

  // ESC 로 드로어 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerItem(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Overview 집계 ───────────────────────────────────────────────────────
  const shortageCount = useMemo(() => items.filter((i) => i.status === '부족').length, [items]);
  const expiringCount = useMemo(() => items.filter((i) => i.status === '임박').length, [items]);
  const disposalCount = useMemo(() => items.filter(isDisposalRisk).length, [items]);
  const anomalyCount  = useMemo(() => items.filter((i) => i.hasAnomaly).length, [items]);

  /**
   * 품목별로 화성시 전체에 남은 수량. 같은 품목이 여러 거점에 흩어져 있어도
   * "이 물품이 시 전체에 얼마나 남았는가"는 하나의 값이어야 한다.
   */
  const scarcestItems = useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of items) {
      totals.set(item.itemName, (totals.get(item.itemName) ?? 0) + (item.displayStock ?? 0));
    }
    return Array.from(totals, ([name, stock]) => ({ name, stock }))
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 5);
  }, [items]);

  /** 유통기한 구성. 판정 기준(잔여일)은 중앙 DB 값을 그대로 쓴다. */
  const expiryBuckets = useMemo(() => {
    const bucket = { over: 0, d7: 0, d30: 0, safe: 0, unknown: 0 };
    for (const item of items) {
      const d = item.daysToExpiration;
      if (d === null) bucket.unknown += 1;
      else if (d < 0) bucket.over += 1;
      else if (d <= 7) bucket.d7 += 1;
      else if (d <= 30) bucket.d30 += 1;
      else bucket.safe += 1;
    }
    return bucket;
  }, [items]);

  /** 지금 조치할 품목. 부족 → 임박 → 근거 확인 순으로, 화면에는 5건까지만 올린다. */
  const priorityItems = useMemo(() => {
    const rank = (item: Row) =>
      item.status === '부족' ? 0 : item.status === '임박' ? 1 : item.hasAnomaly ? 2 : 3;
    return items
      .filter((item) => item.status === '부족' || item.status === '임박' || item.hasAnomaly)
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          (a.daysToExpiration ?? 9999) - (b.daysToExpiration ?? 9999) ||
          (a.displayStock ?? 0) - (b.displayStock ?? 0),
      );
  }, [items]);

  // 필터 + 정렬
  const filteredItems = useMemo(() => {
    const kw = keyword.trim();
    const filtered = items.filter((item) => {
      if (kw && !item.itemName.includes(kw) && !item.organizationName.includes(kw)) return false;
      if (region !== '전체' && item.organizationName !== region) return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (expiryFilter !== 'all') {
        const d = item.daysToExpiration;
        if (d === null) return false;
        if (expiryFilter === '7'    && d > 7)  return false;
        if (expiryFilter === '30'   && d > 30) return false;
        if (expiryFilter === 'over' && d >= 0) return false;
      }
      if (quickFilter === 'shortage' && item.status !== '부족') return false;
      if (quickFilter === 'expiring' && item.status !== '임박') return false;
      if (quickFilter === 'disposal' && !isDisposalRisk(item))  return false;
      return true;
    });

    const STATUS_ORDER: Record<string, number> = { '부족': 0, '임박': 1, '확인 필요': 2, '정상': 3 };
    return filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') cmp = a.itemName.localeCompare(b.itemName, 'ko');
      else if (sortKey === 'currentStock') cmp = (a.displayStock ?? Number.MAX_SAFE_INTEGER) - (b.displayStock ?? Number.MAX_SAFE_INTEGER);
      else if (sortKey === 'expiryDate') cmp = (a.expirationDate ?? '9999-12-31').localeCompare(b.expirationDate ?? '9999-12-31');
      else if (sortKey === 'status') cmp = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [items, keyword, region, statusFilter, expiryFilter, quickFilter, sortKey, sortDir]);

  /** 재고를 신뢰할 수 없어 합계에서 뺀 품목 수. 판정은 중앙 DB(v_inventory_status)가 한다. */
  const unverifiedCount = useMemo(
    () => filteredItems.filter((item) => item.hasAnomaly).length,
    [filteredItems],
  );

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  }

  function handleQuickFilter(f: QuickFilter) {
    setQuickFilter((prev) => (prev === f ? null : f));
  }

  /**
   * Overview·조치 목록에서 누르면 실제 필터가 걸리고 상세 표가 열린다.
   * 그림이 그림으로 끝나지 않게 하는 유일한 통로다(§16).
   */
  function drillTo(next: {
    keyword?: string;
    status?: string;
    expiry?: string;
    quick?: QuickFilter;
    region?: string;
  }) {
    setKeyword(next.keyword ?? '');
    setStatusFilter(next.status ?? 'all');
    setExpiryFilter(next.expiry ?? 'all');
    setQuickFilter(next.quick ?? null);
    setRegion(next.region ?? '전체');
    setDetailOpen(true);
  }

  const allSelected  = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const headline =
    priorityItems.length > 0 ? (
      <>
        현재 우선 확인이 필요한 재고가 <Accent>{priorityItems.length}건</Accent> 있습니다
      </>
    ) : items.length > 0 ? (
      <>전체 {formatNumber(items.length)}개 품목이 모두 정상입니다</>
    ) : (
      <>아직 올라온 재고 자료가 없습니다</>
    );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <PageIntro
        eyebrow="재고 현황"
        headline={headline}
        description="부족하거나 곧 문제가 될 재고를 먼저 보여줍니다. 전체 품목표는 아래에서 펼쳐 볼 수 있습니다."
        actions={headerActions}
      />

      {screenTabs}

      <CentralDataNotice
        isLoading={isLoading}
        error={error}
        isEmpty={items.length === 0}
        emptyMessage="아직 올라온 물품·재고 자료가 없습니다."
      />

      {items.length > 0 && (
        <>
          {/* ── OVERVIEW — 무엇이 모자란가 · 유통기한은 어떤가 ── */}
          <OverviewSection label="재고 요약">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <VizCard title="재고가 적은 품목" question="어떤 물품이 가장 모자란가?" delay={40}>
                {/* 막대가 무엇을 뜻하는지 한 줄로 못 박는다 — 짧은 막대가 곧 문제라는 뜻이다. */}
                <p className="mb-3 text-[11.5px] text-[#98A2B3]">
                  막대는 화성시 전체에 남은 수량 · 적은 순
                </p>
                <RankBars
                  accent={HS.danger}
                  items={scarcestItems.map((item) => ({
                    key: item.name,
                    label: item.name,
                    value: item.stock,
                    valueText: `${formatNumber(item.stock)}개`,
                    onSelect: () => drillTo({ keyword: item.name }),
                  }))}
                />
              </VizCard>

              <VizCard title="유통기한 분포" question="언제까지 쓸 수 있는 재고인가?" delay={90}>
                <div>
                  {/* 카드가 답하는 결론을 먼저 숫자로 못 박고, 그 아래에 구성을 보여준다. */}
                  <p className="flex items-baseline gap-2">
                    <span
                      className="text-[34px] font-bold leading-none tabular-nums"
                      style={{
                        color:
                          expiryBuckets.over + expiryBuckets.d7 + expiryBuckets.d30 > 0
                            ? HS.orange
                            : HS.success,
                      }}
                    >
                      {expiryBuckets.over + expiryBuckets.d7 + expiryBuckets.d30}건
                    </span>
                    <span className="text-[12.5px] text-[#667085]">
                      30일 안에 유통기한이 도래합니다
                    </span>
                  </p>

                  <div className="mt-5">
                  <SegmentBar
                    segments={[
                      {
                        key: 'over',
                        label: '기한 초과',
                        value: expiryBuckets.over,
                        color: HS.danger,
                        onSelect: () => drillTo({ expiry: 'over' }),
                      },
                      {
                        key: 'd7',
                        label: '7일 이내',
                        value: expiryBuckets.d7,
                        color: HS.orange,
                        onSelect: () => drillTo({ expiry: '7' }),
                      },
                      {
                        key: 'd30',
                        label: '30일 이내',
                        value: expiryBuckets.d30,
                        color: '#F3C177',
                        onSelect: () => drillTo({ expiry: '30' }),
                      },
                      { key: 'safe', label: '30일 이상', value: expiryBuckets.safe, color: HS.blueTint },
                      { key: 'unknown', label: '기한 미상', value: expiryBuckets.unknown, color: '#CBD5E1' },
                    ]}
                  />
                  </div>
                  <p className="mt-5 border-t border-[#EFF3F8] pt-4 text-[12px] text-[#667085]">
                    폐기 예정{' '}
                    <button
                      type="button"
                      onClick={() => disposalCount > 0 && drillTo({ quick: 'disposal' })}
                      disabled={disposalCount === 0}
                      className="font-semibold tabular-nums text-[#182230] underline-offset-2 hover:underline disabled:no-underline"
                    >
                      {disposalCount}건
                    </button>{' '}
                    <span className="text-[#98A2B3]">· 3주 안에 기한이 지나고 10개 이상 남은 품목</span>
                  </p>
                </div>
              </VizCard>
            </div>
          </OverviewSection>

          {/* ── ACTION — 지금 조치할 재고 ── */}
          <PriorityActions
            items={priorityItems}
            counts={{ shortage: shortageCount, expiring: expiringCount, anomaly: anomalyCount }}
            onDrill={drillTo}
            onOpenItem={setDrawerItem}
          />

          {/* ── DETAIL — 전체 재고표. 눌렀을 때만 나온다 ── */}
          <DetailSection label="전체 재고">
            <button
              type="button"
              onClick={() => setDetailOpen((v) => !v)}
              aria-expanded={detailOpen}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-[#DFE7EF] bg-white px-4 py-3 text-left transition-colors hover:bg-[#F7FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              <span className="text-[14px] font-semibold text-[#182230]">
                전체 재고 {formatNumber(items.length)}건 보기
                <span className="ml-2 text-[12.5px] font-normal text-[#667085]">
                  검색 · 상태·유통기한 필터 · 정렬 · 일괄 처리
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-[#667085] transition-transform ${detailOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {detailOpen && (
              <div className="mt-4 space-y-4">
                {/* ── 필터 바 ─────────────────────────────────────────────── */}
                <div className={`space-y-3 ${CARD_CLASS} px-4 py-3.5`}>
                  <div className="flex flex-wrap gap-2">
                    <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-[#DFE7EF] px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-[#004696]">
                      <Search size={15} className="shrink-0 text-slate-400" />
                      <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="품목명 · 읍면동 검색"
                        className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                      />
                      {keyword && (
                        <button onClick={() => setKeyword('')} className="shrink-0 text-slate-400 hover:text-slate-600">
                          <X size={13} />
                        </button>
                      )}
                    </label>
                    <select
                      aria-label="기관 선택"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="rounded-lg border border-[#DFE7EF] px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#004696]"
                    >
                      {regions.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11.5px] text-[#8A96A8]">상태</span>
                    {STATUS_TABS.map((t) => (
                      <FilterChip key={t.value} label={t.label} active={statusFilter === t.value} onClick={() => setStatusFilter(t.value)} />
                    ))}
                    <span className="mx-1 h-3 w-px bg-[#DFE7EF]" />
                    <span className="text-[11.5px] text-[#8A96A8]">유통기한</span>
                    {EXPIRY_TABS.map((t) => (
                      <FilterChip key={t.value} label={t.label} active={expiryFilter === t.value} onClick={() => setExpiryFilter(t.value)} />
                    ))}
                    <span className="mx-1 h-3 w-px bg-[#DFE7EF]" />
                    <FilterChip
                      label={`폐기 예정 ${disposalCount}`}
                      active={quickFilter === 'disposal'}
                      onClick={() => handleQuickFilter('disposal')}
                    />
                    {quickFilter && quickFilter !== 'disposal' && (
                      <button
                        onClick={() => setQuickFilter(null)}
                        className="ml-1 flex items-center gap-1 rounded-full bg-[#EAF3FC] px-2.5 py-1 text-[12px] font-medium text-[#004696] hover:bg-[#D9EAF9]"
                      >
                        <X size={10} />빠른필터 해제
                      </button>
                    )}
                  </div>
                </div>

                {/* ── 건수 + 일괄 처리 ──────────────────────────────────────── */}
                {/*
                  합계는 `trustedStock`(이상 품목 제외)만 더한다. 대시보드 '전체 재고 수량' KPI 와
                  같은 기준이라 두 화면의 숫자가 어긋나지 않는다. 제외된 건수는 옆에 함께 밝힌다.
                */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13px] text-[#667085]">
                    총 <span className="font-semibold text-[#182230]">{formatNumber(filteredItems.length)}</span>건 · 현재 재고{' '}
                    {formatNumber(
                      filteredItems.reduce(
                        (sum, item) => sum + (item.trustedStock === null ? 0 : item.trustedStock - item.fieldOutboundQuantity),
                        0,
                      ),
                    )}개
                    {unverifiedCount > 0 && (
                      <span className="ml-1 text-[#B4530F]">
                        · 확인 필요 {formatNumber(unverifiedCount)}건은 합계에서 제외
                      </span>
                    )}
                    {filteredItems.some((item) => item.fieldOutboundQuantity > 0) && (
                      <span className="ml-1 text-[#004696]">
                        · 현장 출고{' '}
                        {formatNumber(filteredItems.reduce((sum, item) => sum + item.fieldOutboundQuantity, 0))}개 반영
                      </span>
                    )}
                    {selectedIds.size > 0 && <span className="ml-2 text-[#004696]">· {selectedIds.size}건 선택됨</span>}
                  </p>
                  {selectedIds.size > 0 && (
                    <div className="flex items-center gap-2">
                      <ActionBtn icon={Truck}      label="출고 등록" />
                      <ActionBtn icon={Trash2}     label="폐기 처리" danger />
                      <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600">
                        선택 해제
                      </button>
                    </div>
                  )}
                </div>

                {/* ── 재고 테이블 ──────────────────────────────────────────── */}
                <div className={`overflow-hidden ${CARD_CLASS}`}>
                  {filteredItems.length === 0 ? (
                    <div className="py-16 text-center text-sm text-slate-400">조건에 맞는 물품이 없습니다.</div>
                  ) : (
                    <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
                      <table className="min-w-full divide-y divide-slate-100 text-sm">
                        <thead className="sticky top-0 z-10 bg-[#F7FAFD]">
                          <tr>
                            <th className="w-10 px-4 py-3">
                              <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleSelectAll} />
                            </th>
                            <SortTh label="상태"    col="status"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortTh label="품목명"  col="name"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th className="whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-medium text-[#8A96A8]">기관</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right text-[11.5px] font-medium text-[#8A96A8]">입고</th>
                            <th className="whitespace-nowrap px-4 py-3 text-right text-[11.5px] font-medium text-[#8A96A8]">출고</th>
                            <SortTh label="현재재고" col="currentStock" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <SortTh label="유통기한" col="expiryDate"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                            <th className="whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-medium text-[#8A96A8]">D-day</th>
                            <th className="whitespace-nowrap px-4 py-3 text-left text-[11.5px] font-medium text-[#8A96A8]">조치</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {filteredItems.map((item) => {
                            const days = item.daysToExpiration;
                            const action = STATUS_ACTIONS[item.status];
                            const isSelected = selectedIds.has(item.id);

                            return (
                              <tr
                                key={item.id}
                                className={`cursor-pointer transition-colors hover:bg-[#F7FAFD] ${isSelected ? 'bg-[#EAF3FC]/60' : ''}`}
                              >
                                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelect(item.id)}
                                    className="h-4 w-4 cursor-pointer rounded border-slate-300 text-[#004696] focus:ring-[#004696]"
                                  />
                                </td>
                                <td className="px-4 py-3" onClick={() => setDrawerItem(item)}>
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[item.status] ?? 'bg-slate-400'}`} />
                                    <StatusBadge status={item.status} />
                                  </div>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800" onClick={() => setDrawerItem(item)}>{item.itemName}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-slate-600" onClick={() => setDrawerItem(item)}>
                                  {item.organizationName}
                                  <span className="ml-2 text-xs text-slate-400">{item.districtName}</span>
                                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-px text-[10px] font-medium text-slate-500">
                                    {DATA_SOURCE_LABEL[item.dataSource]}
                                  </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-emerald-600" onClick={() => setDrawerItem(item)}>+{formatNumber(item.inboundQuantity)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-sky-600" onClick={() => setDrawerItem(item)}>−{formatNumber(item.outboundQuantity)}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold" onClick={() => setDrawerItem(item)}>
                                  <span className={
                                    item.displayStock === null ? 'text-amber-600' :
                                    item.displayStock <= 0     ? 'text-rose-700' :
                                    item.displayStock <= 10    ? 'text-rose-600' :
                                    item.displayStock <= 20    ? 'text-amber-600' :
                                                                 'text-slate-800'
                                  }>
                                    {formatStock(item.displayStock)}
                                  </span>
                                  {item.fieldOutboundQuantity > 0 && (
                                    <span className="ml-1 text-[10px] font-normal text-[#004696]">현장 −{formatNumber(item.fieldOutboundQuantity)}</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-slate-500" onClick={() => setDrawerItem(item)}>
                                  {item.expirationDate ? formatDate(item.expirationDate) : '—'}
                                </td>
                                <td className={`whitespace-nowrap px-4 py-3 ${days === null ? 'text-slate-300' : dDayClass(days)}`} onClick={() => setDrawerItem(item)}>
                                  {days === null ? '—' : formatDDay(days)}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3 text-xs" onClick={() => setDrawerItem(item)}>
                                  {action
                                    ? <span className={action.className}>{action.label}</span>
                                    : <span className="text-slate-200">—</span>
                                  }
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DetailSection>

          <SourceNote>
            출처: 읍면동 제출 Excel · 재고 계산·이상 판정은 중앙 DB(v_inventory_status) 기준이며 화면에서 다시
            계산하지 않습니다.
          </SourceNote>

          {/* ── 품목 상세 드로어 ─────────────────────────────────────────────── */}
          {drawerItem && (
            <>
              <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setDrawerItem(null)} />
              <ItemDetailDrawer item={drawerItem} allItems={items} onClose={() => setDrawerItem(null)} />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── 지금 조치할 재고 ────────────────────────────────────────────────────────

const PRIORITY_TONE: Record<string, ActionTone> = {
  '부족': 'danger',
  '임박': 'warning',
  '확인 필요': 'neutral',
};

/**
 * 지금 조치할 재고.
 *
 * 표에서 눈으로 찾아야 했던 세 가지(재고가 0인 품목 / 기한이 임박한 품목 /
 * 재고 근거가 맞지 않는 품목)를 한 줄씩 꺼내 놓는다. 누르면 그 품목 상세가 열리고,
 * 오른쪽 링크는 같은 조건으로 전체 표를 연다.
 */
function PriorityActions({
  items,
  counts,
  onDrill,
  onOpenItem,
}: {
  items: Row[];
  counts: { shortage: number; expiring: number; anomaly: number };
  onDrill: (next: { status?: string; quick?: QuickFilter }) => void;
  onOpenItem: (item: Row) => void;
}) {
  const LIMIT = 5;
  const shown = items.slice(0, LIMIT);

  return (
    <ActionSection
      title="지금 조치할 재고"
      aside={
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px]">
          <CountLink label="부족" count={counts.shortage} color={HS.danger} onClick={() => onDrill({ status: '부족' })} />
          <span aria-hidden className="h-3 w-px bg-[#DFE7EF]" />
          <CountLink label="유통기한 임박" count={counts.expiring} color={HS.orange} onClick={() => onDrill({ status: '임박' })} />
          <span aria-hidden className="h-3 w-px bg-[#DFE7EF]" />
          <CountLink label="근거 확인" count={counts.anomaly} color={HS.textSub} onClick={() => onDrill({ status: '확인 필요' })} />
        </div>
      }
    >
      <div>
        {shown.length === 0 ? (
          <AllClear message="지금 조치가 필요한 재고가 없습니다." />
        ) : (
          <div className="space-y-2">
            {shown.map((item, i) => {
              const days = item.daysToExpiration;
              const reason =
                item.status === '부족'
                  ? `현재 재고 ${formatStock(item.displayStock)}개 · 발주·확보 필요`
                  : item.status === '임박'
                    ? `유통기한 ${days === null ? '확인 필요' : formatDDay(days)} · ${formatStock(item.displayStock)}개 보유 · 우선 배부 검토`
                    : '재고 근거가 맞지 않아 합계에서 제외된 품목';
              return (
                <ActionRow
                  key={item.id}
                  index={i}
                  tone={PRIORITY_TONE[item.status] ?? 'neutral'}
                  tag={item.status}
                  title={item.itemName}
                  detail={`${reason} · ${item.organizationName}`}
                  meta={item.districtName}
                  cta="재고 보기"
                  onClick={() => onOpenItem(item)}
                />
              );
            })}
          </div>
        )}
        {items.length > LIMIT && (
          <p className="mt-3 text-[12px] text-[#8A96A8]">
            같은 조건의 품목이 {items.length - LIMIT}건 더 있습니다. 아래 전체 재고표에서 상태 필터로 확인하세요.
          </p>
        )}
      </div>
    </ActionSection>
  );
}

function CountLink({
  label,
  count,
  color,
  onClick,
}: {
  label: string;
  count: number;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={count > 0 ? onClick : undefined}
      disabled={count === 0}
      className="rounded-md px-1 text-[#667085] transition-colors hover:text-[#182230] disabled:cursor-default disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
    >
      {label}{' '}
      <strong className="text-[15px] font-bold tabular-nums" style={{ color: count > 0 ? color : '#98A2B3' }}>
        {count}
      </strong>
    </button>
  );
}
