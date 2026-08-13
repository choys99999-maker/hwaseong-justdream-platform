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

/**
 * 사이드바 메뉴. 화성시 그냥드림 거점의 운영 데이터를 표준화해 통합 관제하는
 * 흐름(현황 파악 → 거점 → 물품 → 이용 → 복지연계 → 자료) 순서다.
 * 재고 최적화·재분배 화면은 제품 정의에서 제외했다(모아드림은 FMS·행복e음을 대체하지 않는다).
 *
 * 경로는 모두 `/admin` 아래에 있다 — 루트(`/`)는 시민용 화면이 쓴다.
 */
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
  // 업로드·자료 상세는 모두 "자료·데이터 관리" 안의 화면이다.
  if (pathname.startsWith('/admin/files')) {
    return '자료·데이터 관리';
  }
  if (pathname.startsWith('/admin/help-requests')) {
    return '도움 요청 접수';
  }
  const match = NAV_ITEMS.find((item) => item.path === pathname);
  return match?.label ?? '화성형 그냥드림';
}
