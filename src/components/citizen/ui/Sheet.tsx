import { useEffect, useRef, useState, type ReactNode } from 'react';

/** 이만큼 아래로 끌면 닫는다. 라이브러리 없이 pointer 이벤트만 쓴다. */
const DISMISS_PX = 72;

interface SheetProps {
  children: ReactNode;
  /** 손잡이를 끌거나 눌렀을 때 할 일. null 이면 내릴 단계가 없다. */
  onDismiss: (() => void) | null;
  /** 시트가 실제로 차지한 높이(px). 지도가 이 값만큼 아래 여백을 잡아 핀이 가려지지 않게 한다. */
  onHeightChange?: (height: number) => void;
  /** 화면 높이 대비 최대 비율. */
  maxHeightRatio?: number;
  labelledBy?: string;
}

/**
 * 지도 위에 떠 있는 bottom sheet.
 *
 * 시트를 쓰는 이유는 페이지를 새로 열지 않기 위해서다 — 지도와의 공간 감각이 끊기지 않아야
 * "내 위치에서 여기" 라는 관계가 계속 읽힌다. 제스처는 손잡이를 아래로 끄는 것 하나뿐이고,
 * 같은 동작을 손잡이 탭으로도 할 수 있게 둔다(제스처를 모르는 사용자를 막지 않는다).
 */
export default function Sheet({
  children,
  onDismiss,
  onHeightChange,
  maxHeightRatio = 0.76,
  labelledBy,
}: SheetProps) {
  const ref = useRef<HTMLElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !onHeightChange) return;
    // 시트가 실제로 덮는 높이는 padding 을 포함한 테두리 상자다(contentRect 는 그보다 작다).
    const observer = new ResizeObserver(() => {
      onHeightChange(Math.round(el.getBoundingClientRect().height));
    });
    observer.observe(el);
    onHeightChange(Math.round(el.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [onHeightChange]);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!onDismiss) return;
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStart.current === null) return;
    setDragY(Math.max(0, e.clientY - dragStart.current));
  }

  function onPointerUp() {
    if (dragStart.current === null) return;
    const dragged = dragY;
    dragStart.current = null;
    setDragY(0);
    if (dragged > DISMISS_PX) onDismiss?.();
  }

  return (
    <section
      ref={ref}
      aria-labelledby={labelledBy}
      style={{
        // 화면이 아주 낮을 때(200% 확대·가로 모드)도 시트 안에서 스크롤해 쓸 수 있게 최솟값을 둔다.
        maxHeight: `max(${Math.round(maxHeightRatio * 100)}%, 260px)`,
        transform: dragY ? `translateY(${dragY}px)` : undefined,
      }}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet bg-surface shadow-float transition-[max-height] duration-300 ease-out motion-reduce:transition-none"
    >
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => onDismiss?.()}
        disabled={!onDismiss}
        aria-label={onDismiss ? '닫기' : undefined}
        aria-hidden={onDismiss ? undefined : true}
        tabIndex={onDismiss ? undefined : -1}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center disabled:cursor-default focus-ring"
      >
        <span className="h-1.5 w-11 rounded-full bg-line-200" />
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(20px,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </section>
  );
}
