import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  /**
   * 뒤로가기 대신 특정 경로로 보내야 할 때만 준다. 기본은 브라우저 뒤로가기 —
   * 사용자가 온 길로 그대로 돌아가는 것이 모바일에서 가장 예측 가능하다.
   */
  backTo?: string;
  onBack?: () => void;
  /** 제목 오른쪽 보조 영역. 웬만하면 비워 둔다. */
  action?: ReactNode;
}

/**
 * 모든 시민 서브 페이지가 쓰는 단 하나의 상단 내비게이션 — `←` + 페이지 제목.
 *
 * 화면마다 다른 뒤로가기(거대한 "지도로 돌아가기" 알약, 텍스트 링크, 시트 안 버튼)를 없애고
 * 여기로 모은다. 뒤로가기 버튼은 아이콘만 보이지만 48×48 터치 영역과 스크린리더 라벨을 갖고,
 * 바로 옆 제목이 지금 어디인지 말해 준다.
 */
export default function AppHeader({ title, backTo, onBack, action }: AppHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleBack() {
    if (onBack) return onBack();
    if (backTo) return navigate(backTo);
    // 직접 링크로 들어와 뒤로 갈 곳이 없으면 지도(홈)로 보낸다 — 앱 밖으로 튕기지 않게.
    if (location.key === 'default') return navigate('/');
    navigate(-1);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line-100 bg-surface/95 backdrop-blur-sm">
      <div className="flex items-center gap-1 px-2 py-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleBack}
          aria-label="뒤로 가기"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-ring"
        >
          <ArrowLeft size={24} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-section text-ink-950">{title}</h1>
        {action && <div className="shrink-0 pr-1">{action}</div>}
      </div>
    </header>
  );
}
