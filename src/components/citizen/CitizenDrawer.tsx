import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Gift, HeartHandshake, Info, MessageCircle, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface CitizenDrawerProps {
  open: boolean;
  onClose: () => void;
}

const MENU: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/help', label: '도움 요청', icon: HeartHandshake },
  { to: '/donate', label: '물품 기부', icon: Gift },
  { to: '/info', label: '도움 정보', icon: Info },
  { to: '/feedback', label: '말 남기기', icon: MessageCircle },
  { to: '/guide', label: '이용 안내', icon: BookOpen },
];

/** 왼쪽으로 끌면 한 단계 내려간다(닫힌다). CitizenSheet의 드래그 처리와 같은 원칙. */
const DISMISS_PX = 80;

/**
 * 홈 좌측 상단 햄버거로 여는 메뉴. 지도를 가리지 않고 왼쪽에서만 슬라이드해 들어온다.
 * 열려 있는 동안 배경을 dim 하고 body 스크롤을 잠근다. 닫는 방법은 X·바깥 탭·ESC·스와이프·
 * 브라우저 뒤로가기 다섯 가지 모두를 지원한다 — 어느 쪽으로 닫아도 이상하지 않아야 한다.
 */
export default function CitizenDrawer({ open, onClose }: CitizenDrawerProps) {
  const dragStartRef = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const pushedHistoryRef = useRef(false);

  // body 스크롤 잠금 — 열려 있는 동안 지도가 뒤에서 움직이지 않게 한다.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // ESC로 닫기.
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  // 브라우저 뒤로가기가 앱을 벗어나지 않고 Drawer만 닫게 만든다 — 열릴 때 더미 history를 쌓고,
  // popstate가 오면(=사용자가 뒤로가기를 눌렀으면) 그 엔트리를 소비한 것이므로 닫기만 한다.
  useEffect(() => {
    if (!open) return;
    const pathnameWhenOpened = window.location.pathname;
    window.history.pushState({ citizenDrawer: true }, '');
    pushedHistoryRef.current = true;
    function handlePopState() {
      pushedHistoryRef.current = false;
      onClose();
    }
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      // X·바깥 탭·ESC·스와이프로 닫혔고, 그사이 메뉴 항목 클릭으로 다른 페이지로 이동하지
      // *않았을* 때만 더미 엔트리를 되돌린다 — 이동한 경우에 back()을 부르면 그 이동 자체가
      // 취소돼 버린다(뒤로 가서 더미 엔트리로 돌아가므로).
      if (pushedHistoryRef.current) {
        pushedHistoryRef.current = false;
        if (window.location.pathname === pathnameWhenOpened) window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handlePointerDown(event: React.PointerEvent) {
    // 링크·버튼 위에서 시작한 pointerdown은 스와이프로 잡지 않는다 — 여기서 캡처하면
    // 눌러도 click 이벤트가 원래 대상(메뉴 항목)까지 가지 못한다.
    if ((event.target as HTMLElement).closest('a, button')) return;
    dragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (dragStartRef.current === null) return;
    setDragX(Math.min(0, event.clientX - dragStartRef.current));
  }

  function handlePointerUp() {
    if (dragStartRef.current === null) return;
    const dragged = -dragX;
    dragStartRef.current = null;
    setDragX(0);
    if (dragged > DISMISS_PX) onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/45 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <nav
        aria-label="메뉴"
        style={{ transform: open ? `translateX(${dragX}px)` : 'translateX(-100%)' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="absolute inset-y-0 left-0 flex w-[78%] max-w-[320px] flex-col bg-white pt-[env(safe-area-inset-top)] shadow-[8px_0_28px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out motion-reduce:transition-none"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <span className="text-lg font-bold text-teal-800">모아드림</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="flex h-12 w-12 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={24} aria-hidden />
          </button>
        </div>

        <ul className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-[max(20px,env(safe-area-inset-bottom))]">
          {MENU.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                onClick={onClose}
                className="flex min-h-[56px] items-center gap-3 rounded-xl px-3 text-lg font-semibold text-slate-800 hover:bg-teal-50 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
              >
                <Icon size={22} className="shrink-0 text-teal-700" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
