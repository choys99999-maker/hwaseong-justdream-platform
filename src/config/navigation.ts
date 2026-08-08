import {
  ClipboardList,
  FolderClosed,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: '통합 대시보드', icon: LayoutDashboard },
  { path: '/regions', label: '지역별 현황', icon: MapPinned },
  { path: '/performance', label: '실적·복지연계', icon: ClipboardList },
  { path: '/inventory', label: '물품·재고 관리', icon: PackageSearch },
  { path: '/forecast', label: 'AI 수요예측', icon: TrendingUp },
  { path: '/files', label: '자료 관리', icon: FolderClosed },
];

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/regions/') && pathname !== '/regions') {
    return '지역 상세';
  }
  // 업로드·자료 상세는 모두 "자료 관리" 안의 화면이다.
  if (pathname.startsWith('/files')) {
    return '자료 관리';
  }
  const match = NAV_ITEMS.find((item) => item.path === pathname);
  return match?.label ?? '화성형 그냥드림';
}
