import { useCallback, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import Drawer from '../citizen/ui/Drawer';

interface CitizenShell {
  openDrawer: () => void;
}

/** 어느 시민 화면에서든 전체 메뉴를 열 수 있게 해 주는 셸 컨텍스트. */
export function useCitizenShell(): CitizenShell {
  return useOutletContext<CitizenShell>();
}

/**
 * 시민 화면 공통 셸. 390×844 를 기준으로 잡고 폭을 480px 로 제한해 데스크톱에서도
 * 같은 세로형 레이아웃을 유지한다.
 *
 * 첫 화면이 "지도 + 그 위 시트" 라 셸 자체가 화면 높이에 고정돼야 한다(문서 스크롤 금지).
 * 안전영역(노치·홈 인디케이터)과 기본 본문 크기(17px)를 여기서 한 번만 처리해
 * 화면마다 다시 신경 쓰지 않게 한다.
 */
export default function CitizenLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);

  return (
    <div className="h-dvh bg-paper text-body text-ink-950">
      <div className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden bg-surface">
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          <Outlet context={{ openDrawer } satisfies CitizenShell} />
        </main>
      </div>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
