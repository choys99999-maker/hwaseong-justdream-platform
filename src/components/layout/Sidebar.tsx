import { Link, NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '../../config/navigation';
import hwaseongLogo from '../../assets/hwaseong-signature.png';

export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <Link
        to="/"
        aria-label="통합 대시보드 홈으로 이동"
        className="flex flex-col items-center border-b border-slate-200 px-5 py-4 cursor-pointer transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-inset"
      >
        <img
          src={hwaseongLogo}
          alt="화성특례시"
          style={{ width: '130px', objectFit: 'contain' }}
        />
        <p className="mt-2 text-[12px] font-bold leading-snug text-center text-slate-700">
          화성형 그냥드림 통합 운영 플랫폼
        </p>
      </Link>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon size={18} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-400">
        AI 화성 챌린지 시제품
      </div>
    </aside>
  );
}
