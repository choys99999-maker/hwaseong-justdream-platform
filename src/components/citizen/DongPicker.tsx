import { useEffect } from 'react';
import { X } from 'lucide-react';
import { AREA_LIST, type AreaCentroid } from '../../data/mockSites';
import { REGION_NAMES, REGION_ORDER } from '../../data/regionMeta';

interface DongPickerProps {
  onSelect: (area: AreaCentroid) => void;
  onClose: () => void;
}

/**
 * "동네로 찾기" — 위치 권한 없이도 시작할 수 있는 유일한 길이라 자유 입력 대신
 * 큰 버튼 목록으로만 고르게 한다. 오타·검색어 고민 없이 자기 동네를 눈으로 찾으면 된다.
 */
export default function DongPicker({ onSelect, onClose }: DongPickerProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="사는 동네 선택"
      className="fixed inset-0 z-50 flex flex-col bg-surface"
    >
      <div className="flex items-center gap-1 border-b border-line-100 px-2 py-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-800 transition-colors hover:bg-line-100 focus-ring"
        >
          <X size={24} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-section text-ink-950">어느 동네에 계세요?</h1>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        {REGION_ORDER.map((district) => {
          const areas = AREA_LIST.filter((a) => a.district === district);
          if (areas.length === 0) return null;
          return (
            <section key={district}>
              <h2 className="mb-2 text-note font-bold text-ink-600">{REGION_NAMES[district]}</h2>
              <div className="grid grid-cols-2 gap-2">
                {areas.map((area) => (
                  <button
                    key={area.area}
                    type="button"
                    onClick={() => onSelect(area)}
                    className="tap-lg rounded-control border border-line-200 bg-surface px-3 text-body font-semibold text-ink-950 transition-colors hover:border-brand-300 hover:bg-brand-50 focus-ring"
                  >
                    {area.area}
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
