import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ROLES, useDemoMode } from '../../hooks/useDemoMode';

interface DemoRoleSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 역할 선택 시트. Drawer 아래쪽 "시연 모드" 와 전환바의 "역할 변경" 이 함께 쓴다.
 * 여기서 역할을 고른 시점에만 demoMode 가 켜진다 — 시트를 열기만 해서는 켜지지 않는다.
 */
export default function DemoRoleSheet({ open, onClose }: DemoRoleSheetProps) {
  const { enterDemo } = useDemoMode();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) setPending(false);
  }, [open]);

  if (!open) return null;

  function handleSelect(path: string) {
    if (pending) return;
    setPending(true);
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
          그냥드림 시연하기
        </h2>
        <p className="mt-1 text-note text-ink-600">
          시민부터 현장 담당자, 시청 관리자까지 하나의 흐름을 확인할 수 있어요.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {DEMO_ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => handleSelect(role.path)}
              disabled={pending}
              className="tap-md rounded-control border border-line-200 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
            >
              <p className="text-body font-bold text-ink-950">{role.label}</p>
              <p className="text-note text-ink-600">{role.description}</p>
            </button>
          ))}
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
