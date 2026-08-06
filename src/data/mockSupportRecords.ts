import type { SupportRecord } from '../types';
import { REGION_NAMES } from './regionMeta';

export const mockSupportRecords: SupportRecord[] = [
  { id: 'sr-001', userName: '김○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-08-05', item: '쌀 10kg', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-002', userName: '이○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-08-04', item: '생리대 세트', quantity: 3, counselingStatus: '연계 진행중' },
  { id: 'sr-003', userName: '박○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-08-02', item: '라면 1박스', quantity: 1, counselingStatus: '미연계' },
  { id: 'sr-004', userName: '최○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-07-28', item: '기저귀 대형', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-005', userName: '정○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-07-20', item: '밑반찬 세트', quantity: 4, counselingStatus: '연계 진행중' },
  { id: 'sr-006', userName: '강○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-07-15', item: '통조림 세트', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-007', userName: '조○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-06-30', item: '생필품 꾸러미', quantity: 1, counselingStatus: '미연계' },
  { id: 'sr-008', userName: '윤○○', regionId: 'seobu', regionName: REGION_NAMES.seobu, supportDate: '2026-06-18', item: '분유 800g', quantity: 2, counselingStatus: '연계 완료' },

  { id: 'sr-009', userName: '장○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-08-06', item: '즉석밥 세트', quantity: 3, counselingStatus: '연계 완료' },
  { id: 'sr-010', userName: '임○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-08-05', item: '위생용품 세트', quantity: 2, counselingStatus: '연계 진행중' },
  { id: 'sr-011', userName: '한○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-08-03', item: '쌀 10kg', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-012', userName: '오○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-07-27', item: '담요 1매', quantity: 2, counselingStatus: '미연계' },
  { id: 'sr-013', userName: '서○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-07-19', item: '라면 1박스', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-014', userName: '신○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-07-11', item: '통조림 세트', quantity: 1, counselingStatus: '연계 진행중' },
  { id: 'sr-015', userName: '권○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-06-25', item: '생리대 세트', quantity: 3, counselingStatus: '연계 완료' },
  { id: 'sr-016', userName: '황○○', regionId: 'jungbu', regionName: REGION_NAMES.jungbu, supportDate: '2026-06-12', item: '밑반찬 세트', quantity: 1, counselingStatus: '미연계' },

  { id: 'sr-017', userName: '안○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-08-05', item: '기저귀 대형', quantity: 1, counselingStatus: '연계 진행중' },
  { id: 'sr-018', userName: '송○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-08-01', item: '쌀 10kg', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-019', userName: '류○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-07-24', item: '부탄가스 8입', quantity: 1, counselingStatus: '미연계' },
  { id: 'sr-020', userName: '전○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-07-16', item: '생필품 꾸러미', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-021', userName: '홍○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-07-08', item: '즉석밥 세트', quantity: 2, counselingStatus: '연계 진행중' },
  { id: 'sr-022', userName: '김○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-06-29', item: '라면 1박스', quantity: 3, counselingStatus: '연계 완료' },
  { id: 'sr-023', userName: '이○○', regionId: 'nambu', regionName: REGION_NAMES.nambu, supportDate: '2026-06-14', item: '분유 800g', quantity: 1, counselingStatus: '미연계' },

  { id: 'sr-024', userName: '박○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-08-06', item: '생리대 세트', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-025', userName: '최○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-08-04', item: '통조림 세트', quantity: 3, counselingStatus: '연계 진행중' },
  { id: 'sr-026', userName: '정○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-07-30', item: '위생용품 세트', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-027', userName: '강○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-07-22', item: '쌀 10kg', quantity: 2, counselingStatus: '미연계' },
  { id: 'sr-028', userName: '조○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-07-10', item: '담요 1매', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-029', userName: '윤○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-06-27', item: '밑반찬 세트', quantity: 2, counselingStatus: '연계 진행중' },
  { id: 'sr-030', userName: '장○○', regionId: 'dongbu', regionName: REGION_NAMES.dongbu, supportDate: '2026-06-09', item: '기저귀 대형', quantity: 1, counselingStatus: '연계 완료' },

  { id: 'sr-031', userName: '임○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-08-06', item: '즉석밥 세트', quantity: 4, counselingStatus: '연계 진행중' },
  { id: 'sr-032', userName: '한○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-08-05', item: '생리대 세트', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-033', userName: '오○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-08-03', item: '분유 800g', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-034', userName: '서○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-07-26', item: '라면 1박스', quantity: 3, counselingStatus: '미연계' },
  { id: 'sr-035', userName: '신○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-07-17', item: '위생용품 세트', quantity: 1, counselingStatus: '연계 완료' },
  { id: 'sr-036', userName: '권○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-07-05', item: '쌀 10kg', quantity: 2, counselingStatus: '연계 진행중' },
  { id: 'sr-037', userName: '황○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-06-22', item: '통조림 세트', quantity: 2, counselingStatus: '연계 완료' },
  { id: 'sr-038', userName: '안○○', regionId: 'dongtan', regionName: REGION_NAMES.dongtan, supportDate: '2026-06-08', item: '생필품 꾸러미', quantity: 1, counselingStatus: '미연계' },
];
