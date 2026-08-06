import { useCallback, useState, type ReactNode } from 'react';
import type { RegionId } from '../types';
import type { AppUser } from '../types/auth';
import { DEFAULT_DEMO_USER } from '../config/demo';
import { AuthContext } from './authContext';

const USER_STORAGE_KEY = 'gjd_auth';
const REGION_SESSION_KEY = 'gjd_region_scope';

function loadStoredUser(): AppUser {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppUser;
      if (parsed?.id && parsed?.role) return parsed;
    }
  } catch {
    // 파싱 실패 시 기본값 사용
  }
  return DEFAULT_DEMO_USER;
}

function loadStoredRegionId(): RegionId | null {
  try {
    const raw = sessionStorage.getItem(REGION_SESSION_KEY);
    if (raw && raw !== 'null') return raw as RegionId;
  } catch {
    // ignore
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AppUser>(loadStoredUser);
  const [selectedRegionId, setSelectedRegionIdState] = useState<RegionId | null>(loadStoredRegionId);

  const setUser = useCallback((newUser: AppUser) => {
    setUserState(newUser);
    setSelectedRegionIdState(null);
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(newUser));
    sessionStorage.removeItem(REGION_SESSION_KEY); // 계정 전환 시 지역 범위 초기화
  }, []);

  const setSelectedRegionId = useCallback((id: RegionId | null) => {
    setSelectedRegionIdState(id);
    // sessionStorage에 저장하여 같은 탭 새로고침에도 유지
    if (id) {
      sessionStorage.setItem(REGION_SESSION_KEY, id);
    } else {
      sessionStorage.removeItem(REGION_SESSION_KEY);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, selectedRegionId, setUser, setSelectedRegionId }}>
      {children}
    </AuthContext.Provider>
  );
}
