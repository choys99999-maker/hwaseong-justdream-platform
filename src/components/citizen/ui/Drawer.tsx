import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  HandHeart,
  Info,
  MapPin,
  MessageSquare,
  PackagePlus,
  Phone,
  Search,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Brand from './Brand';
import DemoRoleSheet from '../../demo/DemoRoleSheet';
import { CITIZEN_HELP_PHONE } from '../../../data/citizenContact';
import { useAdminRole } from '../../../hooks/useAdminRole';
import { DEMO_ROLE_LABELS, getDemoRole } from '../../../hooks/useDemoMode';

interface MenuItem {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

/**
 * Drawer 는 부가기능을 숨겨 두는 곳이다 — 홈을 지도 하나로 비우기 위해 존재한다.
 * 각 줄은 아이콘 + 제목 + 한 줄 설명까지. 큰 promo 카드는 만들지 않는다.
 */
const MENU: MenuItem[] = [
  { to: '/', label: '그냥드림 찾기', desc: '지도에서 가까운 곳 보기', icon: MapPin },
  { to: '/items', label: '물품 찾기', desc: '필요한 물품이 있는 곳만 보기', icon: Search },
  { to: '/help', label: '도움 요청', desc: '직접 가기 어려울 때', icon: HandHeart },
  { to: '/donate', label: '물품 기부', desc: '사진 한 장으로 나누기', icon: PackagePlus },
  { to: '/info', label: '도움 정보', desc: '생활·주거·금융·노동 상담처', icon: Info },
  { to: '/feedback', label: '말 남기기', desc: '하고 싶은 말 전하기', icon: MessageSquare },
  { to: '/guide', label: '이용 안내', desc: '처음이라면 여기부터', icon: BookOpen },
];

/** 왼쪽으로 이만큼 끌면 닫는다. */
const DISMISS_PX = 80;

/**
 * 왼쪽에서 밀려 들어오는 전체 메뉴.
 * 닫는 방법은 X · 바깥 탭 · ESC · 스와이프 · 브라우저 뒤로가기 다섯 가지 모두 지원한다 —
 * 어느 쪽으로 닫아도 이상하지 않아야 한다.
 */
export default function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { role: adminRole } = useAdminRole();
  const currentDemoRole = getDemoRole(location.pathname, adminRole);
  const dragStart = useRef<number | null>(null);
  const pushedHistory = useRef(false);
  const [dragX, setDragX] = useState(0);
  const [demoOpen, setDemoOpen] = useState(false);

  // 열려 있는 동안 뒤 배경(지도)이 따라 움직이지 않게 문서 스크롤을 잠근다.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // 뒤로가기가 앱을 벗어나지 않고 Drawer 만 닫게 만든다.
  useEffect(() => {
    if (!open) return;
    const pathWhenOpened = window.location.pathname;
    window.history.pushState({ citizenDrawer: true }, '');
    pushedHistory.current = true;

    function onPop() {
      pushedHistory.current = false;
      onClose();
    }
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // 메뉴를 눌러 다른 페이지로 이동한 경우에 back() 을 부르면 그 이동 자체가 취소된다.
      if (pushedHistory.current) {
        pushedHistory.current = false;
        if (window.location.pathname === pathWhenOpened) window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('a, button')) return;
    dragStart.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragStart.current === null) return;
    setDragX(Math.min(0, e.clientX - dragStart.current));
  }

  function onPointerUp() {
    if (dragStart.current === null) return;
    const dragged = -dragX;
    dragStart.current = null;
    setDragX(0);
    if (dragged > DISMISS_PX) onClose();
  }

  function go(to: string) {
    onClose();
    navigate(to);
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-ink-950/45 transition-opacity duration-300 motion-reduce:transition-none ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <nav
        aria-label="전체 메뉴"
        style={{ transform: open ? `translateX(${dragX}px)` : 'translateX(-100%)' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="absolute inset-y-0 left-0 flex w-[84%] max-w-[330px] flex-col bg-surface shadow-float transition-transform duration-300 ease-out motion-reduce:transition-none"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line-100 px-4 py-3 pt-[max(14px,env(safe-area-inset-top))]">
          <Brand size="md" />
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-600 transition-colors hover:bg-line-100 focus-ring"
          >
            <X size={24} aria-hidden />
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {MENU.map(({ to, label, desc, icon: Icon }) => {
            const current = location.pathname === to;
            return (
              <li key={to}>
                <button
                  type="button"
                  onClick={() => go(to)}
                  aria-current={current ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-card px-3 py-3 text-left transition-colors focus-ring ${
                    current ? 'bg-brand-50' : 'hover:bg-line-100'
                  }`}
                >
                  <Icon
                    size={22}
                    className={`shrink-0 ${current ? 'text-brand-700' : 'text-ink-400'}`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-lead font-bold ${current ? 'text-brand-800' : 'text-ink-950'}`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 block truncate text-note text-ink-600">{desc}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-line-100 p-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <a
            href={`tel:${CITIZEN_HELP_PHONE}`}
            className="tap-lg flex items-center gap-3 rounded-card bg-brand-50 px-4 transition-colors hover:bg-brand-100 focus-ring"
          >
            <Phone size={22} className="shrink-0 text-brand-700" aria-hidden />
            <span>
              <span className="block text-body font-bold text-brand-800">전화로 도움받기</span>
              <span className="block text-note text-brand-700">{CITIZEN_HELP_PHONE}</span>
            </span>
          </a>
          {/*
            발표자·운영 담당자용 진입로. 시민이 쓸 기능이 아니라서 메뉴 목록과 분리하고
            가장 낮은 시각적 위계로 둔다.
          */}
          <div className="my-3 h-px bg-line-100" aria-hidden />
          <div>
            <p className="px-1 text-[11px] font-medium uppercase tracking-wide text-ink-300">
              DEMO · 역할 전환
            </p>
            <button
              type="button"
              onClick={() => setDemoOpen(true)}
              className="tap-md mt-1 flex w-full items-center justify-between gap-2 rounded-control px-1 py-2 text-left text-note text-ink-400 transition-colors hover:text-ink-600 focus-ring"
            >
              <span>👤 {DEMO_ROLE_LABELS[currentDemoRole]}</span>
              <ChevronRight size={14} className="shrink-0 text-ink-300" aria-hidden />
            </button>
          </div>
        </div>

        {/* 역할을 고르면 라우트가 바뀌므로 Drawer 도 같이 닫는다 — 새 화면 위에 남아 있으면 안 된다. */}
        <DemoRoleSheet
          open={demoOpen}
          onClose={() => {
            setDemoOpen(false);
            onClose();
          }}
        />
      </nav>
    </div>
  );
}
