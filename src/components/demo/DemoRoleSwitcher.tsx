import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ROLES, DEMO_ROLE_LABELS, getDemoRoleFromPath, useDemoMode } from '../../hooks/useDemoMode';
import DemoRoleSheet from './DemoRoleSheet';

/**
 * demoMode=true일 때만 시민/관리자 레이아웃 상단에 뜨는 고정 전환바.
 * 일반 시민에게는 절대 노출되지 않는다 — useDemoMode가 false를 돌려주면 아무것도 렌더하지 않는다.
 * CitizenLayout·AdminLayout 최상단에서만 조건부 렌더링해 각 화면 자체는 손대지 않는다.
 */
export default function DemoRoleSwitcher() {
  const { isDemoMode, exitDemo } = useDemoMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 라우트 이동이 끝나면(경로가 바뀌면) 다음 클릭을 다시 받을 수 있게 pending을 푼다.
  useEffect(() => {
    setPending(false);
  }, [location.pathname]);

  if (!isDemoMode) return null;

  const currentRole = getDemoRoleFromPath(location.pathname);

  function goTo(path: string) {
    if (pending) return;
    setPending(true);
    navigate(path);
  }

  function handleExit() {
    if (pending) return;
    setPending(true);
    exitDemo();
    navigate('/');
  }

  return (
    <div className="sticky top-0 z-40 flex min-h-[44px] items-center gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-sm">
      <span className="shrink-0 font-semibold text-amber-900">시연 중</span>
      <span className="shrink-0 text-amber-300" aria-hidden="true">
        ·
      </span>

      {/* 640px 이상 — 역할 3개를 모두 버튼으로 노출 */}
      <div className="hidden flex-1 items-center gap-1.5 overflow-x-auto sm:flex">
        {DEMO_ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => goTo(role.path)}
            disabled={pending}
            aria-pressed={role.key === currentRole}
            className={`min-h-[40px] shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              role.key === currentRole ? 'bg-amber-600 text-white' : 'bg-white text-amber-800 hover:bg-amber-100'
            }`}
          >
            {DEMO_ROLE_LABELS[role.key]}
          </button>
        ))}
      </div>

      {/* 640px 미만 — 현재 역할 텍스트 + 역할 변경 버튼으로 축약해 본문·핵심 CTA를 가리지 않는다 */}
      <div className="flex flex-1 items-center gap-2 overflow-hidden sm:hidden">
        <span className="truncate font-medium text-amber-900">{DEMO_ROLE_LABELS[currentRole]}</span>
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="min-h-[40px] shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
        >
          역할 변경
        </button>
      </div>

      <button
        type="button"
        onClick={handleExit}
        disabled={pending}
        className="min-h-[40px] shrink-0 rounded-full border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        종료
      </button>

      <DemoRoleSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </div>
  );
}
