import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand, X } from 'lucide-react';
import type { DistrictId, FacilityType, OperationSite, ProgramType, SiteStatus } from '../../types';
import KakaoDistrictMap from '../map/KakaoDistrictMap';
import DistrictFilter from '../map/DistrictFilter';
import MapLegend from '../map/MapLegend';
import OperationActionPanel from './OperationActionPanel';
import { mockSites, getSiteById } from '../../data/mockSites';
import { districtRiskLevels } from '../../data/operationSummary';
import { BOUNDARY_ATTRIBUTION } from '../../data/districtBoundaries';

type ProgramTypeFilter = 'ALL' | ProgramType | 'BOTH';
type FacilityTypeFilter = 'ALL' | Exclude<FacilityType, '푸드뱅크' | '기타'> | '푸드뱅크·기타';
type StatusFilter = 'ALL' | SiteStatus;

const SELECT_CLASS =
  'rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer';

/**
 * 기존 '화성시 지역 운영 현황' 영역을 대체하는 지도 중심 영역.
 * 데스크톱은 지도 70% / 조치 패널 30%, 1024px 전후는 65% / 35%, 좁은 화면은 지도 위·패널 아래로 쌓인다.
 * 지도를 클릭하거나 '지도 크게 보기' 버튼을 누르면 지도만 보이는 전체 화면 집중 모드로 전환된다.
 * 집중 모드에서도 KakaoDistrictMap 은 같은 자리에서 클래스만 바뀌므로 언마운트되지 않고
 * 선택 구역·거점·중심 좌표·줌 레벨이 그대로 유지된다.
 */
export default function OperationMapSection() {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [programTypeFilter, setProgramTypeFilter] = useState<ProgramTypeFilter>('ALL');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState<FacilityTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const filterFn = useCallback(
    (site: OperationSite) => {
      if (programTypeFilter !== 'ALL') {
        if (programTypeFilter === 'BOTH') {
          if (!site.programTypes.includes('HWASEONG') || !site.programTypes.includes('NATIONAL')) return false;
        } else {
          if (!site.programTypes.includes(programTypeFilter)) return false;
        }
      }
      if (facilityTypeFilter !== 'ALL') {
        if (facilityTypeFilter === '푸드뱅크·기타') {
          if (site.facilityType !== '푸드뱅크' && site.facilityType !== '기타') return false;
        } else {
          if (site.facilityType !== facilityTypeFilter) return false;
        }
      }
      if (statusFilter !== 'ALL') {
        if (site.status !== statusFilter) return false;
      }
      return true;
    },
    [programTypeFilter, facilityTypeFilter, statusFilter],
  );

  // 구역을 바꾸면 이전에 선택한 거점은 초기화한다.
  const handleSelectDistrict = useCallback((district: DistrictId | null) => {
    setSelectedDistrict(district);
    setSelectedSiteId(null);
  }, []);

  const handleSelectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
  }, []);

  const openFocusMode = useCallback(() => setIsFocusMode(true), []);
  const closeFocusMode = useCallback(() => setIsFocusMode(false), []);

  // 집중 모드 진입 시 배경 스크롤을 잠그고 ESC 로 닫을 수 있게 하며, 닫기 버튼에 포커스를 옮긴다.
  useEffect(() => {
    if (!isFocusMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeFocusMode();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFocusMode, closeFocusMode]);

  const selectedSite = getSiteById(selectedSiteId);

  const totalSiteCount = mockSites.length;
  const visibleSiteCount = useMemo(
    () =>
      mockSites.filter((site) => {
        const districtMatch = selectedDistrict === null || site.district === selectedDistrict;
        return districtMatch && filterFn(site);
      }).length,
    [selectedDistrict, filterFn],
  );

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-[65fr_35fr] xl:grid-cols-[70fr_30fr]">
      <div
        className={
          isFocusMode
            ? 'fixed inset-0 z-[60] flex flex-col bg-white'
            : 'relative flex flex-col rounded-xl border border-slate-200 bg-white p-5'
        }
      >
        <div className={isFocusMode ? 'hidden' : 'mb-3 flex items-start justify-between gap-3'}>
          <div>
            <h3 className="text-base font-semibold text-slate-900">화성시 거점 운영 지도</h3>
            <p className="mt-1 text-sm text-slate-500">
              구역을 선택하면 해당 구로 확대되고, 거점 마커를 선택하면 오른쪽에 상세 현황이 표시됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={openFocusMode}
            aria-label="지도 크게 보기"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Expand size={16} />
          </button>
        </div>

        <div className={isFocusMode ? 'absolute left-4 top-4 z-10 max-w-[calc(100%_-_4rem)] space-y-2' : 'space-y-2'}>
          <DistrictFilter
            selectedDistrict={selectedDistrict}
            districtRiskLevels={districtRiskLevels}
            onSelect={handleSelectDistrict}
          />
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="지도 필터">
            <select
              className={SELECT_CLASS}
              value={programTypeFilter}
              onChange={(e) => setProgramTypeFilter(e.target.value as ProgramTypeFilter)}
              aria-label="사업 유형 필터"
            >
              <option value="ALL">사업 유형 전체</option>
              <option value="HWASEONG">화성형</option>
              <option value="NATIONAL">국가형</option>
              <option value="BOTH">동시 운영</option>
            </select>
            <select
              className={SELECT_CLASS}
              value={facilityTypeFilter}
              onChange={(e) => setFacilityTypeFilter(e.target.value as FacilityTypeFilter)}
              aria-label="시설 유형 필터"
            >
              <option value="ALL">시설 유형 전체</option>
              <option value="행정복지센터">행정복지센터</option>
              <option value="복지관">복지관</option>
              <option value="푸드뱅크·기타">푸드뱅크·기타</option>
            </select>
            <select
              className={SELECT_CLASS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              aria-label="운영 상태 필터"
            >
              <option value="ALL">운영 상태 전체</option>
              <option value="normal">정상</option>
              <option value="shortage">부족</option>
              <option value="surplus">과잉</option>
              <option value="expiring">유통기한 임박</option>
              <option value="missing">데이터 미입력</option>
            </select>
            <span className="ml-auto shrink-0 text-xs text-slate-400" aria-live="polite">
              {visibleSiteCount < totalSiteCount
                ? `${totalSiteCount}곳 중 ${visibleSiteCount}곳 표시`
                : `전체 ${totalSiteCount}곳`}
            </span>
          </div>
        </div>

        <div
          className={
            isFocusMode
              ? 'relative flex-1'
              : 'relative mt-3 h-[420px] lg:h-[480px] xl:h-[clamp(520px,58vh,680px)]'
          }
        >
          <KakaoDistrictMap
            sites={mockSites}
            districtRiskLevels={districtRiskLevels}
            selectedDistrict={selectedDistrict}
            selectedSiteId={selectedSiteId}
            onSelectDistrict={handleSelectDistrict}
            onSelectSite={handleSelectSite}
            onMapClick={isFocusMode ? undefined : openFocusMode}
            filterFn={filterFn}
          />
        </div>

        <div
          className={
            isFocusMode
              ? 'absolute bottom-4 left-4 z-10 rounded-lg bg-white/90 px-3 py-2 shadow-sm'
              : 'mt-3 space-y-1.5'
          }
        >
          <MapLegend />
          <p
            className={isFocusMode ? 'hidden' : 'text-[11px] leading-relaxed text-slate-400'}
            title={BOUNDARY_ATTRIBUTION}
          >
            거점 좌표는 행정동 경계 중심점을 사용한 데모 값입니다. · 경계 출처: 통계청 SGIS 행정동 경계(공공누리
            제1유형) · 가공: vuski/admdongkor, CC BY 4.0
          </p>
        </div>

        {isFocusMode && (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeFocusMode}
            aria-label="전체 화면 지도 닫기"
            className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-600 shadow-lg ring-1 ring-slate-200 transition-colors duration-200 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className={isFocusMode ? 'hidden' : 'flex flex-col rounded-xl border border-slate-200 bg-white p-5'}>
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
