import { Outlet } from 'react-router-dom';
import DemoRoleSwitcher from '../demo/DemoRoleSwitcher';

/**
 * 시민 화면 공통 셸. 390×844 기준 모바일 퍼스트 — 폭을 480px로 제한해 데스크톱에서도
 * 같은 레이아웃(세로형 앱)을 유지한다. 관리자 사이드바·헤더는 쓰지 않는다.
 *
 * 첫 화면이 "지도 + 그 위 시트" 라서 셸 자체가 화면 높이에 고정돼야 한다(문서 스크롤 금지).
 * 그래서 높이를 dvh 로 잡고 스크롤은 본문 영역이 각자 갖는다. 안전영역(노치·홈 인디케이터)은
 * 여기서 한 번만 처리해 화면마다 다시 신경 쓰지 않게 한다.
 * 기본 본문 글자 크기 18px 도 이 한 곳에서 강제한다.
 */
export default function CitizenLayout() {
  return (
    <div className="h-dvh bg-slate-100 text-[18px] leading-relaxed text-slate-900">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-white pt-[env(safe-area-inset-top)]">
        <DemoRoleSwitcher />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
