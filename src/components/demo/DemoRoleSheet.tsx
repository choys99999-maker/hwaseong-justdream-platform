import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_ROLES, useDemoMode, type DemoRole } from '../../hooks/useDemoMode';
import { setAdminRole } from '../../hooks/useAdminRole';

interface DemoRoleSheetProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 역할 선택 bottom sheet. 시민 홈의 "시연 모드" 진입 버튼과 전환바의 "역할 변경" 버튼이 함께 쓴다.
 * 여기서 역할을 고른 시점에만 demoMode가 켜진다 — 시트를 열기만 해서는 켜지지 않는다.
 */
export default function DemoRoleSheet({ open, onClose }: DemoRoleSheetProps) {
  const { enterDemo } = useDemoMode();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (open) setPending(false);
  }, [open]);

  if (!open) return null;

  function handleSelect(role: DemoRole, path: string) {
    if (pending) return;
    setPending(true);
    // 시청 관리자·현장 담당자는 같은 경로(/admin)를 쓰고 첫 화면만 다르다 — 역할을 먼저 정한다.
    if (role !== 'citizen') setAdminRole(role === 'field' ? 'field' : 'admin');
    enterDemo();
    onClose();
    navigate(path);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-role-sheet-title"
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-2xl bg-white p-5 pb-8 sm:max-w-sm sm:rounded-2xl sm:pb-5"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="demo-role-sheet-title" className="text-lg font-bold text-slate-900">
          모아드림 시연하기
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          시민부터 현장 담당자, 시청 관리자까지 하나의 흐름을 확인할 수 있어요.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {DEMO_ROLES.map((role) => (
            <button
              key={role.key}
              type="button"
              onClick={() => handleSelect(role.key, role.path)}
              disabled={pending}
              className="min-h-[48px] rounded-xl border border-slate-200 px-4 py-3 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <p className="font-semibold text-slate-900">{role.label}</p>
              <p className="text-sm text-slate-500">{role.description}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 min-h-[44px] w-full text-center text-sm font-medium text-slate-400"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
