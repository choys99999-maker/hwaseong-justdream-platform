import { UserCircle } from 'lucide-react';
import { ADMIN_ROLE_LABELS, useAdminRole, type AdminRole } from '../../hooks/useAdminRole';

const ROLE_ORDER: AdminRole[] = ['admin', 'field'];

interface HeaderProps {
  title: string;
}

/**
 * 상단 바. 역할 전환만 둔다.
 *
 * 시 관리자와 현장 담당자는 같은 메뉴를 쓰지만 첫 화면 우선순위가 달라서,
 * 어떤 역할로 보고 있는지가 화면 어디서나 보여야 한다.
 * (동작하지 않던 기준 월 필터는 뺐다 — 화면의 어떤 값도 그 값을 쓰지 않았다.)
 */
export default function Header({ title }: HeaderProps) {
  const { role, setRole } = useAdminRole();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>

      <div className="flex items-center gap-4">
        <div
          className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          role="group"
          aria-label="역할 선택"
        >
          {ROLE_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRole(key)}
              aria-pressed={role === key}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                role === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {ADMIN_ROLE_LABELS[key]}
            </button>
          ))}
        </div>

        <span className="flex items-center gap-2 text-sm text-slate-500">
          <UserCircle size={20} className="text-slate-400" />
          <span className="hidden sm:inline">{ADMIN_ROLE_LABELS[role]}</span>
        </span>
      </div>
    </header>
  );
}
