import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import InventoryUpdatePanel from './InventoryUpdatePanel';
import { useCentralData } from '../../hooks/useCentralData';
import { listInventoryStatus } from '../../store/analytics';

interface InventoryUpdateModalProps {
  onClose: () => void;
  /** 반영 후 거점 관리 화면(재고 목록)이 다시 읽게 한다. */
  onApplied: () => void;
}

/**
 * AI 재고 업데이트 — 시청 관리자가 재고를 고치는 **유일한 입구**.
 *
 * 거점 관리 화면 오른쪽 위 [✨ AI 재고 업데이트] 하나로만 열린다. 예전엔 오른쪽 Drawer였지만,
 * 이 기능의 핵심은 "AI가 문장을 이해해 정리해준다"는 것이라 화면 가장자리로 밀어두지 않고
 * 가운데 modal로 크게 띄운다. 안에서 자연어(빠른 수정)와 Excel(대량 수정)이 갈리는 것은 그대로다.
 */
export default function InventoryUpdateModal({ onClose, onApplied }: InventoryUpdateModalProps) {
  const { data } = useCentralData(() => listInventoryStatus(), []);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    closeRef.current?.focus();
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/[0.32]" onClick={onClose} aria-hidden />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI 재고 업데이트"
          onClick={(e) => e.stopPropagation()}
          className="ad-rise flex w-full max-w-[820px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl"
          style={{ maxHeight: '86vh' }}
        >
          <div className="flex items-center justify-end px-4 pt-4">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-1 sm:px-8">
            <InventoryUpdatePanel inventory={data ?? []} onApplied={onApplied} onClose={onClose} />
          </div>
        </div>
      </div>
    </>
  );
}
