import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ROLES, DEMO_ROLE_LABELS, getDemoRole, useDemoMode, type DemoRole } from '../../hooks/useDemoMode';
import { setAdminRole, useAdminRole } from '../../hooks/useAdminRole';

interface DemoRoleSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 역할 선택 시트. Drawer 아래쪽 "DEMO · 역할 전환" 과 전환바의 "역할 변경" 이 함께 쓴다.
 * 여기서 역할을 고른 시점에만 demoMode 가 켜진다 — 시트를 열기만 해서는 켜지지 않는다.
 */
export default function DemoRoleSheet({ open, onClose }: DemoRoleSheetProps) {
  const { enterDemo } = useDemoMode();
  const { role: adminRole } = useAdminRole();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) setPending(false);
  }, [open]);

  if (!open) return null;

  const currentRole = getDemoRole(location.pathname, adminRole);

  function handleSelect(role: DemoRole, path: string) {
    if (pending || role === currentRole) return;
    setPending(true);
    // 시청 관리자·현장 담당자는 같은 경로(/admin)를 쓰고 첫 화면만 다르다 — 역할을 먼저 정한다.
    if (role !== 'citizen') setAdminRole(role === 'field' ? 'field' : 'admin');
    enterDemo();
    onClose();
    navigate(path);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-950/45 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-role-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-sheet bg-surface p-5 pb-[max(24px,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-card sm:pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="demo-role-sheet-title" className="text-section text-ink-950">
          시연 역할 전환
        </h2>
        <p className="mt-1 text-note text-ink-600">
          공모전 시연용 기능입니다. 실제 서비스에서는 계정 권한에 따라 화면이 자동 설정됩니다.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {DEMO_ROLES.map((role) => {
            const isCurrent = role.key === currentRole;
            return (
              <button
                key={role.key}
                type="button"
                onClick={() => handleSelect(role.key, role.path)}
                disabled={pending || isCurrent}
                aria-current={isCurrent ? 'true' : undefined}
                className={`tap-md flex items-center justify-between gap-2 rounded-control border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed focus-ring ${
                  isCurrent
                    ? 'border-brand-300 bg-brand-50'
                    : 'border-line-200 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-60'
                }`}
              >
                <span className="min-w-0">
                  <p className="text-body font-bold text-ink-950">{DEMO_ROLE_LABELS[role.key]}</p>
                  <p className="text-note text-ink-600">{role.description}</p>
                </span>
                {isCurrent && (
                  <span className="shrink-0 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                    현재
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="tap-md mt-3 w-full text-center text-note font-medium text-ink-600 focus-ring"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
