import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, RotateCcw } from 'lucide-react';
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoMapsNamespace,
  KakaoPolygon,
  KakaoPolyline,
} from '../../types/kakao';
import { MissingKakaoKeyError, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_FOCUS_BBOX, districtBoundaries } from '../../data/districtBoundaries';
import type { CitizenPlace } from '../../data/citizenDirectory';
import Button from './ui/Button';

type MapPhase = 'loading' | 'ready' | 'missing-key' | 'error';

interface CitizenMapProps {
  places: CitizenPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * 추천 순서대로의 거점 id. 1순위 하나가 지도에서 가장 강하게 보이고 나머지는 뒤로 물러난다.
   * 빈 배열이면 전부 같은 크기의 조용한 점으로 깔린다(첫 화면).
   */
  rankedIds?: string[];
  userLocation?: { lat: number; lng: number } | null;
  /** 이 좌표들이 한 화면에 다 보이게 맞춘다. `focusToken` 이 바뀔 때 적용된다. */
  fitPoints?: Array<{ lat: number; lng: number }> | null;
  /** 값이 바뀌면 지도 프레이밍을 다시 적용한다. 같은 대상을 다시 눌러도 움직이게 한다. */
  focusToken?: number;
  /** 하단 시트·액션 영역에 가리지 않도록 확보할 여백(px). */
  bottomInset?: number;
  className?: string;
}

interface MarkerEntry {
  id: string;
  overlay: KakaoCustomOverlay;
  element: HTMLButtonElement;
  dispose: () => void;
}

const RELAYOUT_DEBOUNCE_MS = 160;

/** 이 레벨 이하(=더 확대)에서만 모든 핀의 이름표를 띄운다. 넓게 보면 이름끼리 겹쳐 못 읽는다. */
const LABEL_ZOOM_LEVEL = 6;

function createPinElement(place: CitizenPlace): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cj-pin';
  btn.dataset.selected = 'false';
  btn.dataset.zoomed = 'false';
  btn.setAttribute('aria-label', place.displayName);

  const dot = document.createElement('span');
  dot.className = 'cj-pin-dot';

  const name = document.createElement('span');
  name.className = 'cj-pin-name';
  name.textContent = place.displayName;

  btn.append(dot, name);
  return btn;
}

function createMyLocElement(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'cj-my-loc';
  const dot = document.createElement('div');
  dot.className = 'cj-my-loc-dot';
  wrap.appendChild(dot);
  return wrap;
}

/** 링의 부호 있는 면적. 양수면 반시계(CCW). */
function ringSignedArea(ring: [number, number][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

function orientRing(ring: [number, number][], wantCCW: boolean): [number, number][] {
  return ringSignedArea(ring) > 0 === wantCCW ? ring : [...ring].reverse();
}

/**
 * 화성시 경계.
 *
 * 지도는 장식 배경이 아니라 제품 자체라서 최대한 덜 덮는다 —
 * 바깥 마스크는 "여기까지가 화성시" 만 알 정도로 아주 옅게(0.10) 깔고,
 * 읍·면·동 구분은 면 색이 아니라 얇은 경계선이 한다. 색을 여러 개 쓰지 않는다.
 */
function drawBoundaries(maps: KakaoMapsNamespace, map: KakaoMap): Array<KakaoPolygon | KakaoPolyline> {
  const shapes: Array<KakaoPolygon | KakaoPolyline> = [];
  const toPath = (ring: [number, number][]) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng));

  const world: [number, number][] = [
    [124.0, 34.5],
    [130.0, 34.5],
    [130.0, 39.5],
    [124.0, 39.5],
  ];
  const holes = districtBoundaries.flatMap((d) => d.outline).map((ring) => orientRing(ring, false));
  const mask = new maps.Polygon({
    path: [toPath(orientRing(world, true)), ...holes.map(toPath)],
    strokeWeight: 0,
    strokeOpacity: 0,
    fillColor: '#131c2e',
    fillOpacity: 0.1,
    zIndex: 1,
  });
  mask.setMap(map);
  shapes.push(mask);

  districtBoundaries.forEach((district) => {
    district.areas.forEach((area) => {
      area.polygons.forEach((polygon) => {
        const [outer, ...inner] = polygon;
        if (!outer) return;
        polygon.forEach((ring) => {
          const line = new maps.Polyline({
            path: toPath(ring),
            strokeWeight: 1,
            strokeColor: '#0054a6',
            strokeOpacity: 0.22,
            strokeStyle: 'solid',
            zIndex: 3,
          });
          line.setMap(map);
          shapes.push(line);
        });
        void inner;
      });
    });
  });

  return shapes;
}

/**
 * 시민용 지도.
 *
 * 처음부터 대한민국 전체가 보이지 않게 화성시 범위로 맞춰서 시작하고, 위치를 얻으면
 * 내 위치와 추천 거점이 함께 보이는 화면으로 자연스럽게 옮겨간다. 핀은 한 색으로 조용히
 * 깔리고, 추천이 정해진 뒤에만 1순위 하나가 크게 올라온다.
 */
export default function CitizenMap({
  places,
  selectedId,
  onSelect,
  rankedIds,
  userLocation = null,
  fitPoints = null,
  focusToken = 0,
  bottomInset = 0,
  className = '',
}: CitizenMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const myLocRef = useRef<KakaoCustomOverlay | null>(null);
  const shapesRef = useRef<Array<KakaoPolygon | KakaoPolyline>>([]);
  const teardownRef = useRef<(() => void)[]>([]);

  const [phase, setPhase] = useState<MapPhase>('loading');
  const [retryToken, setRetryToken] = useState(0);

  // 콜백은 ref 로 읽는다 — 부모가 매 렌더 새 함수를 줘도 마커를 다시 만들지 않기 위해서다.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const bottomInsetRef = useRef(bottomInset);
  bottomInsetRef.current = bottomInset;
  const fitPointsRef = useRef(fitPoints);
  fitPointsRef.current = fitPoints;

  const placesKey = useMemo(() => places.map((p) => p.id).join('|'), [places]);
  const rankKey = (rankedIds ?? []).join('|');

  /** 화성시 본토 범위로 맞춘다. 서해 도서까지 넣으면 화면 대부분이 바다가 된다. */
  const fitHwaseong = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const [minLng, minLat, maxLng, maxLat] = HWASEONG_FOCUS_BBOX;
    const bounds = new maps.LatLngBounds(
      new maps.LatLng(minLat, minLng),
      new maps.LatLng(maxLat, maxLng),
    );
    map.setBounds(bounds, 32, 32, bottomInsetRef.current + 24, 32);
  }, []);

  const syncZoomLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoomed = map.getLevel() <= LABEL_ZOOM_LEVEL;
    markersRef.current.forEach(({ element }) => {
      element.dataset.zoomed = String(zoomed);
    });
  }, []);

  // 1) SDK 로드 + 지도 생성
  useEffect(() => {
    let mounted = true;
    setPhase('loading');

    loadKakaoMaps()
      .then((maps) => {
        if (!mounted || !containerRef.current) return;
        mapsRef.current = maps;

        const [minLng, minLat, maxLng, maxLat] = HWASEONG_FOCUS_BBOX;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2),
          level: 9,
        });
        mapRef.current = map;

        shapesRef.current = drawBoundaries(maps, map);
        teardownRef.current.push(() => {
          shapesRef.current.forEach((s) => s.setMap(null));
          shapesRef.current = [];
        });

        const onBgClick = () => onSelectRef.current(null);
        maps.event.addListener(map, 'click', onBgClick);
        teardownRef.current.push(() => maps.event.removeListener(map, 'click', onBgClick));

        const onZoom = () => syncZoomLabels();
        maps.event.addListener(map, 'zoom_changed', onZoom);
        teardownRef.current.push(() => maps.event.removeListener(map, 'zoom_changed', onZoom));

        fitHwaseong();
        setPhase('ready');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (error instanceof MissingKakaoKeyError) {
          setPhase('missing-key');
          return;
        }
        console.error('[CitizenMap]', error);
        setPhase('error');
      });

    return () => {
      mounted = false;
      teardownRef.current.forEach((fn) => fn());
      teardownRef.current = [];
      markersRef.current = [];
      myLocRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  // 2) 거점 마커 — 거점 목록이 실제로 바뀔 때만 다시 만든다.
  const placesRef = useRef(places);
  placesRef.current = places;

  useEffect(() => {
    if (phase !== 'ready') return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    markersRef.current = placesRef.current.map((place) => {
      const element = createPinElement(place);
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        onSelectRef.current(place.id);
      };
      element.addEventListener('click', onClick);

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(place.lat, place.lng),
        content: element,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 5,
        clickable: true,
      });
      overlay.setMap(map);

      return {
        id: place.id,
        overlay,
        element,
        dispose: () => {
          element.removeEventListener('click', onClick);
          overlay.setMap(null);
        },
      };
    });
    syncZoomLabels();

    const created = markersRef.current;
    return () => {
      created.forEach((m) => m.dispose());
      markersRef.current = [];
    };
  }, [phase, placesKey, syncZoomLabels]);

  // 3) 선택·추천 표시. 마커를 다시 만들지 않고 data 속성만 바꾼다.
  useEffect(() => {
    if (phase !== 'ready') return;
    const ranked = rankKey ? rankKey.split('|') : [];
    markersRef.current.forEach(({ id, element, overlay }) => {
      const rank = ranked.indexOf(id);
      const selected = id === selectedId;

      if (rank >= 0 && rank < 3) element.dataset.rank = String(rank + 1);
      else delete element.dataset.rank;

      // 추천이 정해진 뒤에는 뽑히지 않은 거점을 지우지 않고 뒤로 물린다.
      element.dataset.dim = String(ranked.length > 0 && rank < 0 && !selected);
      element.dataset.selected = String(selected);
      overlay.setZIndex(selected ? 12 : rank === 0 ? 10 : rank > 0 ? 8 : 5);
    });
  }, [phase, selectedId, rankKey, placesKey]);

  // 4) 현재 위치
  useEffect(() => {
    if (phase !== 'ready') return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    myLocRef.current?.setMap(null);
    myLocRef.current = null;
    if (!userLocation) return;

    const overlay = new maps.CustomOverlay({
      position: new maps.LatLng(userLocation.lat, userLocation.lng),
      content: createMyLocElement(),
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 20,
    });
    overlay.setMap(map);
    myLocRef.current = overlay;
    // 좌표 값만 보면 충분하다 — 객체 참조가 매 렌더 바뀌어도 오버레이를 다시 만들지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, userLocation?.lat, userLocation?.lng]);

  // 5) 프레이밍. fitPoints 는 매 렌더 새 배열이라 ref 로 읽고, 실행 시점만 focusToken 이 정한다.
  useEffect(() => {
    if (phase !== 'ready') return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    const points = fitPointsRef.current;
    if (!points || points.length === 0) {
      fitHwaseong();
      return;
    }
    if (points.length === 1) {
      map.setLevel(5, { animate: true });
      map.panTo(new maps.LatLng(points[0].lat, points[0].lng));
      return;
    }
    const bounds = new maps.LatLngBounds();
    points.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
    map.setBounds(bounds, 72, 56, bottomInsetRef.current + 28, 56);
  }, [phase, focusToken, fitHwaseong]);

  // 6) 컨테이너 크기 변화 → 지도 재배치
  useEffect(() => {
    const container = containerRef.current;
    if (phase !== 'ready' || !container) return;
    let frame = 0;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => mapRef.current?.relayout());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => mapRef.current?.relayout(), RELAYOUT_DEBOUNCE_MS);
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [phase]);

  const handleRetry = () => {
    resetKakaoMapsLoader();
    setRetryToken((t) => t + 1);
  };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-paper ${className}`}>
      <div ref={containerRef} role="region" aria-label="화성시 그냥드림 거점 지도" className="h-full w-full" />

      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-paper">
          <span
            className="h-9 w-9 animate-spin rounded-full border-[3px] border-line-200 border-t-brand-600 motion-reduce:animate-none"
            aria-hidden
          />
          <p className="text-body text-ink-600">지도를 불러오는 중이에요</p>
        </div>
      )}

      {phase === 'missing-key' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-paper px-8 text-center">
          <MapPin size={40} className="text-ink-400" aria-hidden />
          <p className="text-section text-ink-950">지도를 보여드릴 수 없어요</p>
          <p className="text-body text-ink-600">
            아래 버튼으로 가까운 곳을 찾거나,
            <br />
            전화로 물어봐 주세요.
          </p>
        </div>
      )}

      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-paper px-8 text-center">
          <MapPin size={40} className="text-ink-400" aria-hidden />
          <p className="text-section text-ink-950">지도를 불러오지 못했어요</p>
          <p className="text-body text-ink-600">인터넷 연결을 확인하고 다시 시도해 주세요.</p>
          <div className="w-full max-w-[240px]">
            <Button onClick={handleRetry} icon={RotateCcw} size="md" variant="secondary">
              다시 시도
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
