import { Outlet } from 'react-router-dom';

/**
 * 시민 화면 공통 셸. 390×844 기준 모바일 퍼스트 — 폭을 480px로 제한해 데스크톱에서도
 * 같은 레이아웃을 유지한다. 관리자 사이드바·헤더는 쓰지 않는다(별도 앱처럼 보여야 한다).
 * 기본 본문 글자 크기 18px 를 여기 한 곳에서 강제해 화면마다 따로 신경 쓰지 않게 한다.
 */
export default function CitizenLayout() {
  return (
    <div className="min-h-dvh bg-slate-50 text-[18px] leading-relaxed text-slate-900">
      <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-white">
        <Outlet />
      </div>
    </div>
  );
}
