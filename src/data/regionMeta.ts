import type { RegionId } from '../types';

export const REGION_ORDER: RegionId[] = ['seobu', 'jungbu', 'nambu', 'dongbu', 'dongtan'];

export const REGION_NAMES: Record<RegionId, string> = {
  seobu: '서부권역',
  jungbu: '중부권역',
  nambu: '남부권역',
  dongbu: '동부권역',
  dongtan: '동탄권역',
};
