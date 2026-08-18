import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, UserCircle } from 'lucide-react';
import { ADMIN_ROLE_LABELS, setAdminRole, useAdminRole } from '../../hooks/useAdminRole';
import { DEMO_ROLES, DEMO_ROLE_LABELS, getDemoRole, type DemoRole } from '../../hooks/useDemoMode';
import DemoRoleSheet from '../demo/DemoRoleSheet';

interface HeaderProps {
  title: string;
}

/** 이 폭 아래에서는 팝오버 대신 시민 화면과 같은 Bottom Sheet로 역할을 고른다. */
const NARROW_QUERY = '(max-width: 639px)';

function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isNarrow;
}

/**
 * 상단 바. 현재 역할 하나만 보여주고, 눌러야 역할 전환 UI가 나온다.
 *
 * 예전에는 "시민·현장 담당자·시청 관리자" pill 버튼이 항상 떠 있어 개발용 데모 화면처럼
 * 보였다. 지금은 프로필 버튼 하나 + 조용한 DEMO 표시만 남기고, 역할 전환은 그 버튼을 눌러야
 * 나오는 팝오버(넓은 화면)·시트(좁은 화면)에서 한다. 시트는 시민 Drawer의 "DEMO · 역할 전환"과
 * 같은 컴포넌트(DemoRoleSheet)를 그대로 쓴다 — 두 벌 만들지 않는다.
 */
export default function Header({ title }: HeaderProps) {
  const { role } = useAdminRole();
  const location = useLocation();
  const navigate = useNavigate();
  const isNarrow = useIsNarrowViewport();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const currentDemoRole = getDemoRole(location.pathname, role);

  useEffect(() => {
    if (!isOpen || isNarrow) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!popoverRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, isNarrow]);

  function goTo(nextRole: DemoRole, path: string) {
    if (nextRole !== 'citizen') setAdminRole(nextRole === 'field' ? 'field' : 'admin');
    setIsOpen(false);
    navigate(path);
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
          DEMO · 공모전 시연용
        </span>
      </div>

      <div ref={popoverRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`현재 역할 ${ADMIN_ROLE_LABELS[role]} · 역할 전환`}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <UserCircle size={20} className="text-slate-400" />
          <span className="hidden sm:inline">{ADMIN_ROLE_LABELS[role]}</span>
          <ChevronDown size={14} className="text-slate-400" aria-hidden />
        </button>

        {isOpen && !isNarrow && (
          <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <p className="text-sm font-semibold text-slate-900">시연 역할 전환</p>
            <p className="mt-1.5 rounded-md bg-slate-50 px-2.5 py-2 text-xs leading-relaxed text-slate-500">
              시연용 역할 전환입니다. 실제 서비스에서는 계정 권한에 따라 자동 적용됩니다.
            </p>
            <ul className="mt-2 space-y-1">
              {DEMO_ROLES.map((demoRole) => {
                const isCurrent = demoRole.key === currentDemoRole;
                return (
                  <li key={demoRole.key}>
                    <button
                      type="button"
                      onClick={() => !isCurrent && goTo(demoRole.key, demoRole.path)}
                      disabled={isCurrent}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                        isCurrent ? 'cursor-default bg-teal-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{DEMO_ROLE_LABELS[demoRole.key]}</span>
                        <span className="block text-xs text-slate-500">{demoRole.description}</span>
                      </span>
                      {isCurrent && (
                        <span className="shrink-0 rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-semibold text-white">
                          현재
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {isNarrow && <DemoRoleSheet open={isOpen} onClose={() => setIsOpen(false)} />}
    </header>
  );
}
