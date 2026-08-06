import type { RegionId } from '../types';
import type { AppUser } from '../types/auth';
import { REGION_NAMES } from '../data/regionMeta';

// 시범 지역 ID — 이 값만 바꾸면 지역 관리자 계정의 담당 지역이 바뀝니다
export const PILOT_REGION_ID: RegionId = 'seobu';

export const DEMO_USERS: AppUser[] = [
  {
    id: 'demo-system',
    name: '화성시 통합관리자',
    role: 'SYSTEM_ADMIN',
    regionId: null,
  },
  {
    id: 'demo-region',
    name: `${REGION_NAMES[PILOT_REGION_ID]} 담당자`,
    role: 'REGION_ADMIN',
    regionId: PILOT_REGION_ID,
  },
];

export const DEFAULT_DEMO_USER: AppUser = DEMO_USERS[0];
