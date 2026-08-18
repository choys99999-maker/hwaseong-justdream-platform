import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, SlidersHorizontal, X } from 'lucide-react';
import type { DistrictId, FacilityType, OperationSite, SiteStatus } from '../../types';
import KakaoDistrictMap, { type MapFocusRequest } from '../map/KakaoDistrictMap';
import DistrictFilter from '../map/DistrictFilter';
import MapLegend from '../map/MapLegend';
import MapSearch from '../map/MapSearch';
import OperationActionPanel from './OperationActionPanel';
import type { KpiStatus } from './OperationKpiBar';
import { mockSites, getSiteById } from '../../data/mockSites';
import { districtRiskLevels } from '../../data/operationSummary';
import { REGION_NAMES } from '../../data/regionMeta';
import { BOUNDARY_ATTRIBUTION } from '../../data/districtBoundaries';
import { JUSTDREAM_PROGRAM_TOTALS } from '../../data/justdreamSummary';

/**
 * 국가형+화성형 동시 운영 2곳(서부종합사회복지관, 봉담읍행정복지센터)이 포함된다.
 * 지도 핀은 좌표가 확정된 25곳만 표시. 전체 사업 거점 43곳 = JUSTDREAM_PROGRAM_TOTALS 참조.
 */
type ProgramTypeFilter = 'ALL' | 'NATIONAL' | 'HWASEONG';
type FacilityTypeFilter = 'ALL' | Exclude<FacilityType, '푸드뱅크' | '기타'> | '푸드뱅크·기타';
type StatusFilter = 'ALL' | SiteStatus;

const SELECT_CLASS =
  'rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shrink-0';

/** 펼쳐진 패널 너비 (px) */
const PANEL_W = 295;
/** 접혔을 때 rail 너비 (px) */
const RAIL_W = 44;
/** 패널 트랜지션 시간 */
const TRANSITION_MS = 210;
/** 이 폭 아래에서는 지도와 운영 패널을 위아래로 쌓는다. */
const NARROW_QUERY = '(max-width: 1100px)';

/** 지도 옆에 패널을 붙일 자리가 없는 폭인지. */
function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.matchMedia(NARROW_QUERY).matches);
  useEffect(() => {
    const media = window.matchMedia(NARROW_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return isNarrow;
}

/**
 * 지도 중심 운영 관제 섹션.
 * - 좌측: 화성시 거점 지도 (첫 화면 높이 대부분)
 * - 우측: 접을 수 있는 AI 운영 패널 (펼침 295px / 접힘 44px rail)
 * - CSS grid-template-columns 트랜지션으로 양쪽이 동시에 자연스럽게 변환된다.
 * - KakaoDistrictMap 내 ResizeObserver 가 컨테이너 크기 변화를 감지해 자동 relayout.
 */
export default function OperationMapSection() {
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const [programTypeFilter, setProgramTypeFilter] = useState<ProgramTypeFilter>('ALL');
  const [facilityTypeFilter, setFacilityTypeFilter] = useState<FacilityTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  /** 지도 바로 위 KPI 버튼 — 정상/부족/확인 필요 강조. "운영 상태" 드롭다운과는 별개로 겹쳐 적용된다. */
  const [kpiFilter, setKpiFilter] = useState<KpiStatus>('ALL');

  /** 시설유형·운영상태처럼 자주 안 쓰는 필터는 팝오버 안으로 옮긴다. */
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  /** 검색 결과 선택 → KakaoDistrictMap 에 지도 이동을 요청한다. */
  const [focusRequest, setFocusRequest] = useState<MapFocusRequest | null>(null);
  const focusTokenRef = useRef(0);
  /** 검색 선택과 마커 직접 클릭을 구분한다. 검색어 삭제는 SEARCH 선택만 해제한다. */
  const [selectionSource, setSelectionSource] = useState<'SEARCH' | 'MAP' | null>(null);

  const filterFn = useCallback(
    (site: OperationSite) => {
      if (programTypeFilter !== 'ALL') {
        if (!site.programTypes.includes(programTypeFilter)) return false;
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
      if (kpiFilter !== 'ALL') {
        if (kpiFilter === 'needsCheck') {
          if (site.status !== 'expiring' && site.status !== 'missing') return false;
        } else if (site.status !== kpiFilter) {
          return false;
        }
      }
      return true;
    },
    [programTypeFilter, facilityTypeFilter, statusFilter, kpiFilter],
  );

  /** KPI 카운트는 구 선택 범위만 반영한다 — 시설유형·사업유형 등 다른 필터와는 무관하게 "지금 이 구에 몇 곳" 을 보여준다. */
  const kpiScopeSites = useMemo(
    () => (selectedDistrict === null ? mockSites : mockSites.filter((site) => site.district === selectedDistrict)),
    [selectedDistrict],
  );

  const handleSelectDistrict = useCallback((district: DistrictId | null) => {
    setSelectedDistrict(district);
    setSelectedSiteId(null);
  }, []);

  const handleSelectSite = useCallback(
    (siteId: string) => {
      if (siteId === selectedSiteId) {
        setSelectedSiteId(null);
        setSelectionSource(null);
        setFocusRequest(null);
        return;
      }
      setSelectedSiteId(siteId);
      setSelectionSource('MAP');
      focusTokenRef.current += 1;
      setFocusRequest({ siteId, token: focusTokenRef.current, panOnly: true });
    },
    [selectedSiteId],
  );

  /**
   * 검색 결과 선택. marker 클릭과 동일한 selectedSiteId state 를 사용하되(단일 selection source of truth),
   * 검색은 필터와 무관하게 전체 데이터에서 이뤄지므로 선택한 거점이 필터에 가려 안 보이는 일이 없도록
   * 구·유형 필터를 초기화하고 지도 focusRequest 로 해당 좌표까지 이동시킨다.
   */
  const handleSelectSiteFromSearch = useCallback((site: OperationSite) => {
    setSelectedDistrict(null);
    setProgramTypeFilter('ALL');
    setFacilityTypeFilter('ALL');
    setStatusFilter('ALL');
    setSelectedSiteId(site.id);
    setSelectionSource('SEARCH');
    focusTokenRef.current += 1;
    setFocusRequest({ siteId: site.id, token: focusTokenRef.current });
  }, []);

  const handleClearSearch = useCallback(() => {
    if (selectionSource === 'SEARCH') {
      setSelectedSiteId(null);
      setFocusRequest(null);
      setSelectionSource(null);
    }
  }, [selectionSource]);

  const openFocusMode = useCallback(() => setIsFocusMode(true), []);
  const closeFocusMode = useCallback(() => setIsFocusMode(false), []);

  useEffect(() => {
    if (!isFilterPopoverOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!filterPopoverRef.current?.contains(event.target as Node)) setIsFilterPopoverOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsFilterPopoverOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isFilterPopoverOpen]);

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
  const hasSecondaryFilters = facilityTypeFilter !== 'ALL' || statusFilter !== 'ALL';

  /**
   * 지도 위 floating KPI — 실제 거점 명단의 운영 상태 집계다. 만들어낸 수치가 아니다.
   * 구를 선택하면 kpiScopeSites 를 따라 그 구 범위로 좁혀진다(origin OperationKpiBar 와 동일한 규칙).
   * 칩을 누르면 kpiFilter 를 바꿔 지도 마커·우측 패널이 그 상태 기준으로 함께 바뀐다.
   */
  const kpiCounts = {
    total: kpiScopeSites.length,
    normal: kpiScopeSites.filter((site) => site.status === 'normal').length,
    shortage: kpiScopeSites.filter((site) => site.status === 'shortage').length,
    needsCheck: kpiScopeSites.filter((site) => site.status === 'expiring' || site.status === 'missing').length,
  };
  const kpiTotalLabel = selectedDistrict ? `${REGION_NAMES[selectedDistrict]} 거점` : '전체 거점';

  const totalSiteCount = mockSites.length;
  const visibleSiteCount = useMemo(
    () =>
      mockSites.filter((site) => {
        const districtMatch = selectedDistrict === null || site.district === selectedDistrict;
        return districtMatch && filterFn(site);
      }).length,
    [selectedDistrict, filterFn],
  );

  /*
   * 좁은 화면에서는 지도 옆에 295px 패널을 붙일 자리가 없다.
   * 고정 2열로 두면 태블릿·좁은 창에서 지도 폭이 200px 대로 눌려 거점이 겹쳐 읽히지 않았다.
   * (사이드바가 자동으로 접히는 767px 보다 여유 있게 1100px 를 기준으로 잡는다)
   */
  const isNarrow = useIsNarrowViewport();
  /** 좁은 화면에서는 패널이 지도 아래 전체 폭으로 놓이므로 항상 펼친다. */
  const collapsed = isPanelCollapsed && !isNarrow;

  const sectionStyle: React.CSSProperties = isNarrow
    ? { display: 'grid', gridTemplateColumns: '1fr', gap: '12px', alignItems: 'start' }
    : {
        display: 'grid',
        gridTemplateColumns: isPanelCollapsed ? `1fr ${RAIL_W}px` : `1fr ${PANEL_W}px`,
        transition: `grid-template-columns ${TRANSITION_MS}ms ease`,
        gap: '12px',
        alignItems: 'start',
      };

  return (
    <section style={sectionStyle}>
      {/* ── 지도 카드 — hero surface. 첫 화면의 절대적인 주인공이라 카드보다 큰 존재감을 준다.
          origin 의 OperationKpiBar 는 별도로 렌더링하지 않는다 — 그 데이터/필터 로직(kpiFilter,
          kpiScopeSites)은 지도 위 floating KPI 칩(MapKpiChip)에 그대로 연결해 KPI 가 두 번
          보이지 않게 한다. ── */}
      <div
        className={
          isFocusMode
            ? 'fixed inset-0 z-[60] flex flex-col bg-white'
            : 'hci-scale-in relative flex flex-col rounded-[22px] border border-[rgba(18,59,99,0.10)] bg-white p-4 shadow-[0_2px_5px_rgba(18,59,99,0.04),0_16px_44px_rgba(18,59,99,0.10),0_32px_80px_rgba(18,59,99,0.05)]'
        }
        style={isFocusMode ? undefined : { animationDelay: '160ms' }}
      >
        {/* 제목 + 확장 버튼 (일반 모드만) — 검색·필터보다도 낮은 위계로, 지도 자체를 가리지 않는다 */}
        {!isFocusMode && (
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[13px] font-medium text-[#667085]">화성시 거점 운영 지도</h3>
            <button
              type="button"
              onClick={openFocusMode}
              aria-label="지도 크게 보기"
              className="inline-flex shrink-0 items-center gap-1 rounded border border-[rgba(20,50,80,0.1)] bg-white px-2 py-1 text-xs text-slate-500 transition-colors hover:border-[#004696]/30 hover:bg-[#EAF3FC] hover:text-[#004696] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              <Expand size={13} />
              전체화면
            </button>
          </div>
        )}

        {/* 검색 + 필터 — 단일 행, compact. 기본으로 보이는 건 검색·구·사업유형뿐이고
            시설유형·운영상태는 "필터" 팝오버 안으로 옮겼다. 지도보다 눈에 띄지 않도록 낮춘 위계다. */}
        <div
          className={
            isFocusMode
              ? 'absolute left-4 top-4 z-10 flex flex-wrap items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 shadow-md'
              : 'flex h-[41px] flex-wrap items-center gap-1.5 rounded-[10px] border border-[rgba(20,50,80,0.06)] bg-[#F3F8FD] px-2'
          }
          role="group"
          aria-label="지도 검색 및 필터"
        >
          <MapSearch sites={mockSites} onSelectSite={handleSelectSiteFromSearch} onClearSearch={handleClearSearch} />
          <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden />
          <DistrictFilter
            compact
            selectedDistrict={selectedDistrict}
            districtRiskLevels={districtRiskLevels}
            onSelect={handleSelectDistrict}
          />
          <select
            className={SELECT_CLASS}
            value={programTypeFilter}
            onChange={(e) => setProgramTypeFilter(e.target.value as ProgramTypeFilter)}
            aria-label="사업 유형 필터"
          >
            <option value="ALL">사업유형 전체</option>
            <option value="NATIONAL">국가형</option>
            <option value="HWASEONG">화성형</option>
          </select>

          <div ref={filterPopoverRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setIsFilterPopoverOpen((v) => !v)}
              aria-expanded={isFilterPopoverOpen}
              aria-haspopup="true"
              className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                hasSecondaryFilters
                  ? 'border-teal-500 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300 hover:bg-teal-50/40'
              }`}
            >
              <SlidersHorizontal size={12} />
              필터
              {hasSecondaryFilters && <span className="h-1.5 w-1.5 rounded-full bg-teal-500" aria-hidden />}
            </button>

            {isFilterPopoverOpen && (
              <div className="absolute left-0 top-[calc(100%+4px)] z-20 flex w-44 flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-2 shadow-md">
                <label className="text-[11px] text-slate-400">
                  시설 유형
                  <select
                    className={`${SELECT_CLASS} mt-0.5 w-full`}
                    value={facilityTypeFilter}
                    onChange={(e) => setFacilityTypeFilter(e.target.value as FacilityTypeFilter)}
                    aria-label="시설 유형 필터"
                  >
                    <option value="ALL">시설유형 전체</option>
                    <option value="행정복지센터">행정복지센터</option>
                    <option value="복지관">복지관</option>
                    <option value="푸드뱅크·기타">푸드뱅크·기타</option>
                  </select>
                </label>
                <label className="text-[11px] text-slate-400">
                  운영 상태
                  <select
                    className={`${SELECT_CLASS} mt-0.5 w-full`}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                    aria-label="운영 상태 필터"
                  >
                    <option value="ALL">운영상태 전체</option>
                    <option value="normal">정상 운영</option>
                    <option value="shortage">물품 부족</option>
                    <option value="expiring">유통기한 임박</option>
                    <option value="missing">자료 확인 필요</option>
                  </select>
                </label>
              </div>
            )}
          </div>

          <span
            className="ml-auto shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
            aria-live="polite"
          >
            {visibleSiteCount < totalSiteCount ? `지도 위치 ${visibleSiteCount}/${totalSiteCount}` : `지도 위치 ${totalSiteCount}`}
          </span>
        </div>

        {/* 지도 — 높이를 뷰포트 기반으로 설정 */}
        <div
          className={`${isFocusMode ? 'relative flex-1' : 'relative mt-2 h-[clamp(440px,calc(100vh-420px),720px)]'}${selectionSource === 'SEARCH' ? ' gj-map-search-active' : ''}`}
        >
          {/* 지도 위 floating KPI — "카드 여러 개"가 아니라 지도 일부처럼 보이도록 좌상단에 얹는다.
              전체화면 모드는 검색·필터 오버레이가 같은 자리를 쓰므로 기본 화면에서만 보여준다. */}
          {!isFocusMode && (
            <div
              className="absolute left-3 top-3 z-10 flex gap-2"
              role="group"
              aria-label="화성시 운영 현황 요약"
            >
              <MapKpiChip
                label={kpiTotalLabel}
                value={kpiCounts.total}
                color="#004696"
                delay={340}
                active={kpiFilter === 'ALL'}
                onClick={() => setKpiFilter('ALL')}
              />
              <MapKpiChip
                label="정상 운영"
                value={kpiCounts.normal}
                color="#16A36A"
                delay={375}
                active={kpiFilter === 'normal'}
                onClick={() => setKpiFilter('normal')}
              />
              <MapKpiChip
                label="물품 부족"
                value={kpiCounts.shortage}
                color="#E5484D"
                delay={410}
                active={kpiFilter === 'shortage'}
                onClick={() => setKpiFilter('shortage')}
              />
              <MapKpiChip
                label="확인 필요"
                value={kpiCounts.needsCheck}
                color="#DC6E2D"
                delay={445}
                active={kpiFilter === 'needsCheck'}
                onClick={() => setKpiFilter('needsCheck')}
              />
            </div>
          )}

          <KakaoDistrictMap
            sites={mockSites}
            districtRiskLevels={districtRiskLevels}
            selectedDistrict={selectedDistrict}
            selectedSiteId={selectedSiteId}
            onSelectDistrict={handleSelectDistrict}
            onSelectSite={handleSelectSite}
            onMapClick={isFocusMode ? undefined : openFocusMode}
            filterFn={filterFn}
            focusRequest={focusRequest}
          />
        </div>

        {/* 범례 — 전체화면에서는 크게, 기본 화면에서는 compact 하게.
            전체화면 우측 하단에 둬 지도 자체의 "전체 보기" 버튼(좌측 하단)과 겹치지 않게 한다. */}
        <div
          className={
            isFocusMode
              ? 'absolute bottom-4 right-4 z-10 rounded-lg bg-white/90 px-3 py-2 shadow-sm'
              : 'mt-2 space-y-1'
          }
        >
          <MapLegend size={isFocusMode ? 'large' : 'compact'} />
          {!isFocusMode && (
            <p className="text-[10px] leading-relaxed text-slate-400">
              전체 사업 프로그램 {JUSTDREAM_PROGRAM_TOTALS.totalPrograms}개 · 지도 위치 확인{' '}
              {JUSTDREAM_PROGRAM_TOTALS.confirmedLocations}개 (거점 명단 중 위치 확인 중{' '}
              {JUSTDREAM_PROGRAM_TOTALS.pendingLocations}개)
            </p>
          )}
          <p
            className={isFocusMode ? 'hidden' : 'text-[10px] leading-relaxed text-slate-400'}
            title={BOUNDARY_ATTRIBUTION}
          >
            위치·주소는 공식 데이터, 재고·수요는 데모 수치입니다. · 경계: 통계청 SGIS(공공누리 제1유형)
          </p>
        </div>

        {/* 집중 모드 닫기 */}
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

      {/* ── 우측 Action Dock (접기/펼치기) — 지도 위에 뜬 카드처럼, 지도보다 튀지 않게 ── */}
      {!isFocusMode && (
        <div
          className="hci-slide-in-right relative flex flex-col rounded-[18px] border border-[rgba(20,50,80,0.08)] bg-white/96 shadow-[0_18px_44px_rgba(22,55,90,0.10)]"
          style={{ animationDelay: '520ms' }}
        >
          {/* 패널 토글 버튼 — 카드 왼쪽 경계에 걸쳐 떠 있음.
              위아래로 쌓인 좁은 화면에서는 접을 이유가 없으므로 토글도 감춘다. */}
          {!isNarrow && (
            <button
              type="button"
              onClick={() => setIsPanelCollapsed((v) => !v)}
              aria-label={isPanelCollapsed ? '운영 패널 펼치기' : '운영 패널 접기'}
              aria-expanded={!isPanelCollapsed}
              className="absolute left-0 top-5 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-[rgba(20,50,80,0.1)] bg-white text-slate-400 shadow-sm transition-colors hover:border-[#004696]/30 hover:text-[#004696] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
            >
              {isPanelCollapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
            </button>
          )}

          {/* 패널 내용 — 접혔을 때 숨김. 제목은 OperationActionPanel 이 모드별로 직접 낸다. */}
          <div
            className="flex h-full flex-col p-4 transition-opacity"
            style={{
              opacity: collapsed ? 0 : 1,
              pointerEvents: collapsed ? 'none' : 'auto',
              transitionDuration: `${TRANSITION_MS}ms`,
            }}
            aria-hidden={collapsed}
          >
            {/* 별도 제목을 두지 않는다 — OperationActionPanel 이 모드별로(화성시 전체/구 이름/거점 이름)
                자기 제목을 직접 낸다. 위에 "선택 지역·기관 요약" 을 또 얹으면 제목이 두 번 보인다. */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              <OperationActionPanel
                selectedDistrict={selectedDistrict}
                selectedSite={selectedSite}
                statusFilter={kpiFilter}
                onSelectDistrict={handleSelectDistrict}
                onClearSite={() => {
                  setSelectedSiteId(null);
                  setSelectionSource(null);
                  setFocusRequest(null);
                }}
              />
            </div>
          </div>

          {/* 접힌 상태 rail — 세로 레이블 */}
          {collapsed && (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-4">
              <ChevronLeft size={14} className="text-slate-300" />
              <span
                className="select-none text-[10px] text-slate-300"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                운영 요약
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * 지도 위 floating KPI 칩. 숫자만 상태색이고 카드 배경은 항상 흰색이다(면적으로 상태색을 쓰지 않는다).
 * 동시에 지도 필터 버튼이다 — 누르면 그 상태의 거점만 지도·우측 패널에 남는다(origin KpiButton과 동일 규칙).
 */
function MapKpiChip({
  label,
  value,
  color,
  delay,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  delay: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="hci-fade-up flex min-w-[92px] flex-col justify-center rounded-[16px] border bg-white/95 px-3.5 py-2.5 text-left shadow-[0_8px_24px_rgba(30,64,100,0.07)] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#004696]"
      style={{
        animationDelay: `${delay}ms`,
        borderColor: active ? color : 'rgba(20,50,80,0.08)',
        boxShadow: active ? `0 0 0 1.5px ${color}, 0 8px 24px rgba(30,64,100,0.07)` : undefined,
      }}
    >
      <span className="text-[30px] font-extrabold leading-none tabular-nums" style={{ color }}>
        {value}
      </span>
      <span className="mt-1 text-[11.5px] font-medium text-[#667085]">{label}</span>
    </button>
  );
}
