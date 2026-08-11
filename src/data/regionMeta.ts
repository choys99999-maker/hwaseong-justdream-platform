import type { RegionId, SiteStatus } from '../types';

/** 화성특례시 4개 구. 지도 필터·지역 카드·요약 패널이 모두 이 순서를 따른다. */
export const REGION_ORDER: RegionId[] = ['manse', 'hyohaeng', 'byeongjeom', 'dongtan'];

export const REGION_NAMES: Record<RegionId, string> = {
  manse: '만세구',
  hyohaeng: '효행구',
  byeongjeom: '병점구',
  dongtan: '동탄구',
};

/**
 * 운영 상태 라벨.
 *
 * 라벨은 실제로 판정에 쓰는 신호를 있는 그대로 부른다 — 새 운영 용어를 지어내
 * 다른 신호(재고·유통기한) 결과에 덮어씌우지 않는다.
 *   - expiring: 품목 유통기한 임박 수량으로만 판정한다. "운영 확인"이 필요하다는
 *     뜻이 아니라 유통기한을 확인해야 한다는 뜻이므로 라벨도 그대로 '유통기한 임박'.
 *   - missing : 거점에 명시적으로 등록된 '자료 미입력' 표시(시연 값)로만 판정한다.
 *     실제 제출 이력과는 별개다 — 자료·데이터 관리 화면의 '확인 필요'는 실제
 *     제출 오류(issueCount)로 판정하는 서로 다른 신호다.
 */
export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  normal: '정상 운영',
  shortage: '물품 부족',
  expiring: '유통기한 임박',
  missing: '자료 확인 필요',
};

/** 상태별 색상. 지도 폴리곤·마커·범례가 같은 값을 사용한다. */
export const SITE_STATUS_COLORS: Record<SiteStatus, { fill: string; stroke: string }> = {
  normal: { fill: '#10b981', stroke: '#047857' },
  shortage: { fill: '#f43f5e', stroke: '#be123c' },
  expiring: { fill: '#f59e0b', stroke: '#b45309' },
  missing: { fill: '#94a3b8', stroke: '#475569' },
};

/** 범례·배지에서 쓰는 tailwind 클래스. StatusBadge 와 톤을 맞춘다. */
export const SITE_STATUS_BADGE_STYLES: Record<SiteStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  shortage: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  expiring: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  missing: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
