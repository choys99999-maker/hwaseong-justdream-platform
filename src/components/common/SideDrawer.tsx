import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SideDrawerProps {
  title: string;
  /** 제목 아래 한 줄 설명 */
  description?: string;
  /** 제목 옆에 붙는 배지 등 */
  titleAside?: ReactNode;
  width?: 'md' | 'lg';
  onClose: () => void;
  children: ReactNode;
}

/**
 * 오른쪽에서 열리는 상세 패널.
 *
 * 목록에서 무언가를 고르거나 값을 고칠 때 **페이지를 새로 열지 않기 위해** 쓴다.
 * `목록 → 페이지 → 탭 → 또 다른 페이지` 대신 `목록 → 오른쪽 패널` 한 단계로 끝낸다.
 * 재고 목록의 품목 드로어와 같은 겉모습(흰 배경·좌측 그림자·ESC 닫기)을 따른다.
 */
export default function SideDrawer({
  title,
  description,
  titleAside,
  width = 'md',
  onClose,
  children,
}: SideDrawerProps) {
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
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl ${
          width === 'lg' ? 'max-w-xl' : 'max-w-sm'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
              {titleAside}
            </div>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </aside>
    </>
  );
}
