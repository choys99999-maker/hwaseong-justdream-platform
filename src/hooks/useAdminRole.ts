import { useCallback, useSyncExternalStore } from 'react';
import { mockSites } from '../data/mockSites';

/**
 * 관리자 PC의 역할.
 *
 * 같은 데이터를 쓰지만 첫 화면(`오늘 할 일`)의 우선순위가 다르다.
 *   - admin(시 관리자) : 화성시 전체에서 "어디를 확인하고 조치해야 하는지"
 *   - field(현장 담당자): 우리 거점에서 "지금 무엇을 입력하고 처리해야 하는지"
 *
 * 로그인이 없는 시제품이라 역할은 브라우저에 남긴다. 실제 운영에서는 계정 권한이
 * 이 값을 대신한다 — 화면 쪽은 이 훅만 보고 있으므로 교체 지점이 한 곳이다.
 */
export type AdminRole = 'admin' | 'field';

const ROLE_KEY = 'jd-admin-role';
const MY_SITE_KEY = 'jd-my-site';
const CHANGE_EVENT = 'justdream:admin-role-change';

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  admin: '시청 관리자',
  field: '현장 담당자',
};

function readRole(): AdminRole {
  return localStorage.getItem(ROLE_KEY) === 'field' ? 'field' : 'admin';
}

/** 담당 거점. 고르지 않았으면 null 이고, 현장 담당자 화면이 먼저 고르게 안내한다. */
function readMySiteId(): string | null {
  const stored = localStorage.getItem(MY_SITE_KEY);
  return stored && mockSites.some((site) => site.id === stored) ? stored : null;
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  // 다른 탭에서 바꾼 값도 따라간다.
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function notify() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** 훅 밖(시연 역할 전환 등)에서도 역할을 바꿀 수 있게 열어 둔다. */
export function setAdminRole(role: AdminRole) {
  localStorage.setItem(ROLE_KEY, role);
  notify();
}

export function useAdminRole() {
  const role = useSyncExternalStore(subscribe, readRole);
  const mySiteId = useSyncExternalStore(subscribe, readMySiteId);

  const setRole = useCallback((next: AdminRole) => setAdminRole(next), []);

  const setMySiteId = useCallback((siteId: string) => {
    localStorage.setItem(MY_SITE_KEY, siteId);
    notify();
  }, []);

  return { role, setRole, mySiteId, setMySiteId };
}
