import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

const TITLE_MAP: Record<string, string> = {
  '/': '그냥드림',
  '/map': '내 주변 그냥드림 찾기',
  '/items': '물품 찾기',
  '/help': '도움 요청',
  '/info': '도움 정보',
  '/feedback': '말 남기기',
  '/guide': '이용 안내',
};

function getTitle(pathname: string): string {
  if (pathname.startsWith('/site/')) return '지점 상세';
  return TITLE_MAP[pathname] ?? '그냥드림';
}

export default function CitizenLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/';
  const isMap = location.pathname === '/map';
  const title = getTitle(location.pathname);

  return (
    <div className="flex flex-col bg-white" style={{ height: '100dvh' }}>
      {/* 상단 바 */}
      <header className="flex-none flex items-center justify-between px-4 bg-white border-b border-slate-100 shadow-sm z-30" style={{ height: '56px' }}>
        <div className="flex items-center gap-2">
          {!isHome && (
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label="뒤로 가기"
              className="flex items-center justify-center w-10 h-10 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <ChevronLeft size={24} strokeWidth={2.5} />
            </button>
          )}
          <span className="text-lg font-bold text-slate-900">{title}</span>
        </div>

        <div className="flex items-center gap-1">
          {!isHome && (
            <button
              type="button"
              onClick={() => navigate('/')}
              aria-label="홈으로"
              className="flex items-center justify-center w-10 h-10 rounded-full text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors"
            >
              <Home size={20} />
            </button>
          )}
        </div>
      </header>

      {/* 본문 */}
      <main className={`flex-1 min-h-0 ${isMap ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <Outlet />
      </main>
    </div>
  );
}
