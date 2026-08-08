import {
  ClipboardList,
  LayoutDashboard,
  MapPinned,
  PackageSearch,
  TrendingUp,
  UploadCloud,
  Users,
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
  { path: '/support-records', label: '이용·상담 관리', icon: Users },
  { path: '/inventory', label: '물품·재고 관리', icon: PackageSearch },
  { path: '/forecast', label: 'AI 수요예측', icon: TrendingUp },
  { path: '/upload', label: '데이터 업로드', icon: UploadCloud },
];

export function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/regions/') && pathname !== '/regions') {
    return '지역 상세';
  }
  const match = NAV_ITEMS.find((item) => item.path === pathname);
  return match?.label ?? '화성형 그냥드림';
}
