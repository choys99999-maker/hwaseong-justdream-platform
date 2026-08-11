import { ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Package } from 'lucide-react';
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
import { formatDateTime, formatNumber } from '../../utils/format';

const CITY_ACTION_LIMIT = 5;

interface OperationActionPanelProps {
  selectedDistrict: DistrictId | null;
  selectedSite: OperationSite | null;
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
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-slate-900">
        {formatNumber(value)}
        <span className="ml-1 text-xs font-normal text-slate-400">{unit}</span>
      </dd>
    </div>
  );
}

const KIND_BADGE: Record<ActionKind, string> = {
  '부족': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  '유통기한 임박': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  '자료 확인 필요': 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

function ActionItemRow({ item, showSite = true }: { item: OperationActionItem; showSite?: boolean }) {
  return (
    <li className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium text-slate-800">
          {showSite && <span className="mr-1">{item.siteName}</span>}
          {item.summary}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${KIND_BADGE[item.kind]}`}
        >
          {item.kind}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-teal-700">
        <ArrowRight size={13} className="shrink-0" />
        {item.suggestion}
      </p>
      {showSite && <p className="mt-0.5 text-[11px] text-slate-400">{item.districtName}</p>}
    </li>
  );
}

function ActionItemList({
  title,
  items,
  emptyMessage,
  linkTo,
  showSite = true,
}: {
  title: string;
  items: OperationActionItem[];
  emptyMessage: string;
  linkTo?: string;
  showSite?: boolean;
}) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <ActionItemRow key={item.id} item={item} showSite={showSite} />
          ))}
        </ul>
      )}
      {items.length > 0 && linkTo && (
        <Link
          to={linkTo}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          이어서 확인
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

export default function OperationActionPanel({
  selectedDistrict,
  selectedSite,
  onSelectDistrict,
  onClearSite,
}: OperationActionPanelProps) {
  // C. 거점 상세 모드
  if (selectedSite) {
    const siteActions = getActionItemsBySite(selectedSite.id);
    return (
      <div className="flex h-full flex-col">
        <button
          type="button"
          onClick={onClearSite}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ArrowLeft size={16} />
          {selectedDistrict ? `${REGION_NAMES[selectedDistrict]} 요약으로 돌아가기` : '화성시 전체 요약으로 돌아가기'}
        </button>

        <div className="mt-3 flex items-start justify-between gap-2">
          <div>
            <h4 className="text-base font-semibold text-slate-900">{selectedSite.name}</h4>
            <p className="mt-0.5 text-xs text-slate-500">
              {REGION_NAMES[selectedSite.district]} · {selectedSite.facilityType}
              {selectedSite.isDemo && (
                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">데모 거점</span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-400">
              {selectedSite.programTypes.includes('HWASEONG') && selectedSite.programTypes.includes('NATIONAL')
                ? '화성형·국가형 동시 운영'
                : selectedSite.programTypes.includes('NATIONAL')
                  ? '국가형'
                  : '화성형'}
            </p>
          </div>
          <SiteStatusBadge status={selectedSite.status} />
        </div>

        <DemoMetricsLabel />
        <dl className="mt-1.5 grid grid-cols-2 gap-3">
          <MetricTile label="현재 재고" value={selectedSite.inventoryCount} unit="개" />
          <MetricTile label="부족 수량" value={selectedSite.expectedShortage} unit="개" />
          <MetricTile label="유통기한 임박" value={selectedSite.expiringCount} unit="개" />
        </dl>

        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <Package size={13} className="shrink-0 text-slate-400" />
          <span className="text-slate-400">주요 품목</span>
          <span className="ml-1 font-medium">{selectedSite.focusItem}</span>
        </div>

        <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <CalendarClock size={14} />
          최근 데이터 입력: {formatDateTime(selectedSite.lastUpdatedAt)}
        </div>

        <Link
          to={`/regions/${selectedSite.district}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <ExternalLink size={13} />
          {REGION_NAMES[selectedSite.district]} 현황 보기
        </Link>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ActionItemList
            title="확인이 필요한 사항"
            items={siteActions}
            showSite={false}
            emptyMessage={
              selectedSite.status === 'missing'
                ? '데이터가 입력되지 않아 확인할 항목을 계산할 수 없습니다.'
                : '현재 이 거점에 확인이 필요한 사항이 없습니다.'
            }
          />
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
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
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
          <ActionItemList
            title="확인이 필요한 사항"
            items={getActionItemsByDistrict(selectedDistrict)}
            emptyMessage="이 구에는 현재 확인이 필요한 거점이 없습니다."
          />
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
        운영 거점 <span className="font-medium text-slate-700">{citySummary.siteCount}곳</span> · 지도에서 구역을
        선택하면 해당 구 요약으로 바뀝니다.
      </p>

      <DemoMetricsLabel />
      <dl className="mt-1.5 grid grid-cols-2 gap-3">
        <MetricTile label="물품 부족 거점" value={citySummary.shortageSiteCount} unit="개소" />
        <MetricTile label="유통기한 임박 수량" value={citySummary.expiringQuantity} unit="개" />
        <MetricTile label="자료 확인 필요" value={citySummary.missingSiteCount} unit="개소" />
      </dl>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ActionItemList
          title="오늘 확인이 필요한 사항"
          items={getActionItemsByDistrict(null).slice(0, CITY_ACTION_LIMIT)}
          emptyMessage="현재 확인이 필요한 거점이 없습니다."
        />
      </div>
    </div>
  );
}
