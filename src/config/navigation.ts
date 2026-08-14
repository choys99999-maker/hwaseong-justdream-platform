import {
  ClipboardCheck,
  FolderClosed,
  Inbox,
  MapPinned,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** 이 메뉴가 활성으로 보여야 할 경로들. path 자체는 항상 포함한다. */
  matches?: string[];
}

/**
 * 관리자 사이드바 — 4개.
 *
 * 공무원의 하루가 그대로 순서다: 오늘 할 일 → (거점을 고쳐야 하면) 거점 운영 →
 * (시민 건을 처리해야 하면) 시민 접수 → (자료를 걷어야 하면) 자료 관리.
 * 기능을 지우지 않고 이 4개 안으로 넣는다 — 물품 현황·빠른 입력·재고 관제는 거점 운영,
 * 이용·지원·복지연계는 시민 접수, 실적·분석은 자료 관리 안에 있다.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: '오늘 할 일', icon: ClipboardCheck },
  {
    path: '/admin/sites',
    label: '거점 운영',
    icon: MapPinned,
    // 구 상세(지도에서 진입)·빠른 입력 단독 화면도 거점 운영 안이다.
    matches: ['/admin/regions', '/admin/inventory', '/admin/quick-status'],
  },
  {
    path: '/admin/intake',
    label: '시민 접수',
    icon: Inbox,
    matches: ['/admin/help-requests'],
  },
  { path: '/admin/files', label: '자료 관리', icon: FolderClosed },
];

/** 사이드바 활성 표시 판정. `/admin` 만 정확히 일치할 때 켜진다. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.path === '/admin') return pathname === '/admin';
  return [item.path, ...(item.matches ?? [])].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function getPageTitle(pathname: string): string {
  const match = NAV_ITEMS.find((item) => isNavItemActive(item, pathname));
  return match?.label ?? '화성형 그냥드림';
}
