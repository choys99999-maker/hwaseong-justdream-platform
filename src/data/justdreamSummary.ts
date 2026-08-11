import type { DistrictId } from '../types';
import { JUST_DREAM_SITES_25 } from './justdream_sites_25';
import { JD_COUNTS } from './justdream_locations_43';
import { mockSites } from './mockSites';
import { REGION_NAMES, REGION_ORDER } from './regionMeta';

/**
 * 화성형 그냥드림 거점 현황 — **확정 데이터에서 계산한 값만** 담는다.
 *
 * 원천
 * - 기관 수·유형: `justdream_sites_25.ts` (실적 자료 기준 기관명 25건, source of truth)
 * - 구 분포:      `mockSites.district` — 확정 좌표를 화성시 행정동 경계와 대조해 확정한 값
 *                 (scripts/verify-justdream-coordinates.mjs 로 25건 전수 검증)
 *
 * 하드코딩한 숫자는 없다. 시드가 늘거나 줄면 이 값들도 함께 따라간다.
 * 재고·수요·유통기한 같은 운영 지표는 아직 시연용 합성 수치라 여기 넣지 않는다.
 * (그 값들은 `operationSummary.ts` 에 있고 화면에서 '시연 데이터'로 구분해 표기한다)
 */

function countByCategory(category: (typeof JUST_DREAM_SITES_25)[number]['category']): number {
  return JUST_DREAM_SITES_25.filter((site) => site.category === category).length;
}

export interface DistrictSiteCount {
  id: DistrictId;
  name: string;
  count: number;
}

/** 구별 거점 수. 거점이 하나도 없는 구는 제외한다. */
export const SITE_COUNT_BY_DISTRICT: DistrictSiteCount[] = REGION_ORDER.map((id) => ({
  id,
  name: REGION_NAMES[id],
  count: mockSites.filter((site) => site.district === id).length,
}))
  .filter((entry) => entry.count > 0)
  .sort((a, b) => b.count - a.count || REGION_ORDER.indexOf(a.id) - REGION_ORDER.indexOf(b.id));

export const JUSTDREAM_SITE_SUMMARY = {
  /** 현재 시스템에 데이터가 등록된 거점 수. 화성시 전체 그냥드림 거점 수와 다르다. */
  total: JUST_DREAM_SITES_25.length,
  /** 복지기관 (종합사회복지관·노인복지관·장애인복지관) */
  welfareOrgCount: countByCategory('복지기관'),
  /** 읍면동 지역사회보장협의체 */
  councilCount: countByCategory('지역사회보장협의체'),
  /** 거점이 있는 구 수 */
  districtCount: SITE_COUNT_BY_DISTRICT.length,
} as const;

/**
 * 화성시 그냥드림 전체 사업 규모.
 * 위 JUSTDREAM_SITE_SUMMARY(데이터 등록 25개소)와 다른 값이다 — 혼용하지 않는다.
 *
 *   43 = 전체 사업 프로그램 수
 *   25 = 현재 시스템에 상세 데이터가 등록된 거점 수
 */
export const JUSTDREAM_PROGRAM_TOTALS = JD_COUNTS;
