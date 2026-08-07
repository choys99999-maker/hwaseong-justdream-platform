import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, KeyRound, RotateCw } from 'lucide-react';
import type { DistrictId, OperationSite, SiteStatus } from '../../types';
import type { KakaoCustomOverlay, KakaoMap, KakaoMapsNamespace, KakaoPolygon, KakaoPolyline } from '../../types/kakao';
import { KAKAO_KEY_ENV_NAME, MissingKakaoKeyError, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_FOCUS_BBOX, districtBoundaries, getDistrictBBox } from '../../data/districtBoundaries';
import { SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';

/** 폴리곤 표현 기준. 지명과 도로가 읽히도록 기본 채도를 낮게 유지한다. */
const POLYGON_STYLE = {
  base: { strokeWeight: 2, strokeOpacity: 0.85, fillOpacity: 0.18, zIndex: 1 },
  hover: { strokeWeight: 3, strokeOpacity: 1, fillOpacity: 0.28, zIndex: 3 },
  selected: { strokeWeight: 3, strokeOpacity: 1, fillOpacity: 0.24, zIndex: 4 },
  dimmed: { strokeWeight: 1, strokeOpacity: 0.35, fillOpacity: 0.07, zIndex: 1 },
} as const;

/**
 * 구 경계선. 읍면동 경계(strokeWeight 1~3)보다는 굵되, 카카오맵 지명·도로를 덮지 않도록
 * 중간 회색·반투명으로 눌러 둔다. 상태 색상(fill)은 그대로 두고 경계선만 얹는다.
 */
const DISTRICT_OUTLINE_COLOR = '#475569';
const DISTRICT_OUTLINE_STYLE = {
  base: { strokeWeight: 3, strokeOpacity: 0.75, zIndex: 6 },
  selected: { strokeWeight: 4, strokeOpacity: 0.9, zIndex: 8 },
  dimmed: { strokeWeight: 2, strokeOpacity: 0.25, zIndex: 6 },
} as const;

const BOUNDS_PADDING = 24;
const RELAYOUT_DEBOUNCE_MS = 160;
/**
 * 카카오맵 레벨(level) 이 이 값 이상이면 구 단위 클러스터 오버레이를 표시하고
 * 개별 마커는 숨긴다. Kakao level ≥ 9 ≈ 화성시 전체가 뷰포트에 들어오는 광역 줌.
 */
const CLUSTER_ZOOM_THRESHOLD = 9;

type MapPhase = 'loading' | 'ready' | 'missing-key' | 'error';

interface KakaoDistrictMapProps {
  sites: OperationSite[];
  districtRiskLevels: Record<DistrictId, SiteStatus>;
  selectedDistrict: DistrictId | null;
  selectedSiteId: string | null;
  onSelectDistrict: (district: DistrictId | null) => void;
  onSelectSite: (siteId: string) => void;
  /** 폴리곤·마커·컨트롤이 아닌 지도 배경을 클릭했을 때만 호출된다. */
  onMapClick?: () => void;
  /** 마커 가시성 필터. 반환값이 false 면 해당 거점 마커를 숨긴다. */
  filterFn?: (site: OperationSite) => boolean;
}

interface PolygonEntry {
  district: DistrictId;
  polygon: KakaoPolygon;
}

interface OutlineEntry {
  district: DistrictId;
  polyline: KakaoPolyline;
}

interface MarkerEntry {
  site: OperationSite;
  overlay: KakaoCustomOverlay;
  element: HTMLButtonElement;
}

interface ClusterEntry {
  districtId: DistrictId;
  overlay: KakaoCustomOverlay;
  element: HTMLDivElement;
}

function createMarkerElement(site: OperationSite): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gj-marker';
  button.style.backgroundColor = SITE_STATUS_COLORS[site.status].fill;
  button.style.borderColor = '#ffffff';
  button.setAttribute('aria-label', `${site.name} · ${SITE_STATUS_LABELS[site.status]}`);
  button.dataset.selected = 'false';

  const label = document.createElement('span');
  label.className = 'gj-marker-label';
  label.textContent = site.name;
  button.appendChild(label);

  return button;
}

function createClusterElement(districtName: string): HTMLDivElement {
  const div = document.createElement('div');
  div.className = 'gj-cluster';
  div.setAttribute('aria-label', `${districtName} 클러스터`);
  div.textContent = '0';
  return div;
}

export default function KakaoDistrictMap({
  sites,
  districtRiskLevels,
  selectedDistrict,
  selectedSiteId,
  onSelectDistrict,
  onSelectSite,
  onMapClick,
  filterFn,
}: KakaoDistrictMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const polygonsRef = useRef<PolygonEntry[]>([]);
  const outlinesRef = useRef<OutlineEntry[]>([]);
  const markersRef = useRef<MarkerEntry[]>([]);
  const clusterOverlaysRef = useRef<ClusterEntry[]>([]);
  const hoveredDistrictRef = useRef<DistrictId | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  const [phase, setPhase] = useState<MapPhase>('loading');
  const [retryToken, setRetryToken] = useState(0);
  /** true = 광역 줌(level ≥ CLUSTER_ZOOM_THRESHOLD). 구 단위 클러스터 원을 표시한다. */
  const [clusterMode, setClusterMode] = useState(true);

  // 이벤트 핸들러가 최신 props 를 참조하되, 지도 객체를 다시 만들지 않도록 ref 로 보관한다.
  const handlersRef = useRef({ onSelectDistrict, onSelectSite, selectedDistrict, onMapClick });
  handlersRef.current = { onSelectDistrict, onSelectSite, selectedDistrict, onMapClick };

  // filterFn 은 useCallback 으로 안정화된 참조이므로 ref 에 최신값을 보관한다.
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;

  /** 선택 상태에 맞춰 폴리곤 스타일을 다시 적용한다. */
  const paintPolygons = useCallback(() => {
    const selected = handlersRef.current.selectedDistrict;
    const hovered = hoveredDistrictRef.current;

    polygonsRef.current.forEach(({ district, polygon }) => {
      const colors = SITE_STATUS_COLORS[districtRiskLevels[district]];
      const isSelected = selected === district;
      const isDimmed = selected !== null && !isSelected;
      const style = isSelected
        ? POLYGON_STYLE.selected
        : isDimmed
          ? POLYGON_STYLE.dimmed
          : hovered === district
            ? POLYGON_STYLE.hover
            : POLYGON_STYLE.base;

      polygon.setOptions({
        strokeColor: colors.stroke,
        fillColor: colors.fill,
        strokeWeight: style.strokeWeight,
        strokeOpacity: style.strokeOpacity,
        fillOpacity: style.fillOpacity,
      });
      polygon.setZIndex(style.zIndex);
    });

    // 구 경계선은 상태 색과 무관하게 굵기·투명도만 선택 상태에 맞춘다.
    outlinesRef.current.forEach(({ district, polyline }) => {
      const isSelected = selected === district;
      const style = isSelected
        ? DISTRICT_OUTLINE_STYLE.selected
        : selected !== null
          ? DISTRICT_OUTLINE_STYLE.dimmed
          : DISTRICT_OUTLINE_STYLE.base;
      polyline.setOptions({
        strokeColor: DISTRICT_OUTLINE_COLOR,
        strokeWeight: style.strokeWeight,
        strokeOpacity: style.strokeOpacity,
      });
      polyline.setZIndex(style.zIndex);
    });
  }, [districtRiskLevels]);

  /** 선택된 구(없으면 화성시 전체) 범위로 지도를 맞춘다. */
  const fitBounds = useCallback((district: DistrictId | null) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const [minLng, minLat, maxLng, maxLat] = getDistrictBBox(district);
    const bounds = new maps.LatLngBounds(new maps.LatLng(minLat, minLng), new maps.LatLng(maxLat, maxLng));
    map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING);
  }, []);

  /** 현재 필터·구 선택 기준으로 표시 중인 마커에 맞춰 지도 범위를 조정한다. */
  const handleFitToVisible = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    const fn = filterFnRef.current;
    const selectedDist = handlersRef.current.selectedDistrict;
    const visible = markersRef.current.filter(({ site }) => {
      const districtVisible = selectedDist === null || site.district === selectedDist;
      return districtVisible && (!fn || fn(site));
    });

    if (visible.length === 0) {
      fitBounds(selectedDist);
      return;
    }

    const first = new maps.LatLng(visible[0].site.latitude, visible[0].site.longitude);
    const bounds = new maps.LatLngBounds(first, first);
    visible.slice(1).forEach(({ site }) => bounds.extend(new maps.LatLng(site.latitude, site.longitude)));
    map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING);
  }, [fitBounds]);

  // 1) SDK 로드 + 지도 생성. 재시도할 때만 다시 실행한다.
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

        // 지도 배경 클릭(폴리곤·마커 제외)에만 반응한다.
        const onMapBackgroundClick = () => handlersRef.current.onMapClick?.();
        maps.event.addListener(map, 'click', onMapBackgroundClick);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'click', onMapBackgroundClick));

        // 줌 변경 → 클러스터 모드 전환
        const onZoomChanged = () => {
          const level = mapRef.current?.getLevel() ?? 9;
          setClusterMode(level >= CLUSTER_ZOOM_THRESHOLD);
        };
        maps.event.addListener(map, 'zoom_changed', onZoomChanged);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'zoom_changed', onZoomChanged));

        // 구 폴리곤
        districtBoundaries.forEach((district) => {
          district.areas.forEach((area) => {
            area.polygons.forEach((rings) => {
              const path = rings.map((ring) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng)));
              const polygon = new maps.Polygon({
                path: path.length === 1 ? path[0] : path,
                strokeStyle: 'solid',
              });
              polygon.setMap(map);

              const onClick = () => {
                maps.event.preventMap();
                handlersRef.current.onSelectDistrict(district.id);
                fitBounds(district.id);
              };
              const onOver = () => {
                hoveredDistrictRef.current = district.id;
                paintPolygons();
              };
              const onOut = () => {
                if (hoveredDistrictRef.current === district.id) hoveredDistrictRef.current = null;
                paintPolygons();
              };
              maps.event.addListener(polygon, 'click', onClick);
              maps.event.addListener(polygon, 'mouseover', onOver);
              maps.event.addListener(polygon, 'mouseout', onOut);
              cleanupRef.current.push(() => {
                maps.event.removeListener(polygon, 'click', onClick);
                maps.event.removeListener(polygon, 'mouseover', onOver);
                maps.event.removeListener(polygon, 'mouseout', onOut);
                polygon.setMap(null);
              });

              polygonsRef.current.push({ district: district.id, polygon });
            });
          });
        });

        // 구 경계선 오버레이. 클릭 리스너를 붙이지 않아 읍면동 폴리곤 클릭을 가리지 않는다.
        districtBoundaries.forEach((district) => {
          district.outline.forEach((ring) => {
            const polyline = new maps.Polyline({
              path: ring.map(([lng, lat]) => new maps.LatLng(lat, lng)),
              strokeStyle: 'solid',
            });
            polyline.setMap(map);
            cleanupRef.current.push(() => polyline.setMap(null));
            outlinesRef.current.push({ district: district.id, polyline });
          });
        });

        // 거점 마커
        sites.forEach((site) => {
          const element = createMarkerElement(site);
          const onClick = (event: MouseEvent) => {
            event.stopPropagation();
            handlersRef.current.onSelectSite(site.id);
          };
          element.addEventListener('click', onClick);

          const overlay = new maps.CustomOverlay({
            position: new maps.LatLng(site.latitude, site.longitude),
            content: element,
            yAnchor: 0.5,
            xAnchor: 0.5,
            zIndex: 5,
            clickable: true,
          });
          // 초기에는 지도에 붙이지 않는다. effect 2 에서 관리한다.

          cleanupRef.current.push(() => {
            element.removeEventListener('click', onClick);
            overlay.setMap(null);
          });
          markersRef.current.push({ site, overlay, element });
        });

        // 구 단위 클러스터 오버레이 (구당 1개)
        districtBoundaries.forEach((district) => {
          // bbox 중심은 서해 도서 때문에 만세구에서 바다로 나간다. 구 내부가 보장된 대표점을 쓴다.
          const [centerLng, centerLat] = district.center;

          const element = createClusterElement(district.name);
          const onClusterClick = (e: MouseEvent) => {
            e.stopPropagation();
            handlersRef.current.onSelectDistrict(district.id);
          };
          element.addEventListener('click', onClusterClick);

          const overlay = new maps.CustomOverlay({
            position: new maps.LatLng(centerLat, centerLng),
            content: element,
            yAnchor: 0.5,
            xAnchor: 0.5,
            zIndex: 7,
            clickable: true,
          });

          cleanupRef.current.push(() => {
            element.removeEventListener('click', onClusterClick);
            overlay.setMap(null);
          });
          clusterOverlaysRef.current.push({ districtId: district.id, overlay, element });
        });

        paintPolygons();
        fitBounds(handlersRef.current.selectedDistrict);
        setPhase('ready');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (error instanceof MissingKakaoKeyError) {
          setPhase('missing-key');
          return;
        }
        console.error('[KakaoDistrictMap] 지도를 초기화하지 못했습니다.', error);
        setPhase('error');
      });

    return () => {
      mounted = false;
      cleanupRef.current.forEach((dispose) => dispose());
      cleanupRef.current = [];
      polygonsRef.current = [];
      outlinesRef.current = [];
      markersRef.current = [];
      clusterOverlaysRef.current = [];
      hoveredDistrictRef.current = null;
      mapRef.current = null;
      mapsRef.current = null;
    };
    // sites 는 모듈 상수라 재생성되지 않는다. 재시도 시에만 지도를 다시 만든다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  // 2) 구 선택·필터·클러스터 모드 변경 → 마커/클러스터 가시성 및 폴리곤 스타일 갱신
  useEffect(() => {
    if (phase !== 'ready') return;
    paintPolygons();

    const fn = filterFnRef.current;
    const inClusterMode = clusterMode && selectedDistrict === null;

    // 개별 마커
    markersRef.current.forEach(({ site, overlay }) => {
      const districtVisible = selectedDistrict === null || site.district === selectedDistrict;
      const filterVisible = !fn || fn(site);
      overlay.setMap(!inClusterMode && districtVisible && filterVisible ? mapRef.current : null);
    });

    // 구 클러스터 오버레이
    clusterOverlaysRef.current.forEach(({ districtId, overlay, element }) => {
      if (!inClusterMode) {
        overlay.setMap(null);
        return;
      }
      const count = markersRef.current.filter(
        (m) => m.site.district === districtId && (!fn || fn(m.site)),
      ).length;
      element.textContent = String(count);
      overlay.setMap(count > 0 ? mapRef.current : null);
    });

  }, [phase, selectedDistrict, filterFn, clusterMode, paintPolygons]);

  // 3) 거점 선택 표시
  useEffect(() => {
    if (phase !== 'ready') return;
    markersRef.current.forEach(({ site, element, overlay }) => {
      const isSelected = site.id === selectedSiteId;
      element.dataset.selected = String(isSelected);
      overlay.setZIndex(isSelected ? 9 : 5);
    });
  }, [phase, selectedSiteId]);

  // 4) 사이드바 접기 등으로 컨테이너 크기가 바뀌면 relayout 후 범위를 다시 맞춘다.
  useEffect(() => {
    const container = containerRef.current;
    if (phase !== 'ready' || !container) return;

    let frame = 0;
    let timer = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => mapRef.current?.relayout());
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const center = mapRef.current?.getCenter();
        const level = mapRef.current?.getLevel();
        mapRef.current?.relayout();
        if (center !== undefined && level !== undefined) {
          mapRef.current?.setCenter(center);
          mapRef.current?.setLevel(level);
        }
      }, RELAYOUT_DEBOUNCE_MS);
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
    setRetryToken((token) => token + 1);
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
      <div
        ref={containerRef}
        role="region"
        aria-label="화성특례시 4개 구 거점 운영 지도"
        className="h-full w-full"
      />

      {phase === 'ready' && (
        <button
          type="button"
          onClick={handleFitToVisible}
          className="absolute bottom-3 left-3 z-10 inline-flex items-center rounded-md border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          전체 보기
        </button>
      )}

      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50" aria-live="polite">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-teal-500" />
          <p className="text-sm text-slate-500">지도를 불러오는 중입니다…</p>
        </div>
      )}

      {phase === 'missing-key' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50 px-6 text-center">
          <KeyRound size={28} className="text-slate-300" />
          <p className="text-sm font-medium text-slate-600">카카오맵 API 키 설정이 필요합니다</p>
          <p className="text-sm text-slate-400">
            프로젝트 루트 <code className="rounded bg-slate-100 px-1 text-xs text-slate-600">.env</code> 파일에
            아래 환경변수를 설정한 뒤 개발 서버를 다시 시작해 주세요.
          </p>
          <code className="mt-1 rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{KAKAO_KEY_ENV_NAME}</code>
          <p className="mt-1 text-xs text-slate-400">지도를 제외한 나머지 현황은 그대로 확인할 수 있습니다.</p>
        </div>
      )}

      {phase === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
          <AlertTriangle size={28} className="text-rose-300" />
          <p className="text-sm font-medium text-slate-600">지도를 불러오지 못했습니다</p>
          <p className="text-sm text-slate-400">
            네트워크 상태와 카카오 개발자 사이트의 플랫폼 도메인 등록 여부를 확인해 주세요.
            <br />
            자세한 원인은 브라우저 콘솔에 기록됩니다.
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <RotateCw size={14} />
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
