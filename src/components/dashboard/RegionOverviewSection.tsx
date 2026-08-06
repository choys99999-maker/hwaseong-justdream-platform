import { useState } from 'react';
import type { RegionId } from '../../types';
import { mockRegions } from '../../data/mockRegions';
import RegionMapPlaceholder from '../region/RegionMapPlaceholder';
import RegionDetailPanel from '../region/RegionDetailPanel';

export default function RegionOverviewSection() {
  const [selectedId, setSelectedId] = useState<RegionId>(mockRegions[0].id);
  const selectedRegion = mockRegions.find((region) => region.id === selectedId) ?? null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">화성시 지역 운영 현황</h3>
        <p className="mt-1 text-sm text-slate-500">권역을 선택하면 상세 운영 현황을 확인할 수 있습니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RegionMapPlaceholder regions={mockRegions} selectedId={selectedId} onSelect={setSelectedId} />
        <RegionDetailPanel region={selectedRegion} />
      </div>
    </section>
  );
}
