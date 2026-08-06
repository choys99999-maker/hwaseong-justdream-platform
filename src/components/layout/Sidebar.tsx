import { NavLink } from 'react-router-dom';
import { HeartHandshake } from 'lucide-react';
import { NAV_ITEMS } from '../../config/navigation';

export default function Sidebar() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-white">
          <HeartHandshake size={20} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">그냥드림 통합 운영</p>
          <p className="text-xs text-slate-500">화성시청 관리자</p>
        </div>
      </div>

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
        화성시 그냥드림 통합 운영 플랫폼
        <br />
        v0.1 · 시연용 골격
      </div>
    </aside>
  );
}
