import { useState } from 'react';

const SESSION_KEY = 'demo-role-guide-seen';
const LOCAL_KEY = 'demo-role-guide-hidden';

export default function DemoGuideModal() {
  const [dismissed, setDismissed] = useState(() => {
    return (
      localStorage.getItem(LOCAL_KEY) === 'true' ||
      sessionStorage.getItem(SESSION_KEY) === 'true'
    );
  });

  if (dismissed) return null;

  function confirm() {
    sessionStorage.setItem(SESSION_KEY, 'true');
    setDismissed(true);
  }

  function neverShow() {
    localStorage.setItem(LOCAL_KEY, 'true');
    setDismissed(true);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/50 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-guide-title"
    >
      <div className="w-full rounded-t-sheet bg-surface p-6 pb-[max(28px,env(safe-area-inset-bottom))] sm:max-w-sm sm:rounded-card sm:pb-6">
        <p className="mb-3 text-[11px] font-semibold tracking-wide text-brand-500">심사위원용 데모</p>
        <h2 id="demo-guide-title" className="text-section font-bold text-ink-950">
          다른 화면도 직접<br />확인해보세요
        </h2>
        <div className="mt-3 space-y-2 text-body text-ink-700">
          <p>
            이 데모에서는{' '}
            <strong className="font-semibold text-ink-950">
              시민 · 현장 담당자 · 시청 관리자 화면
            </strong>
            을 직접 전환해서 확인할 수 있습니다.
          </p>
          <p>
            사이드 메뉴 하단의{' '}
            <strong className="font-semibold text-ink-950">'다른 화면 보기'</strong>
            에서 언제든 변경할 수 있습니다.
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={confirm}
            className="tap-lg flex h-12 w-full items-center justify-center rounded-control bg-brand-600 font-semibold text-white transition-colors hover:bg-brand-700 active:bg-brand-800 focus-ring"
          >
            확인
          </button>
          <button
            type="button"
            onClick={neverShow}
            className="tap-lg flex h-12 w-full items-center justify-center rounded-control font-medium text-ink-500 transition-colors hover:text-ink-700 focus-ring"
          >
            다시 보지 않기
          </button>
        </div>
      </div>
    </div>
  );
}
