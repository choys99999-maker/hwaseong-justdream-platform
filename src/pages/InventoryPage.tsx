import { useEffect, useMemo, useRef, useState } from 'react';
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
import { mockInventoryItems } from '../data/mockInventory';
import { formatDate, formatNumber } from '../utils/format';
import type { InventoryItem } from '../types';

// ─── 상수 ──────────────────────────────────────────────────────────────────

const TODAY = new Date('2026-08-07');

const CATEGORIES = ['전체', '식품', '위생용품', '생필품', '영유아용품', '기타'] as const;

const REGIONS = ['전체', ...Array.from(new Set(mockInventoryItems.map((i) => i.regionName)))];

const STATUS_TABS = [
  { value: 'all',    label: '전체'     },
  { value: '정상',   label: '정상'     },
  { value: '임박',   label: '임박'     },
  { value: '부족',   label: '부족'     },
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
  '확인 필요': 'bg-rose-400',
};

const ALERT_STYLES = {
  rose:  { inactive: 'bg-white border-rose-100 hover:bg-rose-50 hover:border-rose-200',   active: 'bg-rose-50 border-rose-400 ring-1 ring-inset ring-rose-400',   count: 'text-rose-700'  },
  amber: { inactive: 'bg-white border-amber-100 hover:bg-amber-50 hover:border-amber-200', active: 'bg-amber-50 border-amber-400 ring-1 ring-inset ring-amber-400', count: 'text-amber-700' },
  sky:   { inactive: 'bg-white border-sky-100 hover:bg-sky-50 hover:border-sky-200',       active: 'bg-sky-50 border-sky-400 ring-1 ring-inset ring-sky-400',       count: 'text-sky-700'   },
  slate: { inactive: 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-300', active: 'bg-slate-100 border-slate-400 ring-1 ring-inset ring-slate-400', count: 'text-slate-700' },
} as const;

// ─── 유틸리티 ──────────────────────────────────────────────────────────────

function daysUntilExpiry(expiryDate: string): number {
  return Math.ceil((new Date(expiryDate).getTime() - TODAY.getTime()) / 86_400_000);
}

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

function isSurplus(item: InventoryItem): boolean {
  return item.outboundQuantity > 0 && item.currentStock / item.outboundQuantity >= 0.5 && item.currentStock > 20;
}

function isDisposalRisk(item: InventoryItem): boolean {
  const d = daysUntilExpiry(item.expiryDate);
  return d >= 0 && d <= 21 && item.currentStock >= 10;
}

function computeAiRecommendation(item: InventoryItem, all: InventoryItem[]): string | null {
  const days = daysUntilExpiry(item.expiryDate);

  if (item.status === '부족') {
    const src = all.find((o) => o.id !== item.id && o.name === item.name && o.currentStock > 20 && o.status !== '부족');
    if (src) {
      const qty = Math.min(Math.floor((src.currentStock - 10) / 2), 20);
      return `${src.regionName} → ${item.regionName} ${qty}개 이동 추천`;
    }
    return '긴급 발주 필요';
  }

  if (item.status === '임박' && days <= 14) {
    return `${days}일 내 우선 출고 권장`;
  }

  if (isSurplus(item)) {
    const target = all.find((o) => o.id !== item.id && o.name === item.name && o.status === '부족');
    if (target) {
      const qty = Math.min(Math.floor(item.currentStock * 0.4), 20);
      return `→ ${target.regionName} ${qty}개 재배분 추천`;
    }
  }

  return null;
}

function weeklyStockTrend(item: InventoryItem): number[] {
  return Array.from({ length: 7 }, (_, i) =>
    Math.max(0, Math.round(item.baseStock + (item.currentStock - item.baseStock) * (i / 6))),
  );
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
  item: InventoryItem; allItems: InventoryItem[]; onClose: () => void;
}) {
  const days     = daysUntilExpiry(item.expiryDate);
  const ai       = computeAiRecommendation(item, allItems);
  const trend    = weeklyStockTrend(item);
  const trendMax = Math.max(...trend, 1);
  const sameItems = allItems.filter((o) => o.name === item.name);
  const maxFlow  = Math.max(item.baseStock, item.inboundQuantity, item.outboundQuantity, item.discardQuantity, Math.abs(item.currentStock), 1);

  return (
    <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl">
      {/* 헤더 */}
      <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{item.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="text-xs text-slate-400">{item.category}</span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs text-slate-500">{item.regionName}</span>
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
          <SectionLabel>재고 흐름 (이번 주)</SectionLabel>
          <FlowRow label="기초재고" value={item.baseStock}        sign=""  max={maxFlow} barColor="bg-slate-300"   textColor="text-slate-600" />
          <FlowRow label="입고"     value={item.inboundQuantity}  sign="+" max={maxFlow} barColor="bg-emerald-500" textColor="text-emerald-700" />
          <FlowRow label="출고"     value={item.outboundQuantity} sign="−" max={maxFlow} barColor="bg-sky-500"     textColor="text-sky-700" />
          {item.discardQuantity > 0 && (
            <FlowRow label="폐기" value={item.discardQuantity} sign="−" max={maxFlow} barColor="bg-rose-400" textColor="text-rose-600" />
          )}
          <div className="border-t border-slate-100 pt-2">
            <FlowRow label="현재재고" value={item.currentStock} sign="=" max={maxFlow} barColor="bg-teal-500" textColor="text-teal-700" bold />
          </div>
        </section>

        {/* 유통기한 */}
        <section className="space-y-2">
          <SectionLabel>유통기한</SectionLabel>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-800">{formatDate(item.expiryDate)}</p>
              <p className="mt-0.5 text-xs text-slate-400">유통기한</p>
            </div>
            <p className={`text-xl font-bold ${dDayClass(days)}`}>{formatDDay(days)}</p>
          </div>
        </section>

        {/* 주간 재고 추이 */}
        <section className="space-y-2">
          <SectionLabel>주간 재고 추이 (6주)</SectionLabel>
          <div className="flex items-end gap-1 pt-1" style={{ height: 64 }}>
            {trend.map((v, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-sm ${i === 6 ? 'bg-teal-500' : 'bg-slate-200'}`}
                  style={{ height: `${Math.max(3, Math.round((v / trendMax) * 48))}px` }}
                />
                {(i === 0 || i === 6) && (
                  <span className={`text-[9px] leading-none ${i === 6 ? 'text-teal-600' : 'text-slate-400'}`}>
                    {i === 0 ? '6주전' : '현재'}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>최저 {formatNumber(Math.min(...trend))}개</span>
            <span>최고 {formatNumber(Math.max(...trend))}개</span>
          </div>
        </section>

        {/* 기관별 보유현황 */}
        {sameItems.length > 1 && (
          <section className="space-y-2">
            <SectionLabel>{`기관별 보유현황 · ${item.name}`}</SectionLabel>
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
                      {o.regionName}
                    </span>
                    {o.id === item.id && (
                      <span className="rounded bg-teal-100 px-1 py-0.5 text-[10px] font-medium text-teal-700">현재</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-800">{formatNumber(o.currentStock)}개</span>
                    <StatusBadge status={o.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* AI 추천 */}
        {ai && (
          <section className="space-y-2">
            <SectionLabel>AI 추천</SectionLabel>
            <div className="flex items-start gap-2.5 rounded-lg bg-teal-50 px-4 py-3">
              <Zap size={15} className="mt-0.5 shrink-0 text-teal-600" />
              <p className="text-sm leading-relaxed text-teal-800">{ai}</p>
            </div>
          </section>
        )}
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <Truck size={15} />출고 등록
        </button>
        <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500">
          <ArrowRight size={15} />재배분 요청
        </button>
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
  const [category,     setCategory]     = useState('전체');
  const [region,       setRegion]       = useState('전체');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expiryFilter, setExpiryFilter] = useState('all');
  const [quickFilter,  setQuickFilter]  = useState<QuickFilter>(null);
  const [sortKey,      setSortKey]      = useState<SortKey>('expiryDate');
  const [sortDir,      setSortDir]      = useState<SortDir>('asc');
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [drawerItem,   setDrawerItem]   = useState<InventoryItem | null>(null);

  // ESC 로 드로어 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawerItem(null); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // 알림 카드 집계
  const shortageCount = useMemo(() => mockInventoryItems.filter((i) => i.status === '부족').length, []);
  const expiringCount = useMemo(() => mockInventoryItems.filter((i) => i.status === '임박').length, []);
  const surplusCount  = useMemo(() => mockInventoryItems.filter(isSurplus).length, []);
  const disposalCount = useMemo(() => mockInventoryItems.filter(isDisposalRisk).length, []);

  // 필터 + 정렬
  const filteredItems = useMemo(() => {
    const kw = keyword.trim();
    let items = mockInventoryItems.filter((item) => {
      if (kw && !item.name.includes(kw)) return false;
      if (category !== '전체' && item.category !== category) return false;
      if (region  !== '전체' && item.regionName !== region)  return false;
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (expiryFilter !== 'all') {
        const d = daysUntilExpiry(item.expiryDate);
        if (expiryFilter === '7'    && d > 7)  return false;
        if (expiryFilter === '30'   && d > 30) return false;
        if (expiryFilter === 'over' && d >= 0) return false;
      }
      if (quickFilter === 'shortage' && item.status !== '부족') return false;
      if (quickFilter === 'expiring' && item.status !== '임박') return false;
      if (quickFilter === 'surplus'  && !isSurplus(item))        return false;
      if (quickFilter === 'disposal' && !isDisposalRisk(item))  return false;
      return true;
    });

    const STATUS_ORDER: Record<string, number> = { '부족': 0, '임박': 1, '확인 필요': 2, '정상': 3 };
    items = items.sort((a, b) => {
      let cmp = 0;
      if      (sortKey === 'name')         cmp = a.name.localeCompare(b.name, 'ko');
      else if (sortKey === 'currentStock') cmp = a.currentStock - b.currentStock;
      else if (sortKey === 'expiryDate')   cmp = a.expiryDate.localeCompare(b.expiryDate);
      else if (sortKey === 'status')       cmp = (STATUS_ORDER[a.status] ?? 4) - (STATUS_ORDER[b.status] ?? 4);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return items;
  }, [keyword, category, region, statusFilter, expiryFilter, quickFilter, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="물품·재고 관리"
        description="입고·출고·유통기한·재고 현황을 통합 관리합니다."
      />

      {/* ── 조치 필요 요약 카드 ──────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-400">🚨 조치 필요</p>
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
              placeholder="품목명 검색"
              className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
            {keyword && (
              <button onClick={() => setKeyword('')} className="shrink-0 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select value={region} onChange={(e) => setRegion(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500">
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
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
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          총 <span className="font-semibold text-slate-800">{filteredItems.length}</span>건
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
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">분류</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">기관</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500">기초재고</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500">입고</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500">출고</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right text-xs font-medium text-slate-500">폐기</th>
                  <SortTh label="현재재고" col="currentStock" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="유통기한" col="expiryDate"   sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">D-day</th>
                  <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-slate-500">AI 추천</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredItems.map((item) => {
                  const days      = daysUntilExpiry(item.expiryDate);
                  const ai        = computeAiRecommendation(item, mockInventoryItems);
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
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800" onClick={() => setDrawerItem(item)}>{item.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500" onClick={() => setDrawerItem(item)}>{item.category}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600" onClick={() => setDrawerItem(item)}>{item.regionName}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-slate-400" onClick={() => setDrawerItem(item)}>{formatNumber(item.baseStock)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-emerald-600" onClick={() => setDrawerItem(item)}>+{formatNumber(item.inboundQuantity)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-sky-600" onClick={() => setDrawerItem(item)}>−{formatNumber(item.outboundQuantity)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-rose-500" onClick={() => setDrawerItem(item)}>
                        {item.discardQuantity > 0 ? `−${formatNumber(item.discardQuantity)}` : <span className="text-slate-200">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold" onClick={() => setDrawerItem(item)}>
                        <span className={
                          item.currentStock <= 0  ? 'text-rose-700' :
                          item.currentStock <= 10 ? 'text-rose-600' :
                          item.currentStock <= 20 ? 'text-amber-600' :
                                                    'text-slate-800'
                        }>
                          {formatNumber(item.currentStock)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500" onClick={() => setDrawerItem(item)}>{formatDate(item.expiryDate)}</td>
                      <td className={`whitespace-nowrap px-4 py-3 ${dDayClass(days)}`} onClick={() => setDrawerItem(item)}>{formatDDay(days)}</td>
                      <td className="px-4 py-3" onClick={() => setDrawerItem(item)}>
                        {ai
                          ? <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20"><Zap size={10} />AI</span>
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
          <ItemDetailDrawer item={drawerItem} allItems={mockInventoryItems} onClose={() => setDrawerItem(null)} />
        </>
      )}
    </div>
  );
}
