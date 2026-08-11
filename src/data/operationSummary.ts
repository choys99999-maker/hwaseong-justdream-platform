import type { DistrictId, DistrictSummary, OperationSite, OperationSummary, SiteStatus } from '../types';
import { REGION_NAMES, REGION_ORDER } from './regionMeta';
import { mockSites } from './mockSites';

/**
 * 거점 합성 데이터(`mockSites`)에서 KPI·구 요약을 한 번에 계산한다.
 * 통합 대시보드와 지역별 현황이 같은 값을 쓰도록 계산 위치를 여기로 모았다.
 *
 * 센터 간 재분배 추천 엔진은 여기 있었으나, 모아드림의 중심을 "재고 최적화"에서
 * "운영 현황 관제"로 옮기며 제거했다. 부족·임박·미제출 같은 사실 집계만 남는다.
 */

/** 구 전체 거점 중 이 비율 이상이 부족이면 구 위험도를 '부족'으로 본다. */
const DISTRICT_SHORTAGE_RATIO = 0.4;
/** 구 유통기한 임박 수량이 이 값 이상이면 구 위험도를 '유통기한 임박'으로 본다. */
const DISTRICT_EXPIRING_THRESHOLD = 30;

function summarize(sites: OperationSite[]): OperationSummary {
  return {
    siteCount: sites.length,
    inventoryTotal: sites.reduce((sum, site) => sum + site.inventoryCount, 0),
    shortageSiteCount: sites.filter((site) => site.status === 'shortage').length,
    shortageQuantity: sites.reduce((sum, site) => sum + site.expectedShortage, 0),
    expiringQuantity: sites.reduce((sum, site) => sum + site.expiringCount, 0),
    missingSiteCount: sites.filter((site) => site.status === 'missing').length,
  };
}

/** 구 위험도. 지도 폴리곤 색상과 지역 카드 배지가 동일하게 사용한다. */
function resolveDistrictRisk(summary: OperationSummary): SiteStatus {
  if (summary.siteCount === 0) return 'missing';
  if (summary.shortageSiteCount / summary.siteCount >= DISTRICT_SHORTAGE_RATIO) return 'shortage';
  if (summary.missingSiteCount > 0) return 'missing';
  if (summary.expiringQuantity >= DISTRICT_EXPIRING_THRESHOLD) return 'expiring';
  return 'normal';
}

export const districtSummaries: DistrictSummary[] = REGION_ORDER.map((id) => {
  const sites = mockSites.filter((site) => site.district === id);
  const summary = summarize(sites);
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

export const citySummary: OperationSummary = summarize(mockSites);

export function getSummary(district: DistrictId | null): OperationSummary {
  return district ? districtSummaryMap[district] : citySummary;
}
