import { X } from 'lucide-react';
import { AREA_LIST, type AreaCentroid } from '../../data/mockSites';
import { REGION_NAMES, REGION_ORDER } from '../../data/regionMeta';

interface DongPickerProps {
  onSelect: (area: AreaCentroid) => void;
  onClose: () => void;
}

/** "사는 동네 선택하기" — 자유 입력 대신 큰 선택 버튼 목록으로만 고른다. */
export default function DongPicker({ onSelect, onClose }: DongPickerProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">사는 동네를 선택해 주세요</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-12 w-12 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <X size={24} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {REGION_ORDER.map((district) => {
          const areas = AREA_LIST.filter((a) => a.district === district);
          if (areas.length === 0) return null;
          return (
            <section key={district}>
              <h3 className="mb-2 text-base font-semibold text-slate-500">{REGION_NAMES[district]}</h3>
              <div className="grid grid-cols-2 gap-2.5">
                {areas.map((area) => (
                  <button
                    key={area.area}
                    type="button"
                    onClick={() => onSelect(area)}
                    className="min-h-[52px] rounded-xl border-2 border-slate-200 bg-white px-3 py-3 text-lg font-semibold text-slate-800 hover:border-teal-500 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
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
