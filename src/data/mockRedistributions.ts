import type { RedistributionRecord } from '../types';
import { REGION_NAMES } from './regionMeta';

/**
 * 이미 처리된 거점 간 재배분 이력(합성 데이터).
 * 대시보드 '최근 재배분 내역' 카드에서 사용한다.
 * 앞으로 실행할 추천은 `operationSummary.ts` 의 `redistributionRecommendations` 에서 계산한다.
 */
export const mockRedistributionRecords: RedistributionRecord[] = [
  {
    id: 'rd-001',
    date: '2026-08-05',
    item: '즉석밥 세트',
    quantity: 30,
    fromSiteName: '향남읍 행정복지센터',
    toSiteName: '남양읍 행정복지센터',
    districtName: REGION_NAMES.manse,
  },
  {
    id: 'rd-002',
    date: '2026-08-04',
    item: '라면 1박스',
    quantity: 25,
    fromSiteName: '동탄4동 행정복지센터',
    toSiteName: '동탄5동 행정복지센터',
    districtName: REGION_NAMES.dongtan,
  },
  {
    id: 'rd-003',
    date: '2026-08-03',
    item: '생리대 세트',
    quantity: 18,
    fromSiteName: '진안동 행정복지센터',
    toSiteName: '병점1동 행정복지센터',
    districtName: REGION_NAMES.byeongjeom,
  },
  {
    id: 'rd-004',
    date: '2026-08-01',
    item: '위생용품 세트',
    quantity: 20,
    fromSiteName: '효행구 노인복지관',
    toSiteName: '정남면 행정복지센터',
    districtName: REGION_NAMES.hyohaeng,
  },
  {
    id: 'rd-005',
    date: '2026-07-30',
    item: '분유 800g',
    quantity: 12,
    fromSiteName: '동탄1동 행정복지센터',
    toSiteName: '동탄8동 행정복지센터',
    districtName: REGION_NAMES.dongtan,
  },
];
