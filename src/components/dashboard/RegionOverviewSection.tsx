import { useEffect, useState } from 'react';
import type { Region, RegionId } from '../../types';
import RegionMapPlaceholder from '../region/RegionMapPlaceholder';
import RegionDetailPanel from '../region/RegionDetailPanel';

interface Props {
  regions: Region[];
}

export default function RegionOverviewSection({ regions }: Props) {
  const [selectedId, setSelectedId] = useState<RegionId>(regions[0]?.id ?? 'seobu');

  // 관리 범위가 바뀌어 현재 선택된 지역이 목록에 없으면 첫 번째 지역으로 초기화
  useEffect(() => {
    if (regions.length > 0 && !regions.find((r) => r.id === selectedId)) {
      setSelectedId(regions[0].id);
    }
  }, [regions, selectedId]);

  const selectedRegion = regions.find((r) => r.id === selectedId) ?? regions[0] ?? null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-slate-900">화성시 지역 운영 현황</h3>
        <p className="mt-1 text-sm text-slate-500">권역을 선택하면 상세 운영 현황을 확인할 수 있습니다.</p>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RegionMapPlaceholder regions={regions} selectedId={selectedId} onSelect={setSelectedId} />
        <RegionDetailPanel region={selectedRegion} />
      </div>
    </section>
  );
}
