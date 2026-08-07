import { ArrowLeft, ArrowRight, CalendarClock, ExternalLink, Info, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { DistrictId, OperationSite, RedistributionRecommendation } from '../../types';
import SiteStatusBadge from '../common/SiteStatusBadge';
import EmptyState from '../common/EmptyState';
import { REGION_NAMES } from '../../data/regionMeta';
import {
  citySummary,
  districtSummaryMap,
  getRecommendationsByDistrict,
  getRecommendationsBySite,
  redistributionRecommendations,
} from '../../data/operationSummary';
import { formatDateTime, formatNumber } from '../../utils/format';

const CITY_RECOMMENDATION_LIMIT = 3;

interface OperationActionPanelProps {
  selectedDistrict: DistrictId | null;
  selectedSite: OperationSite | null;
  onSelectDistrict: (district: DistrictId | null) => void;
  onClearSite: () => void;
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

function RecommendationItem({ recommendation }: { recommendation: RedistributionRecommendation }) {
  return (
    <li className="rounded-lg border border-slate-100 bg-white px-3 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-slate-800">
          {recommendation.toSiteName} {recommendation.item} {formatNumber(recommendation.shortageQuantity)}개 부족 예상
        </p>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
          우선순위 {recommendation.priority}
        </span>
      </div>
      <p className="mt-1 flex items-center gap-1 text-xs text-teal-700">
        <ArrowRight size={13} className="shrink-0" />
        {recommendation.fromSiteName}에서 {formatNumber(recommendation.moveQuantity)}개 이동 추천
      </p>
      <p className="mt-0.5 text-[11px] text-slate-400">{REGION_NAMES[recommendation.district]}</p>
    </li>
  );
}

function RecommendationList({
  title,
  recommendations,
  emptyMessage,
}: {
  title: string;
  recommendations: RedistributionRecommendation[];
  emptyMessage: string;
}) {
  return (
    <div className="mt-4">
      <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
      {recommendations.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {recommendations.map((recommendation) => (
            <RecommendationItem key={recommendation.id} recommendation={recommendation} />
          ))}
        </ul>
      )}
      <p className="mt-2 flex items-start gap-1 text-[11px] text-slate-400">
        <Info size={12} className="mt-0.5 shrink-0" />
        합성 데이터에 부족·여유 수량 규칙을 적용한 결정론적 추천입니다. 실제 AI 모델을 호출하지 않습니다.
      </p>
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
    const siteRecommendations = getRecommendationsBySite(selectedSite.id);
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

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <MetricTile label="현재 재고" value={selectedSite.inventoryCount} unit="개" />
          <MetricTile label="7일 예상 수요" value={selectedSite.sevenDayDemand} unit="개" />
          <MetricTile label="예상 부족 수량" value={selectedSite.expectedShortage} unit="개" />
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
          <RecommendationList
            title="AI 재배분 추천"
            recommendations={siteRecommendations}
            emptyMessage={
              selectedSite.status === 'missing'
                ? '데이터가 입력되지 않아 추천을 계산할 수 없습니다.'
                : '현재 이 거점에 필요한 재배분 추천이 없습니다.'
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
        <p className="mt-0.5 text-xs text-slate-500">지도에서 거점 마커를 선택하면 상세 현황을 볼 수 있습니다.</p>

        <dl className="mt-4 grid grid-cols-2 gap-3">
          <MetricTile label="운영 거점 수" value={summary.siteCount} unit="개소" />
          <MetricTile label="전체 재고" value={summary.inventoryTotal} unit="개" />
          <MetricTile label="부족 예상 거점" value={summary.shortageSiteCount} unit="개소" />
          <MetricTile label="유통기한 임박" value={summary.expiringQuantity} unit="개" />
          <MetricTile label="재배분 필요" value={summary.recommendationCount} unit="건" />
          <MetricTile label="데이터 미입력" value={summary.missingSiteCount} unit="개소" />
        </dl>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <RecommendationList
            title="우선 재배분 추천"
            recommendations={getRecommendationsByDistrict(selectedDistrict)}
            emptyMessage="이 구에는 현재 재배분이 필요한 거점이 없습니다."
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
      <p className="mt-0.5 text-xs text-slate-500">지도에서 구역을 선택하면 해당 구 요약으로 바뀝니다.</p>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile label="부족 예상 거점" value={citySummary.shortageSiteCount} unit="개소" />
        <MetricTile label="유통기한 임박" value={citySummary.expiringQuantity} unit="개" />
        <MetricTile label="과잉 재고 거점" value={citySummary.surplusSiteCount} unit="개소" />
        <MetricTile label="데이터 미입력 거점" value={citySummary.missingSiteCount} unit="개소" />
      </dl>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <RecommendationList
          title="우선순위 높은 AI 재배분 추천"
          recommendations={redistributionRecommendations.slice(0, CITY_RECOMMENDATION_LIMIT)}
          emptyMessage="현재 재배분이 필요한 거점이 없습니다."
        />
      </div>
    </div>
  );
}
