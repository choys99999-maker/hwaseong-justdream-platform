import { Activity, FolderClosed, Inbox, MapPinned, type LucideIcon } from 'lucide-react';

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
 * 공무원이 스스로에게 던지는 질문이 그대로 메뉴다.
 *   운영 현황   — 화성시 전체가 지금 정상인가, 문제는 어디인가?
 *   거점 관리   — 거점 상태·재고를 보고 고치려면?
 *   시민 요청   — 시민이 보낸 건은 어디 있지?
 *   자료 관리   — 읍면동에서 올라온 기존 Excel 자료를 걷고 검수하려면?
 *
 * 기능을 지우지 않고 이 4개 안으로 넣는다. 한 업무로 가는 길은 하나만 둔다 —
 * 재고의 소량·즉시 수정은 [거점 관리 > 재고 업데이트](자연어)이고,
 * 대량·기존 행정자료 취합은 [자료 관리](Excel)다. 두 화면을 억지로 합치지 않는다.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: '운영 현황', icon: Activity },
  {
    path: '/admin/sites',
    label: '거점 관리',
    icon: MapPinned,
    // 구 상세(지도에서 진입)·재고·현황 입력도 거점 관리 안이다.
    matches: ['/admin/regions', '/admin/inventory', '/admin/quick-status'],
  },
  {
    path: '/admin/intake',
    label: '시민 요청',
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
