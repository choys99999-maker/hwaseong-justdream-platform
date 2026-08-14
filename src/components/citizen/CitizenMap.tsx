import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, RotateCcw, MapPin } from 'lucide-react';
import type {
  KakaoCustomOverlay,
  KakaoMap,
  KakaoMapsNamespace,
  KakaoPolygon,
  KakaoPolyline,
} from '../../types/kakao';
import { MissingKakaoKeyError, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_FOCUS_BBOX, districtBoundaries } from '../../data/districtBoundaries';
import {
  type CitizenSite,
  SITE_OVERALL_STATUS_COLORS,
  SITE_OVERALL_STATUS_LABELS,
} from '../../data/citizenData';

type MapPhase = 'loading' | 'ready' | 'missing-key' | 'error';

interface CitizenMapProps {
  sites: CitizenSite[];
  selectedSiteId: string | null;
  onSelectSite: (siteId: string | null) => void;
  /** 이 값이 바뀌면 해당 지점으로 지도를 이동하고 선택 상태로 만든다 */
  focusSiteId?: string | null;
  /** true 이면 내부 컨트롤 버튼·범례를 숨긴다 (홈 화면 등 외부에서 제어할 때 사용) */
  hideControls?: boolean;
  className?: string;
}

interface MarkerEntry {
  site: CitizenSite;
  overlay: KakaoCustomOverlay;
  element: HTMLButtonElement;
}

const RELAYOUT_DEBOUNCE_MS = 160;

/**
 * 이 레벨 이하(= 더 확대)로 들어가야 거점 이름표를 띄운다.
 * 카카오맵은 숫자가 작을수록 확대다. 화성시 전체는 레벨 9 정도라
 * 그 상태에서 이름 11개가 다 뜨면 서로 겹쳐 읽히지 않는다.
 */
const LABEL_ZOOM_LEVEL = 6;

function createPinElement(site: CitizenSite): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cj-pin';
  btn.dataset.status = site.overallStatus;
  btn.dataset.selected = 'false';
  btn.dataset.zoomed = 'false';
  btn.setAttribute(
    'aria-label',
    `${site.name} · ${SITE_OVERALL_STATUS_LABELS[site.overallStatus]}`,
  );

  const dot = document.createElement('span');
  dot.className = 'cj-pin-dot';

  const name = document.createElement('span');
  name.className = 'cj-pin-name';
  name.textContent = site.name;

  btn.appendChild(dot);
  btn.appendChild(name);
  return btn;
}

/**
 * 읍·면·동 구분 색. 채도를 낮춘 8색을 순환시켜 이웃 구역이 서로 다른 색이 되게 한다.
 * 원색을 쓰면 지도가 알록달록해져 핀이 묻히므로, 전부 옅은 톤으로만 골랐다.
 */
const AREA_COLORS = [
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#6366f1', // indigo
  '#84cc16', // lime
];

/** 링의 부호 있는 면적. 양수면 반시계(CCW), 음수면 시계(CW). */
function ringSignedArea(ring: [number, number][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return sum / 2;
}

/** 링을 원하는 방향으로 정규화한다. 구멍은 외곽선과 반대 방향이어야 nonzero 규칙에서 뚫린다. */
function orientRing(ring: [number, number][], wantCCW: boolean): [number, number][] {
  const isCCW = ringSignedArea(ring) > 0;
  return isCCW === wantCCW ? ring : [...ring].reverse();
}

/**
 * 화성시 경계를 그린다.
 *
 * ① 화성시 바깥을 덮는 마스크 — 세계 사각형에서 화성시 외곽선을 구멍으로 뚫은 폴리곤 하나.
 *    우리가 맡은 건 화성시뿐이라 이웃 도시(수원·오산·평택)는 눌러 둔다.
 * ② 읍·면·동 29개를 실제 GIS 폴리곤 그대로, 각각 다른 옅은 색 면으로.
 * ③ 읍·면·동 경계선 — 면보다 또렷하게, 그러나 거점 핀을 이기지 않게.
 *
 * 폴리곤은 좌표 기반이라 확대·축소해도 경계가 그대로 따라간다.
 */
function drawBoundaries(maps: KakaoMapsNamespace, map: KakaoMap): Array<KakaoPolygon | KakaoPolyline> {
  const shapes: Array<KakaoPolygon | KakaoPolyline> = [];
  const toPath = (ring: [number, number][]) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng));

  // ① 바깥 마스크 — 외곽은 CCW, 구멍은 CW 로 맞춰야 확실히 뚫린다.
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
    fillColor: '#0f172a',
    fillOpacity: 0.42,
    zIndex: 1,
  });
  mask.setMap(map);
  shapes.push(mask);

  // ② + ③ 읍·면·동 면과 경계선
  let colorIndex = 0;
  districtBoundaries.forEach((district) => {
    district.areas.forEach((area) => {
      const color = AREA_COLORS[colorIndex++ % AREA_COLORS.length];

      area.polygons.forEach((polygon) => {
        const [outer, ...innerHoles] = polygon;
        if (!outer) return;

        const fill = new maps.Polygon({
          path: [
            toPath(orientRing(outer, true)),
            ...innerHoles.map((h) => toPath(orientRing(h, false))),
          ],
          strokeWeight: 0,
          strokeOpacity: 0,
          fillColor: color,
          fillOpacity: 0.2,
          zIndex: 2,
        });
        fill.setMap(map);
        shapes.push(fill);

        // 경계선은 링마다 따로 그린다 — 구멍 경계도 보여야 구역이 정확히 읽힌다.
        polygon.forEach((ring) => {
          const line = new maps.Polyline({
            path: toPath(ring),
            strokeWeight: 2,
            strokeColor: color,
            strokeOpacity: 0.85,
            strokeStyle: 'solid',
            zIndex: 3,
          });
          line.setMap(map);
          shapes.push(line);
        });
      });
    });
  });

  return shapes;
}

function createMyLocElement(): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'cj-my-loc';
  const dot = document.createElement('div');
  dot.className = 'cj-my-loc-dot';
  wrap.appendChild(dot);
  return wrap;
}

export default function CitizenMap({
  sites,
  selectedSiteId,
  onSelectSite,
  focusSiteId,
  hideControls = false,
  className = '',
}: CitizenMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const myLocOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const boundaryRef = useRef<Array<KakaoPolygon | KakaoPolyline>>([]);
  const cleanupRef = useRef<(() => void)[]>([]);

  const [phase, setPhase] = useState<MapPhase>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');

  const handlersRef = useRef({ onSelectSite });
  handlersRef.current = { onSelectSite };

  /** 화성시 전체 범위로 맞추기. 서해 도서까지 넣으면 화면 대부분이 바다라 본토 범위를 쓴다. */
  const fitHwaseong = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const [minLng, minLat, maxLng, maxLat] = HWASEONG_FOCUS_BBOX;
    const bounds = new maps.LatLngBounds(
      new maps.LatLng(minLat, minLng),
      new maps.LatLng(maxLat, maxLng),
    );
    map.setBounds(bounds, 40, 40, 40, 40);
  }, []);

  /** 지금 확대 레벨에 맞춰 핀 이름표를 켜고 끈다. */
  const syncPinLabels = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoomed = map.getLevel() <= LABEL_ZOOM_LEVEL;
    markersRef.current.forEach(({ element }) => {
      element.dataset.zoomed = String(zoomed);
    });
  }, []);

  /** 특정 지점으로 지도 이동 */
  const panToSite = useCallback((siteId: string) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const marker = markersRef.current.find((m) => m.site.id === siteId);
    if (!marker) return;
    map.panTo(new maps.LatLng(marker.site.lat, marker.site.lng));
    map.setLevel(5, { animate: true });
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
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        mapRef.current = map;

        boundaryRef.current = drawBoundaries(maps, map);
        cleanupRef.current.push(() => {
          boundaryRef.current.forEach((s) => s.setMap(null));
          boundaryRef.current = [];
        });

        // 배경 클릭 → 선택 해제
        const onBgClick = () => handlersRef.current.onSelectSite(null);
        maps.event.addListener(map, 'click', onBgClick);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'click', onBgClick));

        // 확대 레벨이 바뀌면 핀 이름표를 켜고 끈다
        const onZoom = () => syncPinLabels();
        maps.event.addListener(map, 'zoom_changed', onZoom);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'zoom_changed', onZoom));

        // 거점 마커 생성
        sites.forEach((site) => {
          const element = createPinElement(site);
          const onClick = (e: MouseEvent) => {
            e.stopPropagation();
            handlersRef.current.onSelectSite(site.id);
          };
          element.addEventListener('click', onClick);

          const overlay = new maps.CustomOverlay({
            position: new maps.LatLng(site.lat, site.lng),
            content: element,
            yAnchor: 1.3,
            xAnchor: 0.5,
            zIndex: 5,
            clickable: true,
          });
          overlay.setMap(map);

          cleanupRef.current.push(() => {
            element.removeEventListener('click', onClick);
            overlay.setMap(null);
          });
          markersRef.current.push({ site, overlay, element });
        });

        fitHwaseong();
        syncPinLabels();
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
      cleanupRef.current.forEach((d) => d());
      cleanupRef.current = [];
      markersRef.current = [];
      myLocOverlayRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  // 2) 선택 상태 동기화
  useEffect(() => {
    if (phase !== 'ready') return;
    markersRef.current.forEach(({ site, element, overlay }) => {
      const isSelected = site.id === selectedSiteId;
      element.dataset.selected = String(isSelected);
      overlay.setZIndex(isSelected ? 9 : 5);
    });
  }, [phase, selectedSiteId]);

  // 3) focusSiteId 변경 → 지도 이동
  useEffect(() => {
    if (phase !== 'ready' || !focusSiteId) return;
    panToSite(focusSiteId);
  }, [phase, focusSiteId, panToSite]);

  // 4) ResizeObserver
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

  /** 내 위치 버튼 */
  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setLocStatus('denied');
      return;
    }
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const maps = mapsRef.current;
        const map = mapRef.current;
        if (!maps || !map) return;

        const { latitude, longitude } = pos.coords;
        const latLng = new maps.LatLng(latitude, longitude);

        // 기존 위치 오버레이 제거
        myLocOverlayRef.current?.setMap(null);

        const el = createMyLocElement();
        const overlay = new maps.CustomOverlay({
          position: latLng,
          content: el,
          yAnchor: 0.5,
          xAnchor: 0.5,
          zIndex: 20,
        });
        overlay.setMap(map);
        myLocOverlayRef.current = overlay;

        map.panTo(latLng);
        map.setLevel(7, { animate: true });
        setLocStatus('ok');
      },
      () => setLocStatus('denied'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleRetry = () => {
    resetKakaoMapsLoader();
    setRetryToken((t) => t + 1);
  };

  return (
    <div className={`relative w-full h-full overflow-hidden bg-slate-100 ${className}`}>
      <div
        ref={containerRef}
        role="region"
        aria-label="화성시 그냥드림 지점 지도"
        className="w-full h-full"
      />

      {/* 오른쪽 하단 컨트롤 버튼 */}
      {phase === 'ready' && !hideControls && (
        <div className="absolute bottom-5 left-4 flex flex-col gap-2 z-10">
          {/* 내 위치 */}
          <button
            type="button"
            onClick={handleMyLocation}
            disabled={locStatus === 'loading'}
            aria-label="내 위치 찾기"
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 text-sm font-bold text-slate-700 shadow-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-60"
          >
            <LocateFixed
              size={18}
              className={locStatus === 'loading' ? 'animate-spin text-teal-600' : locStatus === 'ok' ? 'text-teal-600' : 'text-slate-500'}
            />
            내 위치
          </button>

          {/* 전체 보기 */}
          <button
            type="button"
            onClick={fitHwaseong}
            aria-label="화성시 전체 보기"
            className="flex items-center gap-2 bg-white rounded-full px-4 py-2.5 text-sm font-bold text-slate-700 shadow-lg border border-slate-200 hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            <MapPin size={18} className="text-slate-500" />
            전체 보기
          </button>
        </div>
      )}

      {/* 위치 거부 안내 */}
      {locStatus === 'denied' && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg">
          위치 권한이 거부되었습니다
        </div>
      )}

      {/* 지도 범례 */}
      {phase === 'ready' && !hideControls && (
        <div className="absolute top-3 left-3 z-10 bg-white/95 rounded-xl px-3 py-2 shadow border border-slate-100">
          <p className="text-xs font-bold text-slate-500 mb-1.5">재고 현황</p>
          {(Object.entries(SITE_OVERALL_STATUS_LABELS) as [string, string][]).map(([status, label]) => (
            <div key={status} className="flex items-center gap-1.5 mb-1 last:mb-0">
              <span
                className="inline-block w-3 h-3 rounded-full border-2 border-white/60"
                style={{ background: SITE_OVERALL_STATUS_COLORS[status as keyof typeof SITE_OVERALL_STATUS_COLORS] }}
              />
              <span className="text-xs text-slate-700">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* 로딩 */}
      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-teal-500" />
          <p className="text-base font-medium text-slate-500">지도를 불러오는 중이에요…</p>
        </div>
      )}

      {/* API 키 없음 */}
      {phase === 'missing-key' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 px-8 text-center">
          <MapPin size={40} className="text-slate-300" />
          <p className="text-lg font-bold text-slate-700">지도를 표시할 수 없어요</p>
          <p className="text-sm text-slate-500">
            카카오맵 API 키가 필요합니다.
            <br />
            관리자에게 문의해 주세요.
          </p>
        </div>
      )}

      {/* 에러 */}
      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-50 px-8 text-center">
          <MapPin size={40} className="text-red-300" />
          <p className="text-lg font-bold text-slate-700">지도를 불러오지 못했어요</p>
          <p className="text-sm text-slate-500">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 bg-teal-600 text-white font-bold px-6 py-3 rounded-2xl text-base shadow hover:bg-teal-700 active:bg-teal-800 transition-colors"
          >
            <RotateCcw size={18} />
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
