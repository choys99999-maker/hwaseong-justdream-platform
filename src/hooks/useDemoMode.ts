import { useCallback, useSyncExternalStore } from 'react';

const DEMO_MODE_KEY = 'demoMode';
const DEMO_MODE_EVENT = 'justdream:demo-mode-change';

export type DemoRole = 'citizen' | 'field' | 'admin';

export const DEMO_ROLES: { key: DemoRole; label: string; description: string; path: string }[] = [
  { key: 'citizen', label: '시민으로 보기', description: '거점 찾기 · 도움 요청 · 기부', path: '/' },
  {
    key: 'field',
    label: '현장 담당자로 보기',
    description: '거점 현황 · 재고 업데이트',
    path: '/admin',
  },
  { key: 'admin', label: '시청 관리자로 보기', description: '전체 운영 현황 관리', path: '/admin' },
];

/** 전환바에 쓰는 짧은 역할명. `admin`/`operator` 같은 개발 용어는 화면에 노출하지 않는다. */
export const DEMO_ROLE_LABELS: Record<DemoRole, string> = {
  citizen: '시민',
  field: '현장 담당자',
  admin: '시청 관리자',
};

/**
 * 현재 역할.
 *
 * 시민이냐 아니냐는 경로가 가른다(`/admin` 아래면 관리자 PC다).
 * 관리자 PC 안에서 시청 관리자냐 현장 담당자냐는 경로가 아니라 선택한 역할이 가른다 —
 * 두 역할이 같은 4개 메뉴를 쓰고 첫 화면 내용만 다르기 때문이다.
 */
export function getDemoRole(pathname: string, adminRole: 'admin' | 'field'): DemoRole {
  if (pathname.startsWith('/admin')) return adminRole === 'field' ? 'field' : 'admin';
  return 'citizen';
}

function readIsDemoMode(): boolean {
  return sessionStorage.getItem(DEMO_MODE_KEY) === 'true';
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(DEMO_MODE_EVENT, callback);
  return () => window.removeEventListener(DEMO_MODE_EVENT, callback);
}

/**
 * 시연 모드 on/off만 sessionStorage에 남긴다. 사용자가 역할 선택 UI로 직접 역할을 고른 경우에만
 * 켜지고, 새로고침·뒤로가기에도 유지되며 탭을 닫으면 사라진다.
 *
 * CitizenLayout처럼 중첩 라우트 전환(`/` ↔ `/easy`)에서는 레이아웃이 리마운트되지 않아
 * 컴포넌트별 로컬 state로는 다른 컴포넌트(예: 시민 홈의 진입 버튼)가 켠 상태를 못 따라간다.
 * `useSyncExternalStore` + 커스텀 이벤트로 이 훅을 쓰는 모든 인스턴스가 같은 값을 보게 한다.
 */
export function useDemoMode() {
  const isDemoMode = useSyncExternalStore(subscribe, readIsDemoMode);

  const enterDemo = useCallback(() => {
    sessionStorage.setItem(DEMO_MODE_KEY, 'true');
    window.dispatchEvent(new Event(DEMO_MODE_EVENT));
  }, []);

  const exitDemo = useCallback(() => {
    sessionStorage.removeItem(DEMO_MODE_KEY);
    window.dispatchEvent(new Event(DEMO_MODE_EVENT));
  }, []);

  return { isDemoMode, enterDemo, exitDemo };
}
