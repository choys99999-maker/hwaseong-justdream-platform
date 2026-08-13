import type { DistrictId } from '../types';
import { EXPIRING_THRESHOLD, mockSites } from './mockSites';
import { REGION_NAMES } from './regionMeta';

/**
 * 오늘 확인이 필요한 사항.
 *
 * 거점 합성 데이터(`mockSites`)에서 파생한 "담당자가 지금 봐야 할 일" 목록이다.
 * 값을 새로 만들지 않고 한 원천을 그대로 조합만 한다. 센터 간 이동을 계산해 추천하지
 * 않는다 — 그건 모아드림이 아니라 재고 최적화 도구의 역할이다.
 * 정렬: 부족(부족량 큰 순) → 유통기한 임박(임박 수량 큰 순) → 자료 확인 필요.
 * 'kind' 라벨은 실제 판정 신호를 그대로 부른다 — 유통기한 임박을 다른 이름(예: 운영
 * 확인 필요)으로 부르지 않는다.
 */
export type ActionKind = '부족' | '유통기한 임박' | '자료 확인 필요';

export interface OperationActionItem {
  id: string;
  kind: ActionKind;
  siteId: string;
  siteName: string;
  districtId: DistrictId;
  districtName: string;
  /** 무슨 문제인지 한 줄. 예: '분유 800g · 20개 부족' */
  summary: string;
  /** 권장 조치 한 줄. 예: '발주 또는 신규 확보 검토' */
  suggestion: string;
  /** 조치 버튼이 이동할 화면 */
  to: string;
  /** 조치 버튼 라벨 */
  ctaLabel: string;
}

function shortageItems(): OperationActionItem[] {
  return mockSites
    .filter((site) => site.status === 'shortage')
    .sort((a, b) => b.expectedShortage - a.expectedShortage)
    .map((site) => ({
      id: `act-shortage-${site.id}`,
      kind: '부족' as const,
      siteId: site.id,
      siteName: site.displayName,
      districtId: site.district,
      districtName: REGION_NAMES[site.district],
      summary: `${site.focusItem} · ${site.expectedShortage}개 부족`,
      suggestion: '발주 또는 신규 확보 검토',
      to: '/admin/inventory',
      ctaLabel: '재고 확인',
    }));
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
      districtId: site.district,
      districtName: REGION_NAMES[site.district],
      summary: `${site.focusItem} ${site.expiringCount}개 · 유통기한 임박`,
      suggestion: '우선 배부 검토',
      to: '/admin/inventory',
      ctaLabel: '재고 확인',
    }));
}

function missingItems(): OperationActionItem[] {
  return mockSites
    .filter((site) => site.status === 'missing')
    .map((site) => ({
      id: `act-missing-${site.id}`,
      kind: '자료 확인 필요' as const,
      siteId: site.id,
      siteName: site.displayName,
      districtId: site.district,
      districtName: REGION_NAMES[site.district],
      summary: '최근 자료 미입력',
      suggestion: '자료 제출 여부 확인 필요',
      to: '/admin/files',
      ctaLabel: '자료 확인',
    }));
}

/** 전체 확인 필요 목록 (우선순위 정렬 완료 상태) */
export const operationActionItems: OperationActionItem[] = [
  ...shortageItems(),
  ...expiringItems(),
  ...missingItems(),
];

export function getActionItemsByDistrict(district: DistrictId | null): OperationActionItem[] {
  if (!district) return operationActionItems;
  return operationActionItems.filter((item) => item.districtId === district);
}

export function getActionItemsBySite(siteId: string): OperationActionItem[] {
  return operationActionItems.filter((item) => item.siteId === siteId);
}

export interface ActionKindCount {
  kind: ActionKind;
  count: number;
}

export const actionKindCounts: ActionKindCount[] = (
  ['부족', '유통기한 임박', '자료 확인 필요'] as ActionKind[]
).map((kind) => ({
  kind,
  count: operationActionItems.filter((item) => item.kind === kind).length,
}));
