import { ClipboardCheck, Inbox, MapPinned, type LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** 이 메뉴가 활성으로 보여야 할 경로들. path 자체는 항상 포함한다. */
  matches?: string[];
}

/**
 * 관리자 사이드바 — 3개.
 *
 * 공무원이 스스로에게 던지는 질문이 그대로 메뉴다.
 *   오늘 할 일  — 지금 뭐부터 해야 하지?
 *   거점 관리   — 거점 상태·재고를 보고 고치려면?
 *   시민 요청   — 시민이 보낸 건은 어디 있지?
 *
 * 기능을 지우지 않고 이 3개 안으로 넣는다. 한 업무로 가는 길은 하나만 둔다 —
 * 재고 수정은 [거점 관리 > 재고 업데이트] 하나뿐이고, 자연어·Excel 은 그 안의 두 방식이다.
 * 자료 보관함(`/admin/files`)은 경로로만 남기고 메뉴에서 내린다.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: '오늘 할 일', icon: ClipboardCheck },
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
