import { ArrowLeft, ArrowRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DistrictId, OperationSite } from '../../types';
import SiteStatusBadge from '../common/SiteStatusBadge';
import EmptyState from '../common/EmptyState';
import { REGION_NAMES } from '../../data/regionMeta';
import { citySummary, districtSummaryMap } from '../../data/operationSummary';
import {
  getActionItemsByDistrict,
  getActionItemsBySite,
  type ActionKind,
  type OperationActionItem,
} from '../../data/actionItems';
import { formatNumber } from '../../utils/format';
import { siteAreaOf, EXPIRING_THRESHOLD, mockSites } from '../../data/mockSites';
import type { KpiStatus } from './OperationKpiBar';

/** 우측 패널 기본 목록 길이. "최대 3~5개" 만 보여주고 나머지는 거점 관리에서 본다. */
const ACTION_LIST_LIMIT = 5;
/** 전체 목록으로 넘어갈 때 쓰는 상태 필터 — SiteOperationsPage 의 StatusFilter 값과 맞춘다. */
const ALL_ACTION_ITEMS_LINK = '/admin/sites?status=check';

/** KPI 선택(정상 제외)에 맞춰 확인 필요 목록을 좁힌다. */
function filterItemsByKpi(items: OperationActionItem[], statusFilter: KpiStatus): OperationActionItem[] {
  if (statusFilter === 'shortage') return items.filter((item) => item.kind === '부족');
  if (statusFilter === 'needsCheck') {
    return items.filter((item) => item.kind === '유통기한 임박' || item.kind === '자료 확인 필요');
  }
  return items;
}

interface OperationActionPanelProps {
  selectedDistrict: DistrictId | null;
  selectedSite: OperationSite | null;
  /** 지도 위 KPI 선택. 화성시 전체·구 요약 모드에서 목록을 그 상태 기준으로 좁힌다. */
  statusFilter: KpiStatus;
  onSelectDistrict: (district: DistrictId | null) => void;
  onClearSite: () => void;
}

/**
 * 부족·확인필요 거점 수는 아직 확정 자료가 없는 시연용 수치다.
 * 확정된 기관 수(거점 수 등)와 같은 묶음으로 보이지 않도록 지표 그룹 위에 출처를 밝힌다.
 */
function DemoMetricsLabel() {
  return (
    <p className="mt-4 flex items-center gap-1.5 text-[11px] text-slate-400">
      운영 지표
      <span className="rounded bg-amber-50 px-1.5 py-px text-[10px] font-medium text-amber-700 ring-1 ring-amber-600/20">
        시연 데이터
      </span>
    </p>
  );
}

function MetricTile({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="rounded-lg border border-[#F3DCC7]/70 bg-white p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">
        {formatNumber(value)}
        <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </dd>
    </div>
  );
}

/** Action Dock 왼쪽 상태 indicator 색. danger=부족, warning=유통기한 임박, information=자료 확인 필요. */
const KIND_INDICATOR: Record<ActionKind, string> = {
  '부족': '#E5484D',
  '유통기한 임박': '#F59E0B',
  '자료 확인 필요': '#004696',
};

const KIND_TEXT: Record<ActionKind, string> = {
  '부족': 'text-[#C0271F]',
  '유통기한 임박': 'text-[#A5620A]',
  '자료 확인 필요': 'text-[#475569]',
};

/** Action Dock 안에서 한 row = 한 divider 구분선. 개별 카드로 만들지 않는다(section 18). */
function ActionItemRow({ item, showSite = true }: { item: OperationActionItem; showSite?: boolean }) {
  return (
    <li
      className="flex gap-2.5 px-3 py-2.5 text-sm transition-colors duration-150 hover:translate-x-0.5 hover:bg-[#F8FAFC]"
      style={{ borderLeft: `3px solid ${KIND_INDICATOR[item.kind]}` }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 font-medium text-slate-800">
            {showSite && <span className="mr-1">{item.siteName}</span>}
            {item.summary}
          </p>
          <span className={`shrink-0 text-[11px] font-medium ${KIND_TEXT[item.kind]}`}>{item.kind}</span>
        </div>
        <p className="mt-1 flex items-center gap-1 text-xs text-[#004696]">
          <ArrowRight size={13} className="shrink-0" />
          {item.suggestion}
        </p>
        {showSite && <p className="mt-0.5 text-[11px] text-slate-400">{item.districtName}</p>}
      </div>
    </li>
  );
}

function ActionItemList({
  title,
  items,
  emptyMessage,
  linkTo,
  linkLabel = '이어서 확인',
  showSite = true,
}: {
  title: string;
  items: OperationActionItem[];
  emptyMessage: string;
  linkTo?: string;
  linkLabel?: string;
  showSite?: boolean;
}) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-[#182230]">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[rgba(20,50,80,0.06)] overflow-hidden rounded-[12px] border border-[rgba(20,50,80,0.06)]">
          {items.map((item) => (
            <ActionItemRow key={item.id} item={item} showSite={showSite} />
          ))}
        </ul>
      )}
      {linkTo && (
        <Link
          to={linkTo}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#004696] hover:text-[#073B74] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
        >
          {linkLabel}
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

/** KPI "정상" 선택 시 — 확인할 것이 없다는 것 자체가 답이므로 목록이 아니라 안심 메시지에 가깝게 보여준다. */
function NormalSitesList({ sites }: { sites: OperationSite[] }) {
  const visible = sites.slice(0, ACTION_LIST_LIMIT);
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-[#182230]">정상 운영 중인 거점</h4>
      {visible.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          정상 운영 중인 거점이 없습니다.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-[rgba(20,50,80,0.06)] overflow-hidden rounded-[12px] border border-[rgba(20,50,80,0.06)]">
          {visible.map((site) => (
            <li
              key={site.id}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors duration-150 hover:translate-x-0.5 hover:bg-[#F8FAFC]"
              style={{ borderLeft: '3px solid #16A36A' }}
            >
              <span className="min-w-0 truncate font-medium text-slate-800">{site.displayName}</span>
              <span className="shrink-0 text-xs text-slate-400">{REGION_NAMES[site.district]}</span>
            </li>
          ))}
        </ul>
      )}
      {sites.length > ACTION_LIST_LIMIT && (
        <p className="mt-2 text-xs text-slate-400">외 {sites.length - ACTION_LIST_LIMIT}곳 더 정상 운영 중입니다.</p>
      )}
    </div>
  );
}

function formatShortDate(iso: string): string {
  const parts = iso.split('T')[0].split('-');
  return `${parseInt(parts[1])}월 ${parseInt(parts[2])}일`;
}

const ACTION_KIND_STYLE: Record<ActionKind, string> = {
  '부족': 'bg-rose-50 text-rose-800',
  '유통기한 임박': 'bg-amber-50 text-amber-800',
  '자료 확인 필요': 'bg-slate-100 text-slate-700',
};

export default function OperationActionPanel({
  selectedDistrict,
  selectedSite,
  statusFilter,
  onSelectDistrict,
  onClearSite,
}: OperationActionPanelProps) {
  // C. 거점 상세 모드
  if (selectedSite) {
    const siteActions = getActionItemsBySite(selectedSite.id);
    const area = siteAreaOf(selectedSite.id);
    const programLabel =
      selectedSite.programTypes.includes('HWASEONG') && selectedSite.programTypes.includes('NATIONAL')
        ? '화성형·국가형 동시 운영'
        : selectedSite.programTypes.includes('NATIONAL')
          ? '국가형'
          : '화성형';

    return (
      <div className="flex h-full flex-col">
        {/* 뒤로가기 */}
        <button
          type="button"
          onClick={onClearSite}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#004696] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
        >
          <ArrowLeft size={16} />
          {selectedDistrict ? `${REGION_NAMES[selectedDistrict]} 요약으로 돌아가기` : '화성시 전체 요약으로 돌아가기'}
        </button>

        {/* A. Identity */}
        <div className="mt-3">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-base font-semibold leading-tight text-slate-900">{selectedSite.name}</h4>
            <SiteStatusBadge status={selectedSite.status} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {programLabel} · {selectedSite.facilityType}
          </p>
          <p className="text-xs text-slate-400">
            {REGION_NAMES[selectedSite.district]}
            {area ? ` · ${area}` : ''}
            {selectedSite.isDemo ? ' · 데모 거점' : ''}
          </p>
          {selectedSite.address && (
            <p className="mt-0.5 truncate text-xs text-slate-400" title={selectedSite.address}>
              {selectedSite.address}
            </p>
          )}
        </div>

        <hr className="mt-3 border-slate-100" />

        {/* B. 지금 확인할 사항 */}
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-slate-700">지금 확인할 사항</p>
          {siteActions.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg bg-[#EAF8F2] px-3 py-2.5 text-sm text-[#16A36A]">
              <span className="font-bold">✓</span>
              특이사항 없이 운영 중입니다.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {siteActions.map((item, idx) => (
                <li
                  key={item.id}
                  className={`rounded-lg px-3 py-2.5 text-sm ${idx === 0 ? ACTION_KIND_STYLE[item.kind] : 'bg-slate-50 text-slate-600'}`}
                >
                  <p className={idx === 0 ? 'font-medium' : ''}>
                    <span className="mr-1.5">{idx === 0 ? '!' : '·'}</span>
                    {item.summary}
                  </p>
                  {idx === 0 && <p className="mt-0.5 text-xs opacity-75">{item.suggestion}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <hr className="mt-3 border-slate-100" />

        {/* C. 운영 요약 */}
        <DemoMetricsLabel />
        <dl className="mt-1.5 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-[#F3DCC7]/70 bg-white px-3 py-2">
            <dt className="text-xs text-slate-500">최근 자료</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-900">{formatShortDate(selectedSite.lastUpdatedAt)}</dd>
          </div>
          <MetricTile label="현재 재고" value={selectedSite.inventoryCount} unit="개" />
          {selectedSite.expectedShortage > 0 && (
            <MetricTile label="부족 수량" value={selectedSite.expectedShortage} unit="개" />
          )}
          {selectedSite.expiringCount >= EXPIRING_THRESHOLD && (
            <MetricTile label="유통기한 임박" value={selectedSite.expiringCount} unit="개" />
          )}
        </dl>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-[#F3DCC7]/70 bg-white px-3 py-2 text-xs text-slate-600">
          <Package size={13} className="shrink-0 text-slate-400" />
          <span className="text-slate-400">주요 품목</span>
          <span className="ml-1 font-medium">{selectedSite.focusItem}</span>
        </div>

        {/* D. CTA — 지도에서 고른 거점을 실제로 처리하는 화면(거점 상세)으로 데려간다. */}
        <div className="mt-auto space-y-1.5 pt-4">
          <Link
            to={`/admin/sites/${selectedSite.id}`}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#004696] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#073B74] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696] focus-visible:ring-offset-2"
          >
            거점 상세 열기
          </Link>
          <Link
            to={`/admin/regions/${selectedSite.district}?site=${selectedSite.id}`}
            className="block w-full text-center text-xs font-medium text-slate-500 transition-colors hover:text-[#004696] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
          >
            소속 구 현황 보기
          </Link>
        </div>
      </div>
    );
  }

  // B. 구역 요약 모드
  if (selectedDistrict) {
    const summary = districtSummaryMap[selectedDistrict];
    return (
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={() => onSelectDistrict(null)}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[#004696] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
        >
          <ArrowLeft size={16} />
          화성시 전체 요약으로 돌아가기
        </button>

        <div className="mt-3 flex items-center justify-between gap-2">
          <h4 className="text-base font-semibold text-slate-900">{summary.name}</h4>
          <SiteStatusBadge status={summary.riskLevel} />
        </div>
        {/* 거점 수는 확정 데이터라 시연 지표와 섞지 않고 따로 적는다. */}
        <p className="mt-0.5 text-xs text-slate-500">
          운영 거점 <span className="font-medium text-slate-700">{summary.siteCount}곳</span> · 지도에서 거점 마커를
          선택하면 상세 현황을 볼 수 있습니다.
        </p>

        <DemoMetricsLabel />
        <dl className="mt-1.5 grid grid-cols-2 gap-3">
          <MetricTile label="물품 부족 거점" value={summary.shortageSiteCount} unit="개소" />
          <MetricTile label="유통기한 임박 수량" value={summary.expiringQuantity} unit="개" />
          <MetricTile label="자료 확인 필요" value={summary.missingSiteCount} unit="개소" />
        </dl>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {statusFilter === 'normal' ? (
            <NormalSitesList sites={mockSites.filter((site) => site.district === selectedDistrict && site.status === 'normal')} />
          ) : (
            <ActionItemList
              title="확인이 필요한 거점"
              items={filterItemsByKpi(getActionItemsByDistrict(selectedDistrict), statusFilter).slice(0, ACTION_LIST_LIMIT)}
              emptyMessage="이 구에는 현재 확인이 필요한 거점이 없습니다."
              linkTo={ALL_ACTION_ITEMS_LINK}
              linkLabel="전체 확인 필요 거점 보기"
            />
          )}
        </div>
      </div>
    );
  }

  // A. 화성시 전체 모드
  if (citySummary.siteCount === 0) {
    return <EmptyState message="표시할 거점 데이터가 없습니다." />;
  }

  return (
    <div className="flex h-full flex-col">
      <h4 className="text-base font-semibold text-slate-900">화성시 전체</h4>
      <p className="mt-0.5 text-xs text-slate-500">
        운영 거점 <span className="font-medium text-slate-700">{citySummary.siteCount}곳</span> · 거점 마커를 선택하면 운영 현황을 확인할 수 있습니다.
      </p>

      <DemoMetricsLabel />
      <dl className="mt-1.5 grid grid-cols-2 gap-3">
        <MetricTile label="물품 부족 거점" value={citySummary.shortageSiteCount} unit="개소" />
        <MetricTile label="유통기한 임박 수량" value={citySummary.expiringQuantity} unit="개" />
        <MetricTile label="자료 확인 필요" value={citySummary.missingSiteCount} unit="개소" />
      </dl>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {statusFilter === 'normal' ? (
          <NormalSitesList sites={mockSites.filter((site) => site.status === 'normal')} />
        ) : (
          <ActionItemList
            title="확인이 필요한 거점"
            items={filterItemsByKpi(getActionItemsByDistrict(null), statusFilter).slice(0, ACTION_LIST_LIMIT)}
            emptyMessage="현재 확인이 필요한 거점이 없습니다."
            linkTo={ALL_ACTION_ITEMS_LINK}
            linkLabel="전체 확인 필요 거점 보기"
          />
        )}
      </div>
    </div>
  );
}
