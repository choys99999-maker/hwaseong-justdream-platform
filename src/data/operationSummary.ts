import type {
  DistrictId,
  DistrictSummary,
  OperationSite,
  OperationSummary,
  RedistributionRecommendation,
  SiteStatus,
} from '../types';
import { REGION_NAMES, REGION_ORDER } from './regionMeta';
import { mockSites } from './mockSites';

/**
 * 거점 합성 데이터(`mockSites`)에서 KPI·구 요약·재배분 추천을 한 번에 계산한다.
 * 통합 대시보드와 지역별 현황이 같은 값을 쓰도록 계산 위치를 여기로 모았다.
 *
 * 추천은 실제 AI 모델을 호출하지 않는다. 아래 규칙만 적용한 결정론적 계산 결과다.
 */

/** 공여 가능 수량을 계산할 때 남겨두는 자체 소요 비율 */
const DONOR_RESERVE_RATIO = 1.2;
/** 구 전체 거점 중 이 비율 이상이 부족이면 구 위험도를 '부족'으로 본다. */
const DISTRICT_SHORTAGE_RATIO = 0.4;
/** 구 유통기한 임박 수량이 이 값 이상이면 '유통기한 임박'으로 본다. */
const DISTRICT_EXPIRING_THRESHOLD = 30;

function donatableQuantity(site: OperationSite): number {
  if (site.status === 'missing') return 0;
  return Math.max(0, site.inventoryCount - Math.ceil(site.sevenDayDemand * DONOR_RESERVE_RATIO));
}

function buildRecommendations(): RedistributionRecommendation[] {
  const remainingCapacity = new Map<string, number>(
    mockSites.map((site) => [site.id, donatableQuantity(site)]),
  );

  const shortageSites = mockSites
    .filter((site) => site.expectedShortage > 0)
    .sort((a, b) => b.expectedShortage - a.expectedShortage || a.id.localeCompare(b.id));

  const recommendations: RedistributionRecommendation[] = [];

  shortageSites.forEach((target) => {
    const donor = mockSites
      .filter(
        (site) =>
          site.id !== target.id &&
          site.focusItem === target.focusItem &&
          (remainingCapacity.get(site.id) ?? 0) > 0,
      )
      // 같은 구 안에서 옮기는 안을 우선하고, 그다음 여유 수량이 많은 거점을 고른다.
      .sort((a, b) => {
        const sameDistrict = Number(b.district === target.district) - Number(a.district === target.district);
        if (sameDistrict !== 0) return sameDistrict;
        return (remainingCapacity.get(b.id) ?? 0) - (remainingCapacity.get(a.id) ?? 0);
      })[0];

    if (!donor) return;

    const moveQuantity = Math.min(target.expectedShortage, remainingCapacity.get(donor.id) ?? 0);
    if (moveQuantity <= 0) return;
    remainingCapacity.set(donor.id, (remainingCapacity.get(donor.id) ?? 0) - moveQuantity);

    recommendations.push({
      id: `rec-${target.id}`,
      priority: recommendations.length + 1,
      item: target.focusItem,
      district: target.district,
      fromSiteId: donor.id,
      fromSiteName: donor.name,
      toSiteId: target.id,
      toSiteName: target.name,
      shortageQuantity: target.expectedShortage,
      moveQuantity,
    });
  });

  return recommendations;
}

export const redistributionRecommendations: RedistributionRecommendation[] = buildRecommendations();

export function getRecommendationsByDistrict(district: DistrictId | null): RedistributionRecommendation[] {
  if (!district) return redistributionRecommendations;
  return redistributionRecommendations.filter((item) => item.district === district);
}

export function getRecommendationsBySite(siteId: string): RedistributionRecommendation[] {
  return redistributionRecommendations.filter(
    (item) => item.toSiteId === siteId || item.fromSiteId === siteId,
  );
}

function summarize(sites: OperationSite[], recommendationCount: number): OperationSummary {
  return {
    siteCount: sites.length,
    inventoryTotal: sites.reduce((sum, site) => sum + site.inventoryCount, 0),
    sevenDayDemandTotal: sites.reduce((sum, site) => sum + site.sevenDayDemand, 0),
    shortageSiteCount: sites.filter((site) => site.status === 'shortage').length,
    shortageQuantity: sites.reduce((sum, site) => sum + site.expectedShortage, 0),
    expiringQuantity: sites.reduce((sum, site) => sum + site.expiringCount, 0),
    surplusSiteCount: sites.filter((site) => site.status === 'surplus').length,
    missingSiteCount: sites.filter((site) => site.status === 'missing').length,
    recommendationCount,
  };
}

/** 구 위험도. 지도 폴리곤 색상과 지역 카드 배지가 동일하게 사용한다. */
function resolveDistrictRisk(summary: OperationSummary): SiteStatus {
  if (summary.siteCount === 0) return 'missing';
  if (summary.shortageSiteCount / summary.siteCount >= DISTRICT_SHORTAGE_RATIO) return 'shortage';
  if (summary.missingSiteCount > 0) return 'missing';
  if (summary.expiringQuantity >= DISTRICT_EXPIRING_THRESHOLD) return 'expiring';
  if (summary.surplusSiteCount > 0 && summary.shortageSiteCount === 0) return 'surplus';
  return 'normal';
}

export const districtSummaries: DistrictSummary[] = REGION_ORDER.map((id) => {
  const sites = mockSites.filter((site) => site.district === id);
  const summary = summarize(sites, getRecommendationsByDistrict(id).length);
  return {
    id,
    name: REGION_NAMES[id],
    riskLevel: resolveDistrictRisk(summary),
    ...summary,
  };
});

export const districtSummaryMap: Record<DistrictId, DistrictSummary> = districtSummaries.reduce(
  (acc, summary) => {
    acc[summary.id] = summary;
    return acc;
  },
  {} as Record<DistrictId, DistrictSummary>,
);

export const districtRiskLevels: Record<DistrictId, SiteStatus> = districtSummaries.reduce(
  (acc, summary) => {
    acc[summary.id] = summary.riskLevel;
    return acc;
  },
  {} as Record<DistrictId, SiteStatus>,
);

export const citySummary: OperationSummary = summarize(mockSites, redistributionRecommendations.length);

export function getSummary(district: DistrictId | null): OperationSummary {
  return district ? districtSummaryMap[district] : citySummary;
}
