import type { DistrictId, SiteStatus } from '../../types';
import { REGION_NAMES, REGION_ORDER, SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';

interface DistrictFilterProps {
  selectedDistrict: DistrictId | null;
  districtRiskLevels: Record<DistrictId, SiteStatus>;
  onSelect: (district: DistrictId | null) => void;
  /** true 이면 버튼을 더 작게 렌더링한다. */
  compact?: boolean;
}

/** 지도 위 구 필터. 폴리곤 선택 상태와 항상 같은 값을 공유한다. */
export default function DistrictFilter({ selectedDistrict, districtRiskLevels, onSelect, compact }: DistrictFilterProps) {
  const baseClass = compact
    ? 'inline-flex shrink-0 items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500'
    : 'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500';

  return (
    <div className="flex flex-wrap gap-1.5 overflow-x-auto" role="group" aria-label="구역 필터">
      <button
        type="button"
        onClick={() => onSelect(null)}
        aria-pressed={selectedDistrict === null}
        className={`${baseClass} ${
          selectedDistrict === null
            ? 'border-teal-500 bg-teal-50 text-teal-700'
            : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50/40'
        }`}
      >
        전체
      </button>

      {REGION_ORDER.map((id) => {
        const risk = districtRiskLevels[id];
        const isSelected = selectedDistrict === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isSelected}
            className={`${baseClass} ${
              isSelected
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50/40'
            }`}
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
              style={{ backgroundColor: SITE_STATUS_COLORS[risk].fill }}
            />
            {REGION_NAMES[id]}
            <span className="sr-only">{` 운영 상태 ${SITE_STATUS_LABELS[risk]}`}</span>
          </button>
        );
      })}
    </div>
  );
}
