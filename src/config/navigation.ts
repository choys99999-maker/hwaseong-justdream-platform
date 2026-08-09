import {
  FolderClosed,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  Repeat2,
  Users,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

/**
 * 사이드바 6개 메뉴. 운영 흐름(현황 파악 → 재고 → 배분 → 이용 → 지역 → 자료) 순서다.
 * AI 수요예측은 독립 메뉴가 아니라 '배분·재배분' 화면의 추천 근거로 흡수했다.
 */
export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '통합 대시보드', icon: LayoutDashboard },
  { path: '/inventory', label: '물품·재고 관리', icon: PackageSearch },
  { path: '/redistribution', label: '배분·재배분', icon: Repeat2 },
  { path: '/usage', label: '이용·지원 현황', icon: Users },
  { path: '/regions', label: '지역·기관 현황', icon: MapPinned },
  { path: '/files', label: '자료 관리', icon: FolderClosed },
];

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/regions/') && pathname !== '/regions') {
    return '지역·기관 현황';
  }
  // 업로드·자료 상세는 모두 "자료 관리" 안의 화면이다.
  if (pathname.startsWith('/files')) {
    return '자료 관리';
  }
  const match = NAV_ITEMS.find((item) => item.path === pathname);
  return match?.label ?? '화성형 그냥드림';
}
