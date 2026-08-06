import type { RegionId, SiteStatus } from '../types';

/** 화성특례시 4개 구. 지도 필터·지역 카드·요약 패널이 모두 이 순서를 따른다. */
export const REGION_ORDER: RegionId[] = ['manse', 'hyohaeng', 'byeongjeom', 'dongtan'];

export const REGION_NAMES: Record<RegionId, string> = {
  manse: '만세구',
  hyohaeng: '효행구',
  byeongjeom: '병점구',
  dongtan: '동탄구',
};

export const SITE_STATUS_LABELS: Record<SiteStatus, string> = {
  normal: '정상',
  shortage: '부족',
  expiring: '유통기한 임박',
  surplus: '과잉 재고',
  missing: '데이터 미입력',
};

/** 상태별 색상. 지도 폴리곤·마커·범례가 같은 값을 사용한다. */
export const SITE_STATUS_COLORS: Record<SiteStatus, { fill: string; stroke: string }> = {
  normal: { fill: '#10b981', stroke: '#047857' },
  shortage: { fill: '#f43f5e', stroke: '#be123c' },
  expiring: { fill: '#f59e0b', stroke: '#b45309' },
  surplus: { fill: '#0ea5e9', stroke: '#0369a1' },
  missing: { fill: '#94a3b8', stroke: '#475569' },
};

/** 범례·배지에서 쓰는 tailwind 클래스. StatusBadge 와 톤을 맞춘다. */
export const SITE_STATUS_BADGE_STYLES: Record<SiteStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  shortage: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  expiring: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  surplus: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  missing: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};
