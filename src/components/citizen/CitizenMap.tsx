import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, RotateCcw } from 'lucide-react';
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoMapsNamespace,
  KakaoPolygon,
  KakaoPolyline,
  KakaoProjection,
} from '../../types/kakao';
import { MissingKakaoKeyError, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_FOCUS_BBOX, districtBoundaries } from '../../data/districtBoundaries';
import type { CitizenPlace } from '../../data/citizenDirectory';
import {
  createClusterElement,
  createMarkerElement,
  createMyLocElement,
  markerAriaLabel,
  markerViewOf,
  summarizeByDistrict,
} from './mapMarkers';
import StaticCitizenMap from './StaticCitizenMap';

type MapPhase = 'loading' | 'ready' | 'missing-key' | 'error';

/** 한 곳으로 카메라를 옮길 때의 방식. */
export type MapFocusMode =
  /** 거점 하나가 잘 보이는 줌까지 확대하고 가운데로. 검색 결과처럼 "여기다" 를 말할 때. */
  | 'fit'
  /** 줌은 그대로 두고 가운데로만. 목록·카드에서 고른 것처럼 맥락을 잃으면 안 될 때. */
  | 'pan';

interface CitizenMapProps {
  places: CitizenPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /**
   * 추천 순서대로의 거점 id. 1순위 하나가 지도에서 가장 강하게 보이고 나머지는 뒤로 물러난다.
   * 빈 배열이면 전부 같은 크기의 마커로 깔린다(첫 화면).
   */
  rankedIds?: string[];
  userLocation?: { lat: number; lng: number } | null;
  /** 이 좌표들이 한 화면에 다 보이게 맞춘다. `focusToken` 이 바뀔 때 적용된다. */
  fitPoints?: Array<{ lat: number; lng: number }> | null;
  /** `fitPoints` 가 한 곳일 때의 이동 방식. 기본은 확대까지 하는 'fit'. */
  focusMode?: MapFocusMode;
  /** 값이 바뀌면 지도 프레이밍을 다시 적용한다. 같은 대상을 다시 눌러도 움직이게 한다. */
  focusToken?: number;
  /**
   * 지금 화면에 들어온 거점 id 목록. 하단 카드 목록이 지도와 같은 것을 보게 하는 통로다.
   * 카카오 지도가 뜬 뒤에만 호출된다 — 대체 지도에서는 호출자가 "전부 보인다" 로 다룬다.
   */
  onVisibleChange?: (ids: string[]) => void;
  /** 하단 시트·액션 영역에 가리지 않도록 확보할 여백(px). */
  bottomInset?: number;
  /** 상단 헤더가 지도를 가리는 높이(px). 가시 지도 영역 중앙 계산에 쓴다. */
  topInset?: number;
  className?: string;
}

interface MarkerEntry {
  id: string;
  overlay: KakaoCustomOverlay;
  element: HTMLButtonElement;
  /** 추천 순위가 정해지면 상태 글리프 대신 숫자를 넣는다. */
  icon: HTMLSpanElement;
  place: CitizenPlace;
  dispose: () => void;
}

interface BoundaryShapeGroup {
  dim: KakaoPolygon;
  bounds: KakaoPolyline[];
  dongLines: KakaoPolyline[];
}

const RELAYOUT_DEBOUNCE_MS = 160;

/**
 * 이 레벨 이하(=더 확대)에서만 마커에 상태말("물품 부족")까지 펼친다.
 * 더 넓게 보면 이름만 남겨 캡슐끼리 겹치는 양을 줄인다.
 */
const LABEL_ZOOM_LEVEL = 6;

/**
 * 이 레벨 이상(=더 축소)에서는 개별 마커를 접고 **구역 묶음 카드**만 남긴다.
 * 넓게 볼 때 30개 캡슐을 다 뿌리면 서로 겹쳐 아무것도 못 읽는다 —
 * 그때는 "어느 구에 몇 곳" 이 먼저고, 개별 거점은 한 단계 들어가서 고른다.
 */
const CLUSTER_ZOOM_LEVEL = 8;

/** 이 개수 미만인 구역은 묶지 않는다. 한 곳을 숫자 카드로 감추면 오히려 멀어진다. */
const CLUSTER_MIN_PLACES = 2;

/** 첫 화면·초기화 시 화성시 중심을 보여줄 고정 줌 레벨. */
const HWASEONG_OVERVIEW_LEVEL = 10;

/** 거점 하나를 선택·포커스할 때 적용할 줌 레벨. 모든 선택 경로가 이 값을 공유한다. */
const SITE_FOCUS_LEVEL = 4;

/**
 * 이 레벨보다 더 확대(= 숫자가 작음)된 상태에서는
 * 광역 오버레이(외부 dim + 행정구역 경계선)를 숨긴다.
 */
const OVERLAY_HIDE_ZOOM = 8;

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
 * 외부 영역은 rgba(10,18,28,0.52)로 확실히 어둡게 깔아 화성시 내/외부를 즉시 구분하고,
 * 화성시 외곽에 진한 차콜 선을 추가해 경계를 명확히 한다.
 * 내부 읍·면·동 구분은 얇은 파란 선이 맡는다.
 */
function drawBoundaries(maps: KakaoMapsNamespace, map: KakaoMap): BoundaryShapeGroup {
  const toPath = (ring: [number, number][]) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng));

  const world: [number, number][] = [
    [124.0, 34.5],
    [130.0, 34.5],
    [130.0, 39.5],
    [124.0, 39.5],
  ];
  const holes = districtBoundaries.flatMap((d) => d.outline).map((ring) => orientRing(ring, false));
  // 화성시 외부 전체를 어둡게 — 내부는 기존 지도 밝기 그대로 유지
  // clickable: false — 이 폴리곤이 클릭/터치 이벤트를 가로채지 않도록 한다.
  // 폴리곤이 이벤트를 소비하면 지도 드래그 시작점이 외부 영역에 있을 때 드래그가 안 되거나
  // 마커 클릭이 차단될 수 있다.
  const dim = new maps.Polygon({
    path: [toPath(orientRing(world, true)), ...holes.map(toPath)],
    strokeWeight: 0,
    strokeOpacity: 0,
    fillColor: '#0a121c',
    fillOpacity: 0.52,
    zIndex: 1,
    clickable: false,
  });
  dim.setMap(map);

  // 화성시 외곽 경계선 — 진한 차콜로 내/외부 경계를 명확히 그린다
  const bounds: KakaoPolyline[] = [];
  districtBoundaries.forEach((district) => {
    district.outline.forEach((ring) => {
      const outline = new maps.Polyline({
        path: toPath(ring),
        strokeWeight: 2.5,
        strokeColor: '#111827',
        strokeOpacity: 0.85,
        strokeStyle: 'solid',
        zIndex: 4,
      });
      outline.setMap(map);
      bounds.push(outline);
    });
  });

  // 내부 읍·면·동 경계 — 조용한 파란 선으로 구역만 알린다
  const dongLines: KakaoPolyline[] = [];
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
          dongLines.push(line);
        });
        void inner;
      });
    });
  });

  return { dim, bounds, dongLines };
}

/** dim / 경계선 / 동 경계선 한꺼번에 보이기/숨기기. setMap 재생성 없이 opacity 만 토글해 깜박임을 없앤다. */
function setBoundaryVisible(group: BoundaryShapeGroup, visible: boolean) {
  group.dim.setOptions({ fillOpacity: visible ? 0.52 : 0 });
  group.bounds.forEach((p) => p.setOptions({ strokeOpacity: visible ? 0.85 : 0 }));
  group.dongLines.forEach((p) => p.setOptions({ strokeOpacity: visible ? 0.22 : 0 }));
}

/**
 * 지도 projection 을 이용해 단일 거점을 "실제 가시 지도 영역"의 정중앙에 배치한다.
 *
 * panTo 는 컨테이너 전체(=하단 패널 포함)의 중앙을 기준으로 이동하기 때문에
 * 마커가 패널 뒤로 가려지거나 화면 아래쪽에 치우친다.
 * 여기서는 setCenter 로 먼저 대상 좌표를 컨테이너 정중앙에 놓은 뒤,
 * projection 으로 "topInset·bottomInset 을 뺀 가시 영역 중앙 픽셀"에 해당하는
 * 지도 좌표를 구하고, panTo 로 그 좌표로 부드럽게 이동한다.
 */
function panToVisibleCenter(
  maps: KakaoMapsNamespace,
  map: KakaoMap,
  proj: KakaoProjection,
  container: HTMLElement,
  lat: number,
  lng: number,
  topInset: number,
  bottomInset: number,
) {
  const coord = new maps.LatLng(lat, lng);
  // 우선 대상 좌표를 컨테이너 정중앙에 배치 (애니메이션 없이 즉시)
  map.setCenter(coord);

  const containerH = container.offsetHeight;
  const containerW = container.offsetWidth;
  // 가시 지도 영역의 Y 중앙 (topInset ~ containerH-bottomInset 사이의 중앙)
  const visibleCenterY = topInset + (containerH - topInset - bottomInset) / 2;
  const dy = Math.round(containerH / 2 - visibleCenterY); // = (bottomInset - topInset) / 2

  if (Math.abs(dy) <= 1) {
    // 오프셋이 무시할 정도로 작으면 그냥 panTo
    map.panTo(coord);
    return;
  }

  // setCenter 후에는 coord 가 (containerW/2, containerH/2) 에 위치한다.
  // 가시 중앙(visibleCenterY)에 coord 를 두려면 지도 center 를
  // (containerW/2, containerH/2 + dy) 픽셀에 해당하는 지도 좌표로 이동해야 한다.
  const shiftedCenter = proj.coordsFromContainerPoint({ x: containerW / 2, y: containerH / 2 + dy });
  map.panTo(shiftedCenter);
}

/**
 * 시민용 지도.
 *
 * 이 지도의 목표는 "예쁜 지도" 가 아니라 **누르기 쉬운 지도** 다. 그래서 거점을 작은 점이
 * 아니라 이름표가 붙은 캡슐 버튼으로 세우고, 캡슐 전체를 하나의 터치 목표로 만든다.
 * 넓게 볼 때는 캡슐 대신 구역 묶음 카드(`효행구 3곳`)만 남겨 겹침을 없애고,
 * 지금 화면에 든 거점은 `onVisibleChange` 로 알려 하단 카드 목록과 같은 것을 보게 한다.
 */
export default function CitizenMap({
  places,
  selectedId,
  onSelect,
  rankedIds,
  userLocation = null,
  fitPoints = null,
  focusMode = 'fit',
  focusToken = 0,
  onVisibleChange,
  bottomInset = 0,
  topInset = 0,
  className = '',
}: CitizenMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const clusterOverlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const myLocRef = useRef<KakaoCustomOverlay | null>(null);
  const boundaryRef = useRef<BoundaryShapeGroup | null>(null);
  const teardownRef = useRef<(() => void)[]>([]);
  /** 마지막으로 알린 가시 거점 목록. 같은 값을 반복해서 올려보내지 않기 위한 것. */
  const visibleKeyRef = useRef<string>('');

  const [phase, setPhase] = useState<MapPhase>('loading');
  const [retryToken, setRetryToken] = useState(0);

  // 콜백은 ref 로 읽는다 — 부모가 매 렌더 새 함수를 줘도 마커를 다시 만들지 않기 위해서다.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onVisibleChangeRef = useRef(onVisibleChange);
  onVisibleChangeRef.current = onVisibleChange;
  const bottomInsetRef = useRef(bottomInset);
  bottomInsetRef.current = bottomInset;
  const topInsetRef = useRef(topInset);
  topInsetRef.current = topInset;
  const fitPointsRef = useRef(fitPoints);
  fitPointsRef.current = fitPoints;
  const focusModeRef = useRef(focusMode);
  focusModeRef.current = focusMode;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const rankedIdsRef = useRef(rankedIds ?? []);
  rankedIdsRef.current = rankedIds ?? [];

  const placesKey = useMemo(() => places.map((p) => p.id).join('|'), [places]);
  const rankKey = (rankedIds ?? []).join('|');

  /**
   * 화성시 중심으로 맞춘다. 세로로 좁은 휴대폰 화면에 가로로 넓은 시 경계 전체를
   * 억지로 다 넣으면(=bounds fit) 서울·인천까지 보일 만큼 과하게 멀어진다 —
   * 그러면 지도가 "화성시" 가 아니라 "수도권" 으로 읽힌다. 그래서 경계를 다 채우기보다
   * 시 중심에서 적당히 확대된 고정 레벨을 쓴다.
   */
  const fitHwaseong = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const [minLng, minLat, maxLng, maxLat] = HWASEONG_FOCUS_BBOX;
    map.setCenter(new maps.LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2));
    map.setLevel(HWASEONG_OVERVIEW_LEVEL);
  }, []);

  const syncZoomLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoomed = map.getLevel() <= LABEL_ZOOM_LEVEL;
    markersRef.current.forEach(({ element }) => {
      element.dataset.zoomed = String(zoomed);
    });
  }, []);

  /**
   * 선택 상태 또는 줌 레벨에 따라 광역 오버레이(외부 dim + 행정구역선)를 보이거나 숨긴다.
   * 거점을 선택했거나 충분히 확대한 상태에서는 오버레이가 불필요하고 지도를 복잡하게 만든다.
   */
  const updateOverlayVisibility = useCallback(() => {
    const map = mapRef.current;
    const boundary = boundaryRef.current;
    if (!map || !boundary) return;
    const show = selectedIdRef.current === null && map.getLevel() > OVERLAY_HIDE_ZOOM;
    setBoundaryVisible(boundary, show);
  }, []);

  const placesRef = useRef(places);
  placesRef.current = places;

  /** 지금 화면에 들어온 거점을 부모에게 알린다. 하단 카드 목록이 이 값을 그대로 쓴다. */
  const emitVisible = useCallback(() => {
    const map = mapRef.current;
    const notify = onVisibleChangeRef.current;
    if (!map || !notify) return;
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const ids = placesRef.current
      .filter(
        (p) =>
          p.lat >= sw.getLat() && p.lat <= ne.getLat() && p.lng >= sw.getLng() && p.lng <= ne.getLng(),
      )
      .map((p) => p.id);
    const key = ids.join('|');
    if (key === visibleKeyRef.current) return;
    visibleKeyRef.current = key;
    notify(ids);
  }, []);

  /**
   * 넓게 볼 때(= CLUSTER_ZOOM_LEVEL 이상) 개별 캡슐을 접고 구(區) 단위 묶음 카드만 남긴다.
   * 선택되었거나 추천에 든 거점은 접지 않는다 — "지금 이 결과" 는 항상 개별로 보여야 한다.
   */
  const updateClusters = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    clusterOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
    clusterOverlaysRef.current = [];

    const detailed = map.getLevel() <= CLUSTER_ZOOM_LEVEL;
    if (detailed) {
      markersRef.current.forEach(({ element }) => {
        element.dataset.clustered = 'false';
      });
      return;
    }

    const pinned = new Set<string>([
      ...rankedIdsRef.current,
      ...(selectedIdRef.current ? [selectedIdRef.current] : []),
    ]);
    const byId = new Map(markersRef.current.map((entry) => [entry.id, entry]));

    const groupable: CitizenPlace[] = [];
    markersRef.current.forEach((entry) => {
      if (pinned.has(entry.id)) {
        entry.element.dataset.clustered = 'false';
        return;
      }
      groupable.push(entry.place);
    });

    summarizeByDistrict(groupable).forEach((summary) => {
      if (summary.count < CLUSTER_MIN_PLACES) {
        summary.placeIds.forEach((id) => {
          const entry = byId.get(id);
          if (entry) entry.element.dataset.clustered = 'false';
        });
        return;
      }
      summary.placeIds.forEach((id) => {
        const entry = byId.get(id);
        if (entry) entry.element.dataset.clustered = 'true';
      });

      const element = createClusterElement(summary);
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        // 묶음을 누르면 그 구역 거점들이 개별 캡슐로 풀릴 만큼 확대한다.
        // 하단 카드 목록도 같은 순간 이 구역 거점들로 바뀐다(onVisibleChange).
        const bounds = new maps.LatLngBounds();
        summary.placeIds.forEach((id) => {
          const place = placesRef.current.find((p) => p.id === id);
          if (place) bounds.extend(new maps.LatLng(place.lat, place.lng));
        });
        if (!bounds.isEmpty()) {
          map.setBounds(bounds, topInsetRef.current + 40, 56, bottomInsetRef.current + 40, 56);
        }
        // setBounds 결과가 여전히 묶음 구간이면 카드를 눌러도 아무 일이 없어 보인다.
        // 한 단계 더 들어가 반드시 개별 캡슐이 나오게 한다.
        if (map.getLevel() > CLUSTER_ZOOM_LEVEL) map.setLevel(CLUSTER_ZOOM_LEVEL);
        syncZoomLabels();
        updateClusters();
        updateOverlayVisibility();
        emitVisible();
      };
      element.addEventListener('click', onClick);

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(summary.lat, summary.lng),
        content: element,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 6,
        clickable: true,
      });
      overlay.setMap(map);
      clusterOverlaysRef.current.push(overlay);
    });
  }, [emitVisible, syncZoomLabels, updateOverlayVisibility]);

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

        boundaryRef.current = drawBoundaries(maps, map);
        teardownRef.current.push(() => {
          const b = boundaryRef.current;
          if (b) {
            b.dim.setMap(null);
            b.bounds.forEach((s) => s.setMap(null));
            b.dongLines.forEach((s) => s.setMap(null));
            boundaryRef.current = null;
          }
        });

        const onBgClick = () => onSelectRef.current(null);
        maps.event.addListener(map, 'click', onBgClick);
        teardownRef.current.push(() => maps.event.removeListener(map, 'click', onBgClick));

        const onZoom = () => {
          syncZoomLabels();
          updateClusters();
          updateOverlayVisibility();
        };
        maps.event.addListener(map, 'zoom_changed', onZoom);
        teardownRef.current.push(() => maps.event.removeListener(map, 'zoom_changed', onZoom));

        // 이동·확대가 끝난 시점에만 목록을 갱신한다 — 드래그 중 매 프레임 리렌더를 피한다.
        const onIdle = () => emitVisible();
        maps.event.addListener(map, 'idle', onIdle);
        teardownRef.current.push(() => maps.event.removeListener(map, 'idle', onIdle));

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
      // 마커·클러스터·현재위치 오버레이를 먼저 명시적으로 제거한다.
      // 단순히 ref 를 비우기만 하면 Kakao CustomOverlay 인스턴스가 지도에 남아
      // 컴포넌트 재마운트 시 새 마커와 겹쳐 보이는 중복 버그가 생긴다.
      markersRef.current.forEach((m) => m.dispose());
      markersRef.current = [];
      clusterOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      clusterOverlaysRef.current = [];
      myLocRef.current?.setMap(null);
      myLocRef.current = null;
      teardownRef.current.forEach((fn) => fn());
      teardownRef.current = [];
      boundaryRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
      visibleKeyRef.current = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  // 2) 거점 마커 — 거점 목록이 실제로 바뀔 때만 다시 만든다.
  useEffect(() => {
    if (phase !== 'ready') return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    markersRef.current = placesRef.current.map((place) => {
      const { root, icon } = createMarkerElement(place);
      // 캡슐 어디를 눌러도(아이콘·이름·상태말) 같은 선택이 일어난다.
      // stopPropagation 은 지도 배경 클릭 핸들러가 곧바로 선택을 지우는 것을 막는다.
      const onClick = (e: MouseEvent) => {
        e.stopPropagation();
        onSelectRef.current(place.id);
      };
      root.addEventListener('click', onClick);

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(place.lat, place.lng),
        content: root,
        // 캡슐 아래 꼬리 끝이 실제 좌표를 가리킨다.
        yAnchor: 1,
        xAnchor: 0.5,
        zIndex: 5,
        clickable: true,
      });
      overlay.setMap(map);

      return {
        id: place.id,
        overlay,
        element: root,
        icon,
        place,
        dispose: () => {
          root.removeEventListener('click', onClick);
          overlay.setMap(null);
        },
      };
    });
    syncZoomLabels();
    updateClusters();
    visibleKeyRef.current = '';
    emitVisible();

    const created = markersRef.current;
    return () => {
      created.forEach((m) => m.dispose());
      markersRef.current = [];
      clusterOverlaysRef.current.forEach((overlay) => overlay.setMap(null));
      clusterOverlaysRef.current = [];
    };
  }, [phase, placesKey, syncZoomLabels, updateClusters, emitVisible]);

  // 3) 선택·추천 표시. 마커를 다시 만들지 않고 data 속성만 바꾼다.
  useEffect(() => {
    if (phase !== 'ready') return;
    const ranked = rankKey ? rankKey.split('|') : [];
    markersRef.current.forEach(({ id, element, icon, overlay, place }) => {
      const rank = ranked.indexOf(id);
      const selected = id === selectedId;
      const view = markerViewOf(place);

      if (rank >= 0 && rank < 3) element.dataset.rank = String(rank + 1);
      else delete element.dataset.rank;

      // 추천에 든 거점은 아이콘 자리에 순위 숫자를 세운다 — 색이 아니라 숫자로 순서를 말한다.
      icon.textContent = rank >= 0 && rank < 3 ? String(rank + 1) : view.glyph;
      element.setAttribute(
        'aria-label',
        markerAriaLabel(place, view, rank >= 0 && rank < 3 ? rank + 1 : null),
      );

      // 추천이 정해진 뒤에도 뽑히지 않은 거점을 지우지 않는다. 흐리게 두되 계속 누를 수 있다.
      element.dataset.dim = String(ranked.length > 0 && rank < 0 && !selected);
      element.dataset.selected = String(selected);
      overlay.setZIndex(selected ? 40 : rank === 0 ? 30 : rank > 0 ? 20 : 10 - view.priority);
    });
    // 선택·추천이 바뀌면 묶음 대상도 바뀐다 — 고정 목록을 새로 반영해 다시 묶는다.
    updateClusters();
    // 거점 선택 여부가 바뀌면 광역 오버레이 표시도 즉시 반영한다.
    updateOverlayVisibility();
  }, [phase, selectedId, rankKey, placesKey, updateClusters, updateOverlayVisibility]);

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
    const container = containerRef.current;
    if (!maps || !map || !container) return;

    const points = fitPointsRef.current;
    if (!points || points.length === 0) {
      fitHwaseong();
      return;
    }

    if (points.length === 1) {
      if (focusModeRef.current === 'fit') {
        map.setLevel(SITE_FOCUS_LEVEL);
      } else if (map.getLevel() > CLUSTER_ZOOM_LEVEL) {
        // 'pan' 이라도 묶음 구간에 머무르면 주변 거점이 전부 접혀 비교가 안 된다.
        // 개별 캡슐이 보이는 최소 단계까지만 당긴다.
        map.setLevel(CLUSTER_ZOOM_LEVEL);
      }
      const proj = map.getProjection();
      panToVisibleCenter(
        maps, map, proj, container,
        points[0].lat, points[0].lng,
        topInsetRef.current, bottomInsetRef.current,
      );
      return;
    }

    // 복수 포인트: setBounds 의 asymmetric padding 으로 가시 영역에 맞춘다.
    const bounds = new maps.LatLngBounds();
    points.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
    map.setBounds(bounds, topInsetRef.current + 28, 56, bottomInsetRef.current + 28, 56);
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

      {/*
        카카오맵을 못 쓰는 환경(키 없음·도메인 미등록·네트워크 차단)에서도
        "내가 어디 있고 갈 곳이 어디인지" 는 보여 준다. 예전에는 회색 안내판만 남아
        첫 화면의 지도가 통째로 사라졌다. 도로·지명 배경만 없고 조작은 그대로다.
      */}
      {(phase === 'missing-key' || phase === 'error') && (
        <>
          <StaticCitizenMap
            places={places}
            selectedId={selectedId}
            onSelect={onSelect}
            rankedIds={rankedIds}
            userLocation={userLocation}
            fitPoints={fitPoints}
            bottomInset={bottomInset}
          />

          {/* 왜 배경이 다른지 한 줄로 알린다 — 조용히 다른 지도를 내밀지 않는다. */}
          <div
            className="pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4"
            style={{ bottom: bottomInset + 12 }}
          >
            <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full bg-surface/95 px-3 py-1.5 shadow-raise ring-1 ring-ink-950/5">
              <MapPin size={15} className="shrink-0 text-ink-400" aria-hidden />
              <span className="truncate text-note text-ink-600">간이 지도 · 도로 정보는 없어요</span>
              {phase === 'error' && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-note font-bold text-brand-700 focus-ring"
                >
                  <RotateCcw size={14} aria-hidden />
                  다시 시도
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
