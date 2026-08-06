import type { RegionId } from './index';

export type UserRole = 'SYSTEM_ADMIN' | 'REGION_ADMIN';

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
  regionId: RegionId | null; // REGION_ADMIN 필수, SYSTEM_ADMIN null 허용
}
