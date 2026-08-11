import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand, X } from 'lucide-react';
import type { DistrictId, FacilityType, OperationSite, SiteStatus } from '../../types';
import KakaoDistrictMap from '../map/KakaoDistrictMap';
import DistrictFilter from '../map/DistrictFilter';
import MapLegend from '../map/MapLegend';
import OperationActionPanel from './OperationActionPanel';
import { mockSites, getSiteById } from '../../data/mockSites';
import { districtRiskLevels } from '../../data/operationSummary';
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
      return true;
    },
    [programTypeFilter, facilityTypeFilter, statusFilter],
  );

  const handleSelectDistrict = useCallback((district: DistrictId | null) => {
    setSelectedDistrict(district);
    setSelectedSiteId(null);
  }, []);

  const handleSelectSite = useCallback((siteId: string) => {
    setSelectedSiteId(siteId);
  }, []);

  const openFocusMode = useCallback(() => setIsFocusMode(true), []);
  const closeFocusMode = useCallback(() => setIsFocusMode(false), []);

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

  const sectionStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: isPanelCollapsed ? `1fr ${RAIL_W}px` : `1fr ${PANEL_W}px`,
    transition: `grid-template-columns ${TRANSITION_MS}ms ease`,
    gap: '12px',
    alignItems: 'start',
  };

  return (
    <section style={sectionStyle}>
      {/* ── 지도 카드 ── */}
      <div
        className={
          isFocusMode
            ? 'fixed inset-0 z-[60] flex flex-col bg-white'
            : 'relative flex flex-col rounded-xl border border-slate-200 bg-white p-4'
        }
      >
        {/* 제목 + 확장 버튼 (일반 모드만) */}
        {!isFocusMode && (
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-900">화성시 거점 운영 지도</h3>
            <button
              type="button"
              onClick={openFocusMode}
              aria-label="지도 크게 보기"
              className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 transition-colors hover:border-teal-300 hover:bg-teal-50/40 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Expand size={13} />
              전체화면
            </button>
          </div>
        )}

        {/* 필터 — 단일 행, compact */}
        <div
          className={
            isFocusMode
              ? 'absolute left-4 top-4 z-10 flex flex-wrap items-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 shadow-md'
              : 'flex flex-wrap items-center gap-1.5'
          }
          role="group"
          aria-label="지도 필터"
        >
          <DistrictFilter
            compact
            selectedDistrict={selectedDistrict}
            districtRiskLevels={districtRiskLevels}
            onSelect={handleSelectDistrict}
          />
          <div className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden />
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
          <select
            className={SELECT_CLASS}
            value={facilityTypeFilter}
            onChange={(e) => setFacilityTypeFilter(e.target.value as FacilityTypeFilter)}
            aria-label="시설 유형 필터"
          >
            <option value="ALL">시설유형 전체</option>
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
            <option value="ALL">운영상태 전체</option>
            <option value="normal">정상 운영</option>
            <option value="shortage">물품 부족</option>
            <option value="expiring">유통기한 임박</option>
            <option value="missing">자료 확인 필요</option>
          </select>
          <span className="ml-auto shrink-0 text-xs text-slate-400" aria-live="polite">
            {visibleSiteCount < totalSiteCount
              ? `${totalSiteCount}곳 중 ${visibleSiteCount}곳`
              : `전체 ${totalSiteCount}곳`}
          </span>
        </div>

        {/* 지도 — 높이를 뷰포트 기반으로 설정 */}
        <div
          className={
            isFocusMode
              ? 'relative flex-1'
              : 'relative mt-2 h-[clamp(440px,calc(100vh-420px),720px)]'
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

        {/* 범례 */}
        <div
          className={
            isFocusMode
              ? 'absolute bottom-4 left-4 z-10 rounded-lg bg-white/90 px-3 py-2 shadow-sm'
              : 'mt-2 space-y-1'
          }
        >
          <MapLegend />
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

      {/* ── 우측 패널 (접기/펼치기) ── */}
      {!isFocusMode && (
        <div className="relative flex flex-col rounded-xl border border-slate-200 bg-white">
          {/* 패널 토글 버튼 — 카드 왼쪽 경계에 걸쳐 떠 있음 */}
          <button
            type="button"
            onClick={() => setIsPanelCollapsed((v) => !v)}
            aria-label={isPanelCollapsed ? '운영 패널 펼치기' : '운영 패널 접기'}
            aria-expanded={!isPanelCollapsed}
            className="absolute left-0 top-5 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:border-teal-300 hover:text-teal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isPanelCollapsed ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
          </button>

          {/* 패널 내용 — 접혔을 때 숨김 */}
          <div
            className="flex h-full flex-col p-4 transition-opacity"
            style={{
              opacity: isPanelCollapsed ? 0 : 1,
              pointerEvents: isPanelCollapsed ? 'none' : 'auto',
              transitionDuration: `${TRANSITION_MS}ms`,
            }}
            aria-hidden={isPanelCollapsed}
          >
            <h3 className="shrink-0 text-sm font-semibold text-slate-900">선택 지역·기관 요약</h3>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <OperationActionPanel
                selectedDistrict={selectedDistrict}
                selectedSite={selectedSite}
                onSelectDistrict={handleSelectDistrict}
                onClearSite={() => setSelectedSiteId(null)}
              />
            </div>
          </div>

          {/* 접힌 상태 rail — 세로 레이블 */}
          {isPanelCollapsed && (
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
