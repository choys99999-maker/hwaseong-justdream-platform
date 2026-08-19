import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, List, LocateFixed, MapPin, Menu } from 'lucide-react';
import CitizenMap, { type MapFocusMode } from '../../components/citizen/CitizenMap';
import DongPicker from '../../components/citizen/DongPicker';
import PlaceBottomSheet from '../../components/citizen/PlaceBottomSheet';
import PlaceCarousel from '../../components/citizen/PlaceCarousel';
import PlaceItemsPage from '../../components/citizen/PlaceItemsPage';
import { markerViewOf } from '../../components/citizen/mapMarkers';
import Brand from '../../components/citizen/ui/Brand';
import Button from '../../components/citizen/ui/Button';
import Sheet from '../../components/citizen/ui/Sheet';
import { StatusChip } from '../../components/citizen/ui/StatusLine';
import { useCitizenShell } from '../../components/layout/CitizenLayout';
import { useCitizenPlaces } from '../../hooks/useCitizenPlaces';
import { useDemoMode } from '../../hooks/useDemoMode';
import { useGeolocation } from '../../hooks/useGeolocation';
import {
  distanceText,
  rankPlaces,
  resolvePlaceStatus,
  type RankedPlace,
  type StatusTone,
} from '../../utils/citizenPlace';
import type { LatLng } from '../../lib/geo';
import type { AreaCentroid } from '../../data/mockSites';

/**
 * 시민 홈.
 *
 * 홈은 기능 포털이 아니라 **지도 그 자체**다. 기부·도움정보·말남기기 같은 부가 기능은
 * 전부 Drawer 로 내리고, 이 화면에는 지도와 "가까운 곳을 찾는다" 는 행동 하나만 남긴다.
 *
 * 거점을 고르는 길은 셋이고 셋 다 같은 결과로 간다 —
 *   1. 지도 위 캡슐 마커를 직접 누른다.
 *   2. 지도 아래 카드 줄(`PlaceCarousel`)에서 누른다. 지도를 움직이면 카드도 같이 바뀐다.
 *   3. [목록 보기] 로 전체 목록 시트를 열어 누른다.
 * 어느 길로 들어와도 선택된 거점은 지도에서 강조되고 카드가 앞으로 나오며 상세 시트가 뜬다.
 * "작은 점을 정확히 눌러야만 선택된다" 는 구조를 남겨 두지 않는 것이 이 화면의 원칙이다.
 *
 * [내 주변 그냥드림 찾기] 는 여전히 답을 하나로 좁혀 준다 — 목록은 그 답을 못 믿거나
 * 다른 곳을 보고 싶을 때 쓰는 두 번째 길이지, 첫 화면의 부담이 되지 않는다.
 */
export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { openDrawer } = useCitizenShell();
  const geo = useGeolocation();
  const { isDemoMode } = useDemoMode();
  const { places } = useCitizenPlaces();

  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showItemsPage, setShowItemsPage] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showDongPicker, setShowDongPicker] = useState(false);
  const [fitPoints, setFitPoints] = useState<LatLng[] | null>(null);
  const [focusMode, setFocusMode] = useState<MapFocusMode>('fit');
  const [focusToken, setFocusToken] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [panelHeight, setPanelHeight] = useState(200);
  const [carouselHeight, setCarouselHeight] = useState(0);
  const [topInset, setTopInset] = useState(60);
  /**
   * 지금 지도 화면에 들어온 거점 id. 카카오 지도가 뜬 뒤에만 채워진다 —
   * null 이면 "아직 지도가 범위를 말해주지 않았다" 는 뜻이라 전체 거점을 그대로 쓴다.
   */
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null);
  // 시트 높이가 크게 바뀌면(확장·축소) 카메라를 재프레이밍해 마커가 시트 뒤에 가리지 않게 한다.
  const prevSheetHeightRef = useRef(0);

  // 위치 요청이 "내 주변 찾기" 버튼에서 시작된 것인지 표시한다. 자동으로 위치를 묻지 않는다.
  const awaitingLocation = useRef(false);

  /**
   * 지도를 초기 광역 상태로 완전히 되돌린다.
   * - React state 초기화 → CitizenMap의 선택·추천 표시가 사라짐
   * - focusToken 증가 → CitizenMap effect 5 재실행 → fitHwaseong() 호출 → 카메라 복원
   */
  const resetToOverview = useCallback(() => {
    setSelectedId(null);
    setShowItemsPage(false);
    setShowList(false);
    setShowDongPicker(false);
    setFitPoints(null);
    setFocusMode('fit');
    setOrigin(null);
    setOriginLabel(null);
    prevSheetHeightRef.current = 0;
    awaitingLocation.current = false;
    setFocusToken((t) => t + 1);
  }, []);

  // 이미 '/'에 있는 상태에서 Drawer 등으로 다시 '/'로 네비게이션하면 React가 컴포넌트를
  // remount하지 않아 state가 유지된다. location.key 변경을 감지해 항상 overview로 복귀한다.
  const locationKeyRef = useRef(location.key);
  useEffect(() => {
    if (location.key === locationKeyRef.current) return;
    locationKeyRef.current = location.key;
    resetToOverview();
  }, [location.key, resetToOverview]);

  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const ranked = useMemo(() => rankPlaces(places, origin), [places, origin]);
  const recommended = useMemo(() => ranked.slice(0, 3), [ranked]);
  const selected = selectedId ? ranked.find((p) => p.id === selectedId) ?? null : null;

  const rankedIds = useMemo(
    () => (origin ? recommended.map((p) => p.id) : []),
    [origin, recommended],
  );

  /**
   * 지금 지도에 보이는 거점만, 추천 순서를 유지한 채로.
   * 하단 카드 줄이 이 목록을 그대로 쓰기 때문에 "지도에 있는데 목록에 없는" 거점이 생기지 않는다.
   */
  const visiblePlaces = useMemo(() => {
    if (!visibleIds) return ranked;
    const inView = new Set(visibleIds);
    return ranked.filter((p) => inView.has(p.id));
  }, [ranked, visibleIds]);

  /**
   * 전체 목록 시트에 넣을 거점.
   * 기준점이 있으면 추천 3곳을 화면 밖으로 밀려났더라도 항상 맨 위에 세운다 —
   * "가까운 다른 곳" 을 눌렀는데 정작 추천이 빠져 있으면 목록이 답을 잃는다.
   */
  const listPlaces = useMemo(() => {
    if (!origin) return visiblePlaces;
    const shown = new Set(rankedIds);
    return [...recommended, ...visiblePlaces.filter((p) => !shown.has(p.id))];
  }, [origin, rankedIds, recommended, visiblePlaces]);

  const handleVisibleChange = useCallback((ids: string[]) => setVisibleIds(ids), []);

  /** 기준점을 정하고, 그 기준에서 가장 좋은 한 곳을 지도와 시트에 함께 세운다. */
  const applyOrigin = useCallback(
    (point: LatLng, label: string) => {
      const top = rankPlaces(places, point)[0] ?? null;
      setOrigin(point);
      setOriginLabel(label);
      setShowList(false);
      setSelectedId(top?.id ?? null);
      setFocusMode('fit');
      setFitPoints(top ? [point, { lat: top.lat, lng: top.lng }] : [point]);
      setFocusToken((t) => t + 1);
    },
    [places],
  );

  // 시연 모드에서는 GPS를 우회하고 1번 거점(동탄6동 협의체)으로 직접 이동한다.
  const DEMO_SITE_ID = 'justdream-22';

  function handleFindNearby() {
    if (isDemoMode) {
      const demoSite = places.find((p) => p.id === DEMO_SITE_ID) ?? null;
      setShowList(false);
      setSelectedId(DEMO_SITE_ID);
      setFocusMode('fit');
      setFitPoints(demoSite ? [{ lat: demoSite.lat, lng: demoSite.lng }] : null);
      setFocusToken((t) => t + 1);
      return;
    }
    if (geo.status === 'granted' && geo.coords) {
      applyOrigin(geo.coords, '내 위치');
      return;
    }
    awaitingLocation.current = true;
    geo.request();
  }

  // 위치 허용이 떨어지면 한 번 더 누르게 하지 않고 바로 결과로 넘어간다.
  useEffect(() => {
    if (!awaitingLocation.current) return;
    if (geo.status !== 'granted' || !geo.coords) return;
    awaitingLocation.current = false;
    applyOrigin(geo.coords, '내 위치');
  }, [geo.status, geo.coords, applyOrigin]);

  const handleSelectDong = useCallback(
    (area: AreaCentroid) => {
      setShowDongPicker(false);
      applyOrigin({ lat: area.lat, lng: area.lng }, area.area);
    },
    [applyOrigin],
  );

  const handleSelectPlace = useCallback(
    (id: string | null) => {
      setShowList(false);
      setShowItemsPage(false);
      setSelectedId(id);
      // 새 장소를 고를 때 높이 ref 를 초기화 — 시트가 열리는 첫 순간의 높이 변화로 이중 re-frame 이 발생하지 않도록.
      prevSheetHeightRef.current = 0;
      // 마커 직접 클릭 시 카메라를 이동하지 않는다 — 바텀시트만 연다.
      // 내 주변 찾기 / 동네로 찾기 결과 이동은 applyOrigin 이 담당한다.
    },
    [],
  );

  /**
   * 카드 줄·목록에서 고른 경우.
   *
   * 마커 클릭과 달리 여기서는 카메라를 옮긴다 — 목록에서 고른 거점이 지도 어디에 있는지
   * 스스로 찾게 두면 "목록으로 고르는 길" 이 반쪽이 된다. 다만 줌은 건드리지 않는다('pan').
   * 보고 있던 축척이 갑자기 바뀌면 주변 거점과의 관계를 다시 읽어야 하기 때문이다.
   */
  const handleSelectFromList = useCallback(
    (id: string) => {
      setShowList(false);
      setShowItemsPage(false);
      setSelectedId(id);
      prevSheetHeightRef.current = 0;
      const place = places.find((p) => p.id === id);
      if (!place) return;
      setFocusMode('pan');
      setFitPoints([{ lat: place.lat, lng: place.lng }]);
      setFocusToken((t) => t + 1);
    },
    [places],
  );

  const handleOpenList = useCallback(() => {
    setShowItemsPage(false);
    setShowList(true);
  }, []);

  /** 목록 시트만 닫는다. 고른 거점은 그대로 두고 상세 시트로 돌아간다. */
  const closeList = useCallback(() => setShowList(false), []);

  /**
   * 시트 높이 변화를 받아 지도 bottomInset 을 갱신하고,
   * 높이가 크게 달라졌을 때(확장·축소) 카메라를 재프레이밍해 마커를 가리지 않게 한다.
   */
  const handlePlaceSheetHeight = useCallback(
    (h: number) => {
      const prev = prevSheetHeightRef.current;
      prevSheetHeightRef.current = h;
      setSheetHeight(h);
      // 이전 높이가 0(시트가 처음 열리는 순간)이면 선택 시의 fitPoints 가 이미 담당하므로 건너뛴다.
      if (selectedId && prev > 0 && Math.abs(h - prev) > 80) {
        const place = places.find((p) => p.id === selectedId);
        if (place) {
          setFitPoints(origin ? [origin, { lat: place.lat, lng: place.lng }] : [{ lat: place.lat, lng: place.lng }]);
          setFocusToken((t) => t + 1);
        }
      }
    },
    [selectedId, places, origin],
  );

  // 액션 영역 높이를 재서 지도 하단 여백으로 넘긴다 — 핀이 패널 뒤에 숨지 않게.
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPanelHeight(Math.round(el.getBoundingClientRect().height)));
    observer.observe(el);
    setPanelHeight(Math.round(el.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [selected, showList]);

  // 상단 헤더 높이를 재서 지도 topInset 으로 넘긴다 — 가시 지도 영역 중앙 계산에 쓴다.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setTopInset(Math.round(el.getBoundingClientRect().height)));
    obs.observe(el);
    setTopInset(Math.round(el.getBoundingClientRect().height));
    return () => obs.disconnect();
  }, []);

  // 브라우저 200% 확대·가로 모드처럼 세로가 아주 짧을 때를 알기 위한 값.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 844 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const sheetOpen = Boolean(selected) || showList;
  const locating = geo.status === 'locating';
  const locationBlocked = geo.status === 'denied' || geo.status === 'unsupported' || geo.status === 'error';

  /** 하단에서 지도를 덮고 있는 패널의 높이. 카드 줄은 이 위에 뜨고, 지도는 둘을 합쳐 피한다. */
  const bottomPanelHeight = sheetOpen ? sheetHeight : panelHeight;
  /** 카드 줄을 얹고도 지도가 지도로 남으려면 이만큼은 있어야 한다(px). */
  const MIN_MAP_ROOM = 260;
  /**
   * 카드 줄을 띄울지.
   * - 전체 목록 시트가 떠 있으면 같은 정보를 두 번 말하므로 접는다.
   * - 세로가 아주 짧으면(200% 확대 등) 카드 줄이 남은 지도를 통째로 먹는다. 그때는 접고,
   *   대신 액션 영역에 [거점 목록 보기] 를 세워 목록으로 가는 길을 잃지 않게 한다.
   */
  const roomForCarousel = viewportHeight - bottomPanelHeight - topInset >= MIN_MAP_ROOM;
  const carouselVisible = !showList && !showItemsPage && !showDongPicker && roomForCarousel;

  return (
    <div className="relative h-full overflow-hidden bg-paper">
      {/* 화면에는 로고가 이름을 대신하지만, 스크린리더에는 페이지 제목이 필요하다. */}
      <h1 className="sr-only">화성특례시 그냥드림</h1>

      <CitizenMap
        places={places}
        selectedId={selectedId}
        onSelect={handleSelectPlace}
        rankedIds={rankedIds}
        userLocation={geo.status === 'granted' ? geo.coords : null}
        fitPoints={fitPoints}
        focusMode={focusMode}
        focusToken={focusToken}
        onVisibleChange={handleVisibleChange}
        // 하단 패널 + 그 위에 뜬 카드 줄만큼을 비워 둬야 선택한 마커가 카드 뒤에 숨지 않는다.
        bottomInset={bottomPanelHeight + (carouselVisible ? carouselHeight : 0)}
        topInset={topInset}
        // z-0 은 지도에 자기만의 쌓임 맥락을 준다. 이게 없으면 지도 안쪽 마커(z-30~60)가
        // 하단 패널(z-20)·헤더 위로 튀어나와 버튼을 덮는다 — 화면이 낮을수록 잘 드러난다.
        className="absolute inset-0 z-0"
      />

      {/* ── 상단 ── 햄버거 + 화성특례시 BI. 여기 말고는 아무것도 두지 않는다. */}
      <div ref={headerRef} className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-2 px-2 py-2 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={openDrawer}
          aria-label="전체 메뉴 열기"
          className="pointer-events-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface/95 text-ink-800 shadow-raise ring-[1.5px] ring-ink-950/85 backdrop-blur-sm transition-colors hover:text-brand-700 focus-ring"
        >
          <Menu size={24} aria-hidden />
        </button>
        <div className="flex flex-1 justify-center pr-12">
          <button
            type="button"
            onClick={resetToOverview}
            aria-label="홈으로 돌아가기 — 지도 초기화"
            className="pointer-events-auto rounded-full bg-surface/95 px-3 py-1.5 shadow-raise ring-[1.5px] ring-ink-950/85 backdrop-blur-sm transition-colors hover:bg-line-50 focus-ring"
          >
            <Brand />
          </button>
        </div>
      </div>

      {/*
        ── 지도와 하단 패널 사이 ── 지금 보이는 거점 카드 줄.
        마커를 못 찾겠거나 누르기 어려운 사용자가 지도를 건드리지 않고도 같은 선택을 하는 길이다.
      */}
      {carouselVisible && (
        <PlaceCarousel
          places={visiblePlaces}
          selectedId={selectedId}
          onSelect={handleSelectFromList}
          onOpenList={handleOpenList}
          onHeightChange={setCarouselHeight}
          bottom={bottomPanelHeight}
          viewportKnown={visibleIds !== null}
        />
      )}

      {/* ── 하단 ── 목록 시트 > 고른 거점 시트 > 액션 영역 순으로 하나만 뜬다. */}
      {showList ? (
        <Sheet
          onDismiss={closeList}
          onHeightChange={setSheetHeight}
          maxHeightRatio={0.7}
          labelledBy="list-sheet-title"
        >
          <h2 id="list-sheet-title" className="text-title text-ink-950">
            {origin ? '가까운 다른 곳' : '지도에 보이는 거점'}
          </h2>
          <p className="mt-1 text-note text-ink-600">
            {origin && originLabel ? `${originLabel} 기준` : `${listPlaces.length}곳`}
          </p>
          <ul className="mt-4 space-y-2">
            {listPlaces.map((place) => {
              const rank = rankedIds.indexOf(place.id);
              return (
                <li key={place.id}>
                  <PlaceRow
                    place={place}
                    rank={rank >= 0 ? rank + 1 : null}
                    selected={place.id === selectedId}
                    onSelect={() => handleSelectFromList(place.id)}
                  />
                </li>
              );
            })}
          </ul>
        </Sheet>
      ) : selected ? (
        <PlaceBottomSheet
          place={selected}
          originLabel={originLabel}
          onHeightChange={handlePlaceSheetHeight}
          onCheckItems={() => setShowItemsPage(true)}
          onOpenList={handleOpenList}
        />
      ) : (
        <div ref={panelRef} className="absolute inset-x-0 bottom-0 z-20">
          <div className="pointer-events-none h-6 bg-gradient-to-t from-ink-950/10 to-transparent" aria-hidden />
          <div className="rounded-t-sheet border border-ink-950/85 bg-surface px-5 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 shadow-float">
            <h2 className="text-lead font-bold text-ink-950">가까운 그냥드림을 찾아드릴게요</h2>

            <div className="mt-2 space-y-1.5">
              <Button onClick={handleFindNearby} icon={LocateFixed} disabled={locating}>
                {locating ? '위치를 확인하고 있어요' : '내 주변 그냥드림 찾기'}
              </Button>
              <Button variant="secondary" size="md" icon={MapPin} onClick={() => setShowDongPicker(true)} className="border-[1.5px] border-ink-950/85">
                동네로 찾기
              </Button>
              {/*
                카드 줄이 접힌 좁은 화면에서도 "목록으로 고르는 길" 은 남아 있어야 한다.
                지도를 못 누르겠는 사용자에게 이게 유일한 길일 수 있다.
              */}
              {!carouselVisible && (
                <Button variant="secondary" size="md" icon={List} onClick={handleOpenList} className="border-[1.5px] border-ink-950/85">
                  거점 목록 보기
                </Button>
              )}
            </div>

            {locationBlocked && (
              <p className="mt-2 text-note text-ink-600">
                위치를 쓸 수 없어요. 동네로 찾아드릴게요.
              </p>
            )}

            <button
              type="button"
              onClick={() => navigate('/help')}
              className="tap-md flex w-full items-center justify-center gap-1 text-note text-ink-500 hover:text-brand-700 focus-ring"
            >
              직접 가기 어려우세요? 도움 요청하기
              <ChevronRight size={15} aria-hidden />
            </button>
          </div>
        </div>
      )}

      {showDongPicker && (
        <DongPicker onSelect={handleSelectDong} onClose={() => setShowDongPicker(false)} />
      )}

      {selected && showItemsPage && (
        <PlaceItemsPage place={selected} onClose={() => setShowItemsPage(false)} />
      )}
    </div>
  );
}

/** 순위가 없는 줄의 글리프 배경. 지도 마커 아이콘과 같은 색 규칙을 쓴다. */
const TONE_DOT: Record<StatusTone, string> = {
  open: 'bg-open-600',
  warn: 'bg-warn-600',
  unknown: 'bg-ink-600',
  closed: 'bg-ink-400',
};

/**
 * 목록 한 줄.
 *
 * 지도 마커와 같은 글리프·같은 상태말을 쓴다 — 목록에서 본 것과 지도에서 본 것이
 * 다르게 생겼으면 두 화면이 같은 거점을 말한다는 걸 알 수 없다.
 * 줄 전체가 하나의 터치 목표이고(tap-lg = 56px), 지금 고른 줄은 테두리로 드러난다.
 */
function PlaceRow({
  place,
  rank,
  selected,
  onSelect,
}: {
  place: RankedPlace;
  /** 추천 순위. 기준점이 없으면 null 이고 그 자리에 상태 글리프가 선다. */
  rank: number | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const status = resolvePlaceStatus(place);
  const view = markerViewOf(place);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`tap-lg flex w-full items-center gap-3 rounded-card bg-surface px-3 py-3 text-left transition-colors focus-ring ${
        selected ? 'border-[2.5px] border-brand-600' : 'border border-line-200 hover:border-brand-300'
      }`}
    >
      <span
        aria-hidden
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-body font-bold text-white ${
          rank === 1 ? 'bg-brand-600' : rank !== null ? 'bg-brand-400' : TONE_DOT[view.tone]
        }`}
      >
        {rank ?? view.glyph}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lead font-bold text-ink-950">
          {rank !== null && <span className="sr-only">추천 {rank}번째 </span>}
          {place.displayName}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusChip status={status} />
          {place.distanceKm !== null && (
            <span className="text-note font-semibold text-ink-800">{distanceText(place.distanceKm)}</span>
          )}
        </span>
      </span>
      <ChevronRight size={20} className="shrink-0 text-ink-400" aria-hidden />
    </button>
  );
}
