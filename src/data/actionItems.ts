import { EXPIRING_THRESHOLD, mockSites } from './mockSites';
import { redistributionRecommendations } from './operationSummary';
import { REGION_NAMES } from './regionMeta';

/**
 * 오늘 조치가 필요한 사항.
 *
 * 거점 합성 데이터(`mockSites`)와 재배분 추천(`operationSummary`)에서 파생한
 * "담당자가 지금 봐야 할 일" 목록이다. 값을 새로 만들지 않고 두 원천을 조합만 한다.
 * 정렬: 부족(부족량 큰 순) → 유통기한 임박(임박 수량 큰 순) → 데이터 확인 → 과잉.
 */
export type ActionKind = '부족' | '유통기한 임박' | '과잉' | '데이터 확인 필요';

export interface OperationActionItem {
  id: string;
  kind: ActionKind;
  siteId: string;
  siteName: string;
  districtName: string;
  /** 무슨 문제인지 한 줄. 예: '분유 800g · 20개 부족 예상' */
  summary: string;
  /** 권장 조치 한 줄. 예: '동탄어울림종합사회복지관 → 동탄아르딤복지관 20개 이동 검토' */
  suggestion: string;
  /** 연결된 재배분 추천 id (부족·과잉일 때) */
  recommendationId?: string;
  /** 조치 버튼이 이동할 화면 */
  to: string;
  /** 조치 버튼 라벨 */
  ctaLabel: string;
}

function shortageItems(): OperationActionItem[] {
  return mockSites
    .filter((site) => site.status === 'shortage')
    .sort((a, b) => b.expectedShortage - a.expectedShortage)
    .map((site) => {
      const rec = redistributionRecommendations.find((r) => r.toSiteId === site.id);
      const donor = rec ? mockSites.find((s) => s.id === rec.fromSiteId) : undefined;
      return {
        id: `act-shortage-${site.id}`,
        kind: '부족' as const,
        siteId: site.id,
        siteName: site.displayName,
        districtName: REGION_NAMES[site.district],
        summary: `${site.focusItem} · ${site.expectedShortage}개 부족 예상`,
        suggestion:
          rec && donor
            ? `${donor.displayName} → ${site.displayName} ${rec.moveQuantity}개 이동 검토`
            : '동일 품목 여유 기관 없음 · 신규 확보 검토',
        recommendationId: rec?.id,
        to: '/redistribution',
        ctaLabel: '재배분 검토',
      };
    });
}

function expiringItems(): OperationActionItem[] {
  return mockSites
    .filter((site) => site.status !== 'missing' && site.expiringCount >= EXPIRING_THRESHOLD)
    .sort((a, b) => b.expiringCount - a.expiringCount)
    .map((site) => ({
      id: `act-expiring-${site.id}`,
      kind: '유통기한 임박' as const,
      siteId: site.id,
      siteName: site.displayName,
      districtName: REGION_NAMES[site.district],
      summary: `${site.focusItem} ${site.expiringCount}개 · 유통기한 임박`,
      suggestion: '우선 배부 또는 수요 높은 기관 이동 검토',
      to: '/inventory',
      ctaLabel: '재고 확인',
    }));
}

function missingItems(): OperationActionItem[] {
  return mockSites
    .filter((site) => site.status === 'missing')
    .map((site) => ({
      id: `act-missing-${site.id}`,
      kind: '데이터 확인 필요' as const,
      siteId: site.id,
      siteName: site.displayName,
      districtName: REGION_NAMES[site.district],
      summary: '최근 자료 미입력',
      suggestion: '자료 제출 여부 확인 필요',
      to: '/files',
      ctaLabel: '자료 확인',
    }));
}

function surplusItems(): OperationActionItem[] {
  return mockSites
    .filter((site) => site.status === 'surplus')
    .sort((a, b) => b.inventoryCount - b.sevenDayDemand - (a.inventoryCount - a.sevenDayDemand))
    .map((site) => {
      const rec = redistributionRecommendations.find((r) => r.fromSiteId === site.id);
      const target = rec ? mockSites.find((s) => s.id === rec.toSiteId) : undefined;
      return {
        id: `act-surplus-${site.id}`,
        kind: '과잉' as const,
        siteId: site.id,
        siteName: site.displayName,
        districtName: REGION_NAMES[site.district],
        summary: `${site.focusItem} · 7일 수요 ${site.sevenDayDemand}개 대비 재고 ${site.inventoryCount}개`,
        suggestion:
          rec && target
            ? `${site.displayName} → ${target.displayName} ${rec.moveQuantity}개 재배분 가능`
            : '부족 기관 발생 시 재배분 여력 보유',
        recommendationId: rec?.id,
        to: '/redistribution',
        ctaLabel: '재배분 검토',
      };
    });
}

/** 전체 조치 필요 목록 (우선순위 정렬 완료 상태) */
export const operationActionItems: OperationActionItem[] = [
  ...shortageItems(),
  ...expiringItems(),
  ...missingItems(),
  ...surplusItems(),
];

export interface ActionKindCount {
  kind: ActionKind;
  count: number;
}

export const actionKindCounts: ActionKindCount[] = (
  ['부족', '유통기한 임박', '과잉', '데이터 확인 필요'] as ActionKind[]
).map((kind) => ({
  kind,
  count: operationActionItems.filter((item) => item.kind === kind).length,
}));
