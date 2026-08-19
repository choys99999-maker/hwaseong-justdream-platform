import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, LocateFixed, MapPin, Menu } from 'lucide-react';
import CitizenMap from '../../components/citizen/CitizenMap';
import DongPicker from '../../components/citizen/DongPicker';
import PlaceBottomSheet from '../../components/citizen/PlaceBottomSheet';
import PlaceItemsPage from '../../components/citizen/PlaceItemsPage';
import Brand from '../../components/citizen/ui/Brand';
import Button from '../../components/citizen/ui/Button';
import Sheet from '../../components/citizen/ui/Sheet';
import { StatusChip } from '../../components/citizen/ui/StatusLine';
import { useCitizenShell } from '../../components/layout/CitizenLayout';
import { useCitizenPlaces } from '../../hooks/useCitizenPlaces';
import { useDemoMode } from '../../hooks/useDemoMode';
import { useGeolocation } from '../../hooks/useGeolocation';
import { distanceText, rankPlaces, resolvePlaceStatus, type RankedPlace } from '../../utils/citizenPlace';
import type { LatLng } from '../../lib/geo';
import type { AreaCentroid } from '../../data/mockSites';

/**
 * 시민 홈.
 *
 * 홈은 기능 포털이 아니라 **지도 그 자체**다. 기부·도움정보·말남기기 같은 부가 기능은
 * 전부 Drawer 로 내리고, 이 화면에는 지도와 "가까운 곳을 찾는다" 는 행동 하나만 남긴다.
 *
 * 흐름은 한 줄이다.
 *   지도 → [내 주변 그냥드림 찾기] → 내 위치와 1순위 거점이 함께 보이게 이동 → 그 거점 상세 시트
 * 목록을 먼저 보여주고 고르게 하지 않는다 — "가까운 곳을 찾아 달라"는 요청의 답은
 * 목록이 아니라 한 곳이다. 다른 곳은 시트 안에서 한 번 더 눌러야 나온다.
 */
export default function HomePage() {
  const navigate = useNavigate();
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
  const [focusToken, setFocusToken] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [panelHeight, setPanelHeight] = useState(200);
  const [topInset, setTopInset] = useState(60);
  // 시트 높이가 크게 바뀌면(확장·축소) 카메라를 재프레이밍해 마커가 시트 뒤에 가리지 않게 한다.
  const prevSheetHeightRef = useRef(0);

  // 위치 요청이 "내 주변 찾기" 버튼에서 시작된 것인지 표시한다. 자동으로 위치를 묻지 않는다.
  const awaitingLocation = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const ranked = useMemo(() => rankPlaces(places, origin), [places, origin]);
  const recommended = useMemo(() => ranked.slice(0, 3), [ranked]);
  const selected = selectedId ? ranked.find((p) => p.id === selectedId) ?? null : null;

  const rankedIds = useMemo(
    () => (origin ? recommended.map((p) => p.id) : []),
    [origin, recommended],
  );

  /** 기준점을 정하고, 그 기준에서 가장 좋은 한 곳을 지도와 시트에 함께 세운다. */
  const applyOrigin = useCallback(
    (point: LatLng, label: string) => {
      const top = rankPlaces(places, point)[0] ?? null;
      setOrigin(point);
      setOriginLabel(label);
      setShowList(false);
      setSelectedId(top?.id ?? null);
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
      if (!id) return;
      const place = places.find((p) => p.id === id);
      if (!place) return;
      setFitPoints(origin ? [origin, { lat: place.lat, lng: place.lng }] : [{ lat: place.lat, lng: place.lng }]);
      setFocusToken((t) => t + 1);
    },
    [places, origin],
  );

  /** 시트를 내리면 액션 영역으로 돌아간다. 지도는 보고 있던 자리를 그대로 둔다. */
  const closeSheet = useCallback(() => {
    setSelectedId(null);
    setShowItemsPage(false);
    setShowList(false);
  }, []);

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
    const observer = new ResizeObserver(([entry]) => setPanelHeight(Math.round(entry.contentRect.height)));
    observer.observe(el);
    setPanelHeight(Math.round(el.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [selected, showList]);

  // 상단 헤더 높이를 재서 지도 topInset 으로 넘긴다 — 가시 지도 영역 중앙 계산에 쓴다.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => setTopInset(Math.round(entry.contentRect.height)));
    obs.observe(el);
    setTopInset(Math.round(el.getBoundingClientRect().height));
    return () => obs.disconnect();
  }, []);

  const sheetOpen = Boolean(selected) || showList;
  const locating = geo.status === 'locating';
  const locationBlocked = geo.status === 'denied' || geo.status === 'unsupported' || geo.status === 'error';

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
        focusToken={focusToken}
        bottomInset={sheetOpen ? sheetHeight : panelHeight}
        topInset={topInset}
        className="absolute inset-0"
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
          <span className="rounded-full bg-surface/95 px-3 py-1.5 shadow-raise ring-[1.5px] ring-ink-950/85 backdrop-blur-sm">
            <Brand />
          </span>
        </div>
      </div>

      {/* ── 하단 ── 거점을 고르기 전에는 액션 영역 하나, 고른 뒤에는 그 거점 시트 하나. */}
      {selected ? (
        <PlaceBottomSheet
          place={selected}
          originLabel={originLabel}
          onHeightChange={handlePlaceSheetHeight}
          onCheckItems={() => setShowItemsPage(true)}
        />
      ) : showList ? (
        <Sheet
          onDismiss={closeSheet}
          onHeightChange={setSheetHeight}
          maxHeightRatio={0.7}
          labelledBy="list-sheet-title"
        >
          <h2 id="list-sheet-title" className="text-title text-ink-950">
            가까운 다른 곳
          </h2>
          {originLabel && <p className="mt-1 text-note text-ink-600">{originLabel} 기준</p>}
          <ul className="mt-4 space-y-2">
            {recommended.map((place, i) => (
              <li key={place.id}>
                <PlaceRow place={place} rank={i + 1} onSelect={() => handleSelectPlace(place.id)} />
              </li>
            ))}
          </ul>
        </Sheet>
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

/** 추천 목록 한 줄. 순위는 색이 아니라 숫자로, 상태는 아이콘 + 문장으로 전한다. */
function PlaceRow({
  place,
  rank,
  onSelect,
}: {
  place: RankedPlace;
  rank: number;
  onSelect: () => void;
}) {
  const status = resolvePlaceStatus(place);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 rounded-card border border-line-200 bg-surface px-3 py-3 text-left transition-colors hover:border-brand-300 focus-ring"
    >
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-body font-bold text-white ${
          rank === 1 ? 'bg-brand-600' : 'bg-ink-400'
        }`}
      >
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lead font-bold text-ink-950">
          <span className="sr-only">추천 {rank}번째 </span>
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
