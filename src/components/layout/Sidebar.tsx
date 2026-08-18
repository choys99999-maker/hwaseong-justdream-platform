import { useState, useEffect } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { NAV_ITEMS, isNavItemActive } from '../../config/navigation';
import hwaseongLogo from '../../assets/hwaseong-signature.png';

const STORAGE_KEY = 'sidebar-collapsed';
/** 이 폭 아래에서는 본문 공간이 부족해 사이드바를 자동으로 접는다. */
const NARROW_QUERY = '(max-width: 767px)';

export default function Sidebar() {
  const location = useLocation();
  const [userCollapsed, setUserCollapsed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true'
  );
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(userCollapsed));
  }, [userCollapsed]);

  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  // 좁은 화면에서는 강제로 접되, 사용자가 선택한 상태는 그대로 보존한다.
  const collapsed = userCollapsed || isNarrow;
  const setCollapsed = setUserCollapsed;

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-slate-200 bg-white ${collapsed ? 'w-16' : 'w-64'}`}
      style={{ transition: 'width 220ms ease-in-out' }}
    >
      {/* Brand */}
      <div className="relative border-b border-slate-200">
        <Link
          to="/admin"
          aria-label="오늘 할 일 홈으로 이동"
          className={`flex flex-col items-center py-4 cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset overflow-hidden ${
            collapsed ? 'px-2' : 'px-5'
          }`}
        >
          <img
            src={hwaseongLogo}
            alt="화성특례시"
            style={{
              width: collapsed ? '32px' : '130px',
              objectFit: 'contain',
              transition: 'width 220ms ease-in-out',
            }}
          />
          {!collapsed && (
            <p className="mt-2 text-[12px] font-bold leading-snug text-center text-slate-700">
              화성형 그냥드림 통합 운영 플랫폼
            </p>
          )}
        </Link>

        {/* Toggle button — sits centered on the right edge of the brand section */}
        {/* 좁은 화면에서는 항상 접힌 상태이므로 토글을 숨긴다. */}
        {!isNarrow && (
          <button
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'}
            aria-expanded={!collapsed}
            className="absolute right-0 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-400 hover:text-slate-700 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            style={{ transition: 'box-shadow 150ms ease-in-out' }}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          // 흡수된 화면(구 상세·재고·거점 상세 등)에서도 상위 메뉴가 켜져 있어야
          // "내가 지금 어느 메뉴 안에 있는지"를 잃지 않는다.
          const isActive = isNavItemActive(item, location.pathname);
          return (
            <div key={item.path} className="relative group">
              <NavLink
                to={item.path}
                aria-current={isActive ? 'page' : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  collapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && item.label}
              </NavLink>
              {/* Tooltip — only rendered in collapsed mode */}
              {collapsed && (
                <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {item.label}
                </span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 px-3 py-4 text-xs text-slate-400 overflow-hidden">
        {!collapsed && 'AI 화성 챌린지 시제품'}
      </div>
    </aside>
  );
}
