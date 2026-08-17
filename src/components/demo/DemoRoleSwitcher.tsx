import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ROLES, DEMO_ROLE_LABELS, getDemoRole, type DemoRole } from '../../hooks/useDemoMode';
import { setAdminRole, useAdminRole } from '../../hooks/useAdminRole';

/**
 * 시민/관리자 레이아웃 상단에 항상 고정되는 역할 전환바.
 * CitizenLayout·AdminLayout 최상단에 마운트돼 어느 화면에서도 시민↔현장 담당자↔시청 관리자를 즉시 오갈 수 있다.
 * 모바일(390px) 포함 모든 너비에서 역할 3개를 직접 노출한다.
 */
export default function DemoRoleSwitcher() {
  const { role: adminRole } = useAdminRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  // pathname 또는 adminRole이 바뀌면 pending을 푼다.
  // /admin 안에서 현장↔시청 전환은 pathname이 같고 adminRole만 바뀌므로 둘 다 필요하다.
  useEffect(() => {
    setPending(false);
  }, [location.pathname, adminRole]);

  const currentRole = getDemoRole(location.pathname, adminRole);

  // 관리자 PC 안의 두 역할은 경로가 같으므로, 이동 전에 역할부터 바꿔 둔다.
  function goTo(role: DemoRole, path: string) {
    if (pending) return;
    setPending(true);
    if (role === 'field' || role === 'admin') setAdminRole(role === 'field' ? 'field' : 'admin');
    navigate(path);
  }

  return (
    <div className="sticky top-0 z-40 flex min-h-[44px] items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
      <span className="shrink-0 font-semibold text-amber-900">시연</span>
      <span className="shrink-0 text-amber-300" aria-hidden="true">
        ·
      </span>

      {/* 모든 너비에서 역할 3개 직접 노출 */}
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {DEMO_ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => goTo(role.key, role.path)}
            disabled={pending}
            aria-pressed={role.key === currentRole}
            className={`min-h-[40px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              role.key === currentRole
                ? 'bg-amber-600 text-white'
                : 'border-[1.5px] border-ink-950/75 bg-white text-amber-800 hover:bg-amber-100'
            }`}
          >
            {DEMO_ROLE_LABELS[role.key]}
          </button>
        ))}
      </div>
    </div>
  );
}
