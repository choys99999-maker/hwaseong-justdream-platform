import {
  FolderClosed,
  HeartHandshake,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/admin', label: '통합 대시보드', icon: LayoutDashboard },
  { path: '/admin/regions', label: '거점 운영', icon: MapPinned },
  { path: '/admin/inventory', label: '물품 현황', icon: PackageSearch },
  { path: '/admin/quick-status', label: '빠른 현황 입력', icon: Zap },
  { path: '/admin/usage', label: '이용·지원 현황', icon: Users },
  { path: '/admin/welfare-linkage', label: '복지연계 현황', icon: HeartHandshake },
  { path: '/admin/files', label: '자료·데이터 관리', icon: FolderClosed },
];

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/admin/regions/') && pathname !== '/admin/regions') {
    return '거점 운영';
  }
  if (pathname.startsWith('/admin/files')) {
    return '자료·데이터 관리';
  }
  if (pathname.startsWith('/admin/help-requests')) {
    return '도움 요청 접수';
  }
  const match = NAV_ITEMS.find((item) => item.path === pathname);
  return match?.label ?? '화성형 그냥드림';
}
