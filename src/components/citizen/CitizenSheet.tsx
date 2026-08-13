import { useEffect, useRef, useState, type ReactNode } from 'react';

/** 이만큼 아래로 끌면 한 단계 내려간다. 라이브러리 없이 pointer 이벤트만으로 처리한다. */
const DISMISS_PX = 72;

interface CitizenSheetProps {
  children: ReactNode;
  /** 시트가 실제로 차지한 높이(px). 지도가 이 값을 아래 여백으로 써서 핀이 가려지지 않게 한다. */
  onHeightChange: (height: number) => void;
  /** 손잡이를 아래로 끌거나 눌렀을 때 돌아갈 이전 단계. null 이면 내릴 단계가 없다(첫 화면). */
  onDismiss: (() => void) | null;
  /** 화면 높이 대비 최대 비율. 단계마다 다르다(첫 화면 45% ~ 도움 요청 88%). */
  maxHeightRatio: number;
  labelledBy: string;
}

/**
 * 지도 위에 떠 있는 시민용 bottom sheet.
 *
 * 모든 단계(첫 CTA · 추천 · 거점 상세 · 도움 요청)가 이 한 장 안에서 바뀐다 —
 * 페이지를 새로 열지 않으므로 "지도 위 어디" 라는 공간 감각이 끊기지 않는다.
 * 제스처는 손잡이를 아래로 끄는 것 하나뿐이고, 같은 동작을 버튼으로도 할 수 있게 둔다.
 */
export default function CitizenSheet({
  children,
  onHeightChange,
  onDismiss,
  maxHeightRatio,
  labelledBy,
}: CitizenSheetProps) {
  const ref = useRef<HTMLElement>(null);
  const dragStartRef = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  // 시트 높이를 지도에 알려 준다 — 단계가 바뀌면 내용 높이가 달라지므로 관찰이 필요하다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      onHeightChange(Math.round(entry.contentRect.height));
    });
    observer.observe(el);
    onHeightChange(Math.round(el.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [onHeightChange]);

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!onDismiss) return;
    dragStartRef.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (dragStartRef.current === null) return;
    setDragY(Math.max(0, event.clientY - dragStartRef.current));
  }

  function handlePointerUp() {
    if (dragStartRef.current === null) return;
    const dragged = dragY;
    dragStartRef.current = null;
    setDragY(0);
    if (dragged > DISMISS_PX) onDismiss?.();
  }

  return (
    <section
      ref={ref}
      aria-labelledby={labelledBy}
      style={{
        // 화면이 아주 낮을 때(200% 확대·가로 모드)는 비율만 따르면 첫 CTA 가 시트 밖으로 밀린다.
        // 최소 높이를 함께 두고, 넘치는 만큼은 시트 안에서 스크롤한다.
        maxHeight: `max(${Math.round(maxHeightRatio * 100)}%, 300px)`,
        transform: dragY ? `translateY(${dragY}px)` : undefined,
      }}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[26px] bg-white shadow-[0_-8px_28px_rgba(15,23,42,0.18)] transition-[max-height] duration-300 ease-out motion-reduce:transition-none"
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={() => onDismiss?.()}
        disabled={!onDismiss}
        aria-label={onDismiss ? '이전으로 돌아가기' : undefined}
        aria-hidden={onDismiss ? undefined : true}
        tabIndex={onDismiss ? undefined : -1}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center disabled:cursor-default"
      >
        <span className="h-1.5 w-11 rounded-full bg-slate-300" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </section>
  );
}
