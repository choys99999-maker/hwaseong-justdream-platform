import type { Region, RegionId } from '../../types';
import StatusBadge from '../common/StatusBadge';
import { formatNumber } from '../../utils/format';

const GRID_AREA: Record<RegionId, string> = {
  seobu: 'seobu',
  jungbu: 'jungbu',
  dongbu: 'dongbu',
  nambu: 'nambu',
  dongtan: 'dongtan',
};

interface RegionMapPlaceholderProps {
  regions: Region[];
  selectedId: RegionId | null;
  onSelect: (id: RegionId) => void;
}

export default function RegionMapPlaceholder({ regions, selectedId, onSelect }: RegionMapPlaceholderProps) {
  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gridTemplateAreas: '"seobu jungbu dongbu" ". nambu dongtan"',
      }}
    >
      {regions.map((region) => {
        const isSelected = region.id === selectedId;
        return (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region.id)}
            style={{ gridArea: GRID_AREA[region.id] }}
            className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isSelected
                ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500'
                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-900">{region.name}</span>
              <StatusBadge status={region.status} />
            </div>
            <p className="text-xs text-slate-500">이용자 {formatNumber(region.userCount)}명</p>
          </button>
        );
      })}
    </div>
  );
}
