import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { getPageTitle } from '../../config/navigation';

export default function AdminLayout() {
  const location = useLocation();
  const title = getPageTitle(location.pathname);

  return (
    // 캔버스는 완전한 흰색이 아니다 — 흰 카드가 배경 위에 떠 보이도록 살짝 푸른 회색을 깐다.
    <div className="flex h-screen bg-[#F3F6FA]">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header title={title} />
        <main className="flex-1 overflow-y-auto bg-[#F3F6FA] px-6 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
