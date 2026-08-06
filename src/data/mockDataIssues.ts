import type { DataIssueAlert } from '../types';
import { REGION_NAMES } from './regionMeta';

export const mockDataIssues: DataIssueAlert[] = [
  {
    id: 'issue-001',
    title: '재고 수량 불일치',
    description: '밑반찬 세트의 배부량이 입고량을 초과해 현재 재고가 음수로 계산되었습니다.',
    regionId: 'seobu',
    regionName: REGION_NAMES.seobu,
    severity: '높음',
  },
  {
    id: 'issue-002',
    title: '읍면동 지역 매핑 오류',
    description: '엑셀 원본의 읍면동 값이 권역 목록과 일치하지 않아 자동 매핑이 필요합니다.',
    regionId: 'dongbu',
    regionName: REGION_NAMES.dongbu,
    severity: '중간',
  },
  {
    id: 'issue-003',
    title: '중복 이용자 데이터 의심',
    description: '동일 이용자, 동일 지원일로 등록된 데이터가 2건 이상 발견되었습니다.',
    regionId: 'jungbu',
    regionName: REGION_NAMES.jungbu,
    severity: '중간',
  },
  {
    id: 'issue-004',
    title: '유통기한 정보 누락',
    description: '일부 물품 항목에 유통기한 값이 입력되지 않아 확인이 필요합니다.',
    regionId: 'dongtan',
    regionName: REGION_NAMES.dongtan,
    severity: '낮음',
  },
];
