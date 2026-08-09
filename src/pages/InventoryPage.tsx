import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Search,
  Trash2,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '../components/common/PageHeader';
import StatusBadge from '../components/common/StatusBadge';
import CentralDataNotice from '../components/common/CentralDataNotice';
import { useCentralData } from '../hooks/useCentralData';
import { listInventoryStatus, type InventoryStatus as InventoryRow } from '../store/analytics';
import { districtOfArea } from '../data/districtByArea';
import { REGION_NAMES } from '../data/regionMeta';
import { inventoryStatusOf } from '../utils/inventoryStatus';
import { getOutboundSnapshot, outboundByOrgItem, subscribeOutbound } from '../store/outboundLedger';
import { formatDate, formatNumber, formatStock } from '../utils/format';
import type { InventoryStatus } from '../types';

// ─── 상수 ──────────────────────────────────────────────────────────────────

const STATUS_TABS = [
  { value: 'all',    label: '전체'     },
  { value: '정상',   label: '정상'     },
  { value: '부족',   label: '부족'     },
  { value: '과잉',   label: '과잉'     },
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
  '과잉':    'bg-sky-500',
  '확인 필요': 'bg-slate-400',
};

/** 상태별 권장 조치. 행이 상태 표시에서 끝나지 않고 다음 행동으로 이어지게 한다. */
const STATUS_ACTIONS: Record<string, { label: string; className: string } | undefined> = {
  '부족':    { label: '재배분 제안 확인',    className: 'text-rose-600 font-medium' },
  '임박':    { label: '우선 소진·이동 검토', className: 'text-amber-600 font-medium' },
  '과잉':    { label: '재배분 가능',         className: 'text-sky-600 font-medium' },
  '확인 필요': { label: '데이터 확인 필요',   className: 'text-slate-500' },
};

const ALERT_STYLES = {
  rose:  { inactive: 'bg-white border-rose-100 hover:bg-rose-50 hover:border-rose-200',   active: 'bg-rose-50 border-rose-400 ring-1 ring-inset ring-rose-400',   count: 'text-rose-700'  },
  amber: { inactive: 'bg-white border-amber-100 hover:bg-amber-50 hover:border-amber-200', active: 'bg-amber-50 border-amber-400 ring-1 ring-inset ring-amber-400', count: 'text-amber-700' },
  sky:   { inactive: 'bg-white border-sky-100 hover:bg-sky-50 hover:border-sky-200',       active: 'bg-sky-50 border-sky-400 ring-1 ring-inset ring-sky-400',       count: 'text-sky-700'   },
  slate: { inactive: 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300', active: 'bg-slate-100 border-slate-400 ring-1 ring-inset ring-slate-400', count: 'text-slate-700' },
} as const;

/** 화면이 쓰는 한 줄. 상태·소속 구는 중앙 DB 값에서 계산한다. */
interface Row extends InventoryRow {
  id: string;
  status: InventoryStatus;
  districtName: string;
  /** 이용·상담 물품지원에서 발생한 현장 출고 합 (세션 출고 원장 기준) */
  fieldOutboundQuantity: number;
  /** 표시 재고 = 중앙 DB stock − 현장 출고. DB 값 자체는 바꾸지 않는다. */
  displayStock: number | null;
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

/**
 * 예상 소진 시점. 기간 배부량을 주 1회 제출 주기 기준의 주간 배부 속도로 보고
 * 현재 표시 재고를 나눈 단순 추정이다. 근거 없는 정밀도를 피하려고 일 단위 상한을 둔다.
 */
function depletionLabel(item: Row): { text: string; className: string } {
  if (item.displayStock === null) return { text: '—', className: 'text-slate-300' };
  if (item.displayStock <= 0) return { text: '소진됨', className: 'text-rose-600 font-medium' };
  if (item.outboundQuantity <= 0) return { text: '—', className: 'text-slate-300' };
  const days = Math.ceil(item.displayStock / (item.outboundQuantity / 7));
  if (days > 60) return { text: '60일 이상', className: 'text-slate-400' };
  if (days <= 7) return { text: `약 ${days}일`, className: 'text-rose-600 font-medium' };
  if (days <= 14) return { text: `약 ${days}일`, className: 'text-amber-600' };
  return { text: `약 ${days}일`, className: 'text-slate-500' };
}

// 과잉·폐기·추천 휴리스틱은 화면 표시 재고(displayStock = DB stock − 현장 출고)를 쓴다.
// 상태 라벨('부족' 등) 판정 자체는 계속 중앙 DB 가 한다.
function isSurplus(item: Row): boolean {
  return (
    item.outboundQuantity > 0 &&
    item.displayStock !== null &&
    item.displayStock > 20 &&
    item.displayStock / item.outboundQuantity >= 0.5
  );
}

function isDisposalRisk(item: Row): boolean {
  const d = item.daysToExpiration;
  return d !== null && d >= 0 && d <= 21 && (item.displayStock ?? 0) >= 10;
}

/** 상태에 따른 조치 제안 문구. 값은 화면에 보이는 재고에서만 계산한다. */
function computeActionSuggestion(item: Row, all: Row[]): string | null {
  if (item.status === '부족') {
    const src = all.find(
      (o) => o.id !== item.id && o.itemName === item.itemName && (o.displayStock ?? 0) > 20 && o.status !== '부족',
    );
    if (src) {
      const qty = Math.min(Math.floor(((src.displayStock ?? 0) - 10) / 2), 20);
      return `${src.organizationName} → ${item.organizationName} ${qty}개 이동 검토`;
    }
    return '동일 품목 여유 기관 없음 · 신규 확보 검토';
  }

  if (item.status === '임박' && item.daysToExpiration !== null && item.daysToExpiration <= 14) {
    return `${item.daysToExpiration}일 내 우선 배부 권장`;
  }

  if (item.status === '과잉') {
    const target = all.find((o) => o.id !== item.id && o.itemName === item.itemName && o.status === '부족');
    if (target) {
      const qty = Math.min(Math.floor((item.displayStock ?? 0) * 0.4), 20);
      return `${target.organizationName}(으)로 ${qty}개 재배분 검토`;
    }
    return '부족 기관 발생 시 재배분 여력 보유';
  }

  return null;
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
      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
    />
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

function ActionBtn({ icon: Icon, label, danger = false }: { icon: LucideIcon; label: string; danger?: boolean }) {
  return (
    <button
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
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
      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500 hover:text-slate-800"
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={11} className="text-slate-300" />}
      </span>
    </th>
  );
}

// ─── AlertCard ──────────────────────────────────────────────────────────────

function AlertCard({
  label, count, sublabel, color, active, onClick,
}: {
  label: string; count: number; sublabel: string;
  color: keyof typeof ALERT_STYLES; active: boolean; onClick: () => void;
}) {
  const s = ALERT_STYLES[color];
  return (
    <button
      onClick={count > 0 ? onClick : undefined}
      disabled={count === 0}
      className={`w-full rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
        count === 0 ? 'cursor-default border-slate-100 bg-white opacity-40' : active ? s.active : s.inactive
      }`}
    >
      <p className={`text-2xl font-bold ${count === 0 ? 'text-slate-400' : s.count}`}>{count}건</p>
      <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
      <p className="mt-0.5 text-xs text-slate-400">{sublabel}</p>
    </button>
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
  const suggestion = computeActionSuggestion(item, allItems);
  const depletion = depletionLabel(item);
  const sameItems = allItems.filter((o) => o.itemName === item.itemName);
  const maxFlow = Math.max(
    item.inboundQuantity,
    item.outboundQuantity,
    item.fieldOutboundQuantity,
    Math.abs(item.displayStock ?? 0),
    1,
  );

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{item.itemName}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-slate-500">{item.organizationName}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-400">{item.districtName}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
              <FlowRow label="현재재고" value={item.displayStock} sign="=" max={maxFlow} barColor="bg-teal-500" textColor="text-teal-700" bold />
            )}
          </div>
          {item.hasAnomaly && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
              중앙 DB 판정: 재고 근거가 맞지 않아 합계에서 제외된 품목입니다.
            </p>
          )}
        </section>

        {/* 유통기한 · 예상 소진 */}
        <section className="space-y-2">
          <SectionLabel>유통기한 · 예상 소진</SectionLabel>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">
                {item.expirationDate ? formatDate(item.expirationDate) : '—'}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">유통기한</p>
            </div>
            {days !== null && <p className={`text-xl font-bold ${dDayClass(days)}`}>{formatDDay(days)}</p>}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className={`text-sm font-medium ${depletion.className}`}>{depletion.text}</p>
              <p className="mt-0.5 text-xs text-slate-400">예상 소진 — 주간 배부 속도 기준 단순 추정</p>
            </div>
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
                    o.id === item.id ? 'bg-teal-50 ring-1 ring-inset ring-teal-200' : 'bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[o.status] ?? 'bg-slate-400'}`} />
                    <span className={o.id === item.id ? 'font-semibold text-teal-800' : 'text-slate-700'}>
                      {o.organizationName}
                    </span>
                    {o.id === item.id && (
                      <span className="rounded bg-teal-100 px-1 py-0.5 text-[10px] font-medium text-teal-700">현재</span>
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

        {/* 조치 제안 */}
        {suggestion && (
          <section className="space-y-2">
            <SectionLabel>조치 제안</SectionLabel>
            <div className="flex items-start gap-2.5 rounded-lg bg-teal-50 px-4 py-3">
              <Zap size={15} className="mt-0.5 shrink-0 text-teal-600" />
              <p className="text-sm leading-relaxed text-teal-800">{suggestion}</p>
            </div>
          </section>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <Truck size={15} />출고 등록
        </button>
        <Link
          to="/redistribution"
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowRight size={15} />재배분 검토
        </Link>
        <button className="flex items-center justify-center rounded-lg border border-rose-200 px-3.5 text-rose-600 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
          <Trash2 size={15} />
        </button>
      </div>
    </aside>
  );
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

type QuickFilter = 'shortage' | 'expiring' | 'surplus' | 'disposal' | null;

export default function InventoryPage() {
  const [keyword,      setKeyword]      = useState('');
  const [region,       setRegion]       = useState('전체');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [quickFilter,  setQuickFilter]  = useState<QuickFilter>(null);
  const [sortKey,      setSortKey]      = useState<SortKey>('expiryDate');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [drawerItem,   setDrawerItem]   = useState<Row | null>(null);

  // 입고/출고는 기간 합계, 현재재고·유통기한은 최신 제출본 기준.
  // 재제출분 제외·누계 시트 제외 규칙은 모두 v_inventory_status 안에 있다.
  const { data, error, isLoading } = useCentralData(() => listInventoryStatus(), []);

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
      };
      // '과잉'은 정상 품목 중 배부량 대비 재고 여유가 큰 것을 화면에서 파생한다.
      // 부족·임박·확인 필요 판정(중앙 DB)은 그대로 두고 덮어쓰지 않는다.
      if (built.status === '정상' && isSurplus(built)) built.status = '과잉';
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

  // 알림 카드 집계
  const shortageCount = useMemo(() => items.filter((i) => i.status === '부족').length, [items]);
  const expiringCount = useMemo(() => items.filter((i) => i.status === '임박').length, [items]);
  const surplusCount  = useMemo(() => items.filter((i) => i.status === '과잉').length, [items]);
  const disposalCount = useMemo(() => items.filter(isDisposalRisk).length, [items]);

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
      if (quickFilter === 'surplus'  && item.status !== '과잉') return false;
      if (quickFilter === 'disposal' && !isDisposalRisk(item))  return false;
      return true;
    });

    const STATUS_ORDER: Record<string, number> = { '부족': 0, '임박': 1, '확인 필요': 2, '과잉': 3, '정상': 4 };
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

  const allSelected  = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const notice = (
    <CentralDataNotice
      isLoading={isLoading}
      error={error}
      isEmpty={items.length === 0}
      emptyMessage="아직 올라온 물품·재고 자료가 없습니다."
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="물품·재고 관리"
        description="지역별 물품 입출고, 재고, 유통기한 현황을 통합 관리합니다. 중앙 저장소에 올라온 자료를 기준으로 집계합니다."
      />

      {notice}

      {items.length > 0 && (
        <>
          {/* ── 조치 필요 요약 카드 ──────────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-400">조치 필요</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <AlertCard label="부족 품목"    count={shortageCount} sublabel="즉시 발주 또는 재배분 필요" color="rose"  active={quickFilter === 'shortage'} onClick={() => handleQuickFilter('shortage')} />
              <AlertCard label="유통기한 임박" count={expiringCount} sublabel="우선 배분 처리 권장"         color="amber" active={quickFilter === 'expiring'} onClick={() => handleQuickFilter('expiring')} />
              <AlertCard label="과잉 재고"    count={surplusCount}  sublabel="재배분 검토 필요"             color="sky"   active={quickFilter === 'surplus'}  onClick={() => handleQuickFilter('surplus')} />
              <AlertCard label="폐기 예정"    count={disposalCount} sublabel="3주 내 유통기한 경과"         color="slate" active={quickFilter === 'disposal'} onClick={() => handleQuickFilter('disposal')} />
            </div>
          </div>

          {/* ── 필터 바 ─────────────────────────────────────────────────────── */}
          <div className="space-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <label className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-teal-500">
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
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {regions.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-slate-400">상태</span>
              {STATUS_TABS.map((t) => (
                <FilterChip key={t.value} label={t.label} active={statusFilter === t.value} onClick={() => setStatusFilter(t.value)} />
              ))}
              <span className="mx-1 h-3 w-px bg-slate-200" />
              <span className="text-xs text-slate-400">유통기한</span>
              {EXPIRY_TABS.map((t) => (
                <FilterChip key={t.value} label={t.label} active={expiryFilter === t.value} onClick={() => setExpiryFilter(t.value)} />
              ))}
              {quickFilter && (
                <button
                  onClick={() => setQuickFilter(null)}
                  className="ml-1 flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100"
                >
                  <X size={10} />빠른필터 해제
                </button>
              )}
            </div>
          </div>

          {/* ── 건수 + 일괄 처리 ──────────────────────────────────────────────── */}
          {/*
            합계는 `trustedStock`(이상 품목 제외)만 더한다. 대시보드 '전체 재고 수량' KPI 와
            같은 기준이라 두 화면의 숫자가 어긋나지 않는다. 제외된 건수는 옆에 함께 밝힌다.
          */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              총 <span className="font-semibold text-slate-800">{formatNumber(filteredItems.length)}</span>건 · 현재 재고{' '}
              {formatNumber(
                filteredItems.reduce(
                  (sum, item) => sum + (item.trustedStock === null ? 0 : item.trustedStock - item.fieldOutboundQuantity),
                  0,
                ),
              )}개
              {unverifiedCount > 0 && (
                <span className="ml-1 text-amber-600">
                  · 확인 필요 {formatNumber(unverifiedCount)}건은 합계에서 제외
                </span>
              )}
              {filteredItems.some((item) => item.fieldOutboundQuantity > 0) && (
                <span className="ml-1 text-teal-600">
                  · 현장 출고{' '}
                  {formatNumber(filteredItems.reduce((sum, item) => sum + item.fieldOutboundQuantity, 0))}개 반영
                </span>
              )}
              {selectedIds.size > 0 && <span className="ml-2 text-teal-600">· {selectedIds.size}건 선택됨</span>}
            </p>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <ActionBtn icon={Truck}      label="출고 등록" />
                <ActionBtn icon={ArrowRight} label="재배분 요청" />
                <ActionBtn icon={Trash2}     label="폐기 처리" danger />
                <button onClick={() => setSelectedIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600">
                  선택 해제
                </button>
              </div>
            )}
          </div>

          {/* ── 재고 테이블 ──────────────────────────────────────────────────── */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {filteredItems.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">조건에 맞는 물품이 없습니다.</div>
            ) : (
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 22rem)' }}>
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <IndeterminateCheckbox checked={allSelected} indeterminate={someSelected} onChange={toggleSelectAll} />
                      </th>
                      <SortTh label="상태"    col="status"       sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <SortTh label="품목명"  col="name"         sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">기관</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500">입고</th>
                      <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500">출고</th>
                      <SortTh label="현재재고" col="currentStock" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <th
                        className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500"
                        title="현재 재고 ÷ 주간 배부 속도(기간 출고량을 주 단위로 환산)의 단순 추정입니다."
                      >
                        예상 소진
                      </th>
                      <SortTh label="유통기한" col="expiryDate"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">D-day</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">조치</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredItems.map((item) => {
                      const days = item.daysToExpiration;
                      const action = STATUS_ACTIONS[item.status];
                      const depletion = depletionLabel(item);
                      const isSelected = selectedIds.has(item.id);

                      return (
                        <tr
                          key={item.id}
                          className={`cursor-pointer transition-colors hover:bg-slate-50 ${isSelected ? 'bg-teal-50/40' : ''}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(item.id)}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-teal-600 focus:ring-teal-500"
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
                              <span className="ml-1 text-[10px] font-normal text-teal-600">현장 −{formatNumber(item.fieldOutboundQuantity)}</span>
                            )}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 text-right ${depletion.className}`}
                            onClick={() => setDrawerItem(item)}
                            title="주간 배부 속도 기준 단순 추정"
                          >
                            {depletion.text}
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
