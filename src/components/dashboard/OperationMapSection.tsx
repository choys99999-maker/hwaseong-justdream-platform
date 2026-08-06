import { useCallback, useState } from 'react';
import type { DistrictId } from '../../types';
import KakaoDistrictMap from '../map/KakaoDistrictMap';
import DistrictFilter from '../map/DistrictFilter';
import MapLegend from '../map/MapLegend';
import OperationActionPanel from './OperationActionPanel';
import { mockSites, getSiteById } from '../../data/mockSites';
import { districtRiskLevels } from '../../data/operationSummary';
import { BOUNDARY_ATTRIBUTION } from '../../data/districtBoundaries';

/**
 * 기존 '화성시 지역 운영 현황' 영역을 대체하는 지도 중심 영역.
 * 넓은 화면에서는 지도 60% / 조치 패널 40%, 좁은 화면에서는 지도 위·패널 아래로 쌓인다.
 */
export default function OperationMapSection() {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  // 구역을 바꾸면 이전에 선택한 거점은 초기화한다.
  const handleSelectDistrict = useCallback((district: DistrictId | null) => {
    setSelectedDistrict(district);
    setSelectedSiteId(null);
  }, []);

  const handleSelectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
  }, []);

  const selectedSite = getSiteById(selectedSiteId);

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-3">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-slate-900">화성시 거점 운영 지도</h3>
          <p className="mt-1 text-sm text-slate-500">
            구역을 선택하면 해당 구로 확대되고, 거점 마커를 선택하면 오른쪽에 상세 현황이 표시됩니다.
          </p>
        </div>

        <DistrictFilter
          selectedDistrict={selectedDistrict}
          districtRiskLevels={districtRiskLevels}
          onSelect={handleSelectDistrict}
        />

        <div className="mt-3 h-[380px] lg:h-[440px]">
          <KakaoDistrictMap
            sites={mockSites}
            districtRiskLevels={districtRiskLevels}
            selectedDistrict={selectedDistrict}
            selectedSiteId={selectedSiteId}
            onSelectDistrict={handleSelectDistrict}
            onSelectSite={handleSelectSite}
          />
        </div>

        <div className="mt-3 space-y-1.5">
          <MapLegend />
          <p className="text-[11px] leading-relaxed text-slate-400" title={BOUNDARY_ATTRIBUTION}>
            거점 좌표는 행정동 경계 중심점을 사용한 데모 값입니다. · 경계 출처: 통계청 SGIS 행정동 경계(공공누리
            제1유형) · 가공: vuski/admdongkor, CC BY 4.0
          </p>
        </div>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
        <h3 className="shrink-0 text-base font-semibold text-slate-900">오늘의 조치 필요 사항</h3>
        <div className="mt-3 min-h-0 flex-1">
          <OperationActionPanel
            selectedDistrict={selectedDistrict}
            selectedSite={selectedSite}
            onSelectDistrict={handleSelectDistrict}
            onClearSite={() => setSelectedSiteId(null)}
          />
        </div>
      </div>
    </section>
  );
}
