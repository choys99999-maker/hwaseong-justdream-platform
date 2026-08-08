import type { DistrictId, Region, RegionId } from '../../types';
import SiteStatusBadge from '../common/SiteStatusBadge';
import { districtRiskLevels } from '../../data/operationSummary';
import { formatNumber } from '../../utils/format';
import type { DistrictCentralSummary } from '../../utils/districtRollup';

interface RegionMapPlaceholderProps {
  regions: Region[];
  selectedId: RegionId | null;
  onSelect: (id: RegionId) => void;
  /** 중앙 저장소 집계. 아직 못 읽었으면 이용자 수를 '—' 로 둔다. */
  central?: Record<DistrictId, DistrictCentralSummary>;
}

/**
 * 구 선택용 카드 그리드.
 * 통합 대시보드가 실제 카카오맵으로 바뀌면서 이 UI는 '지역별 현황' 페이지에서 재사용한다.
 * 상태 배지는 지도 폴리곤과 같은 재고 위험도 기준을 쓴다.
 * 거점 수는 확정 시드에서, 이용자 수는 중앙 저장소에서 온다.
 */
export default function RegionMapPlaceholder({
  regions,
  selectedId,
  onSelect,
  central,
}: RegionMapPlaceholderProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {regions.map((region) => {
        const isSelected = region.id === selectedId;
        const userCount = central?.[region.id]?.userCount;
        return (
          <button
            key={region.id}
            type="button"
            onClick={() => onSelect(region.id)}
            aria-pressed={isSelected}
            className={`flex flex-col gap-2 rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
              isSelected
                ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500'
                : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-teal-50/30'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{region.name}</span>
              <SiteStatusBadge status={districtRiskLevels[region.id]} />
            </div>
            <p className="text-xs text-slate-500">
              운영 거점 {formatNumber(region.orgCount)}개소 · 이용자{' '}
              {userCount === undefined ? '—' : `${formatNumber(userCount)}명`}
            </p>
          </button>
        );
      })}
    </div>
  );
}
