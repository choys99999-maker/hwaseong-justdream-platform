import { useCallback, useEffect, useRef, useState } from 'react';
import type { DistrictId, OperationSite, SiteStatus } from '../../types';
import type { KakaoCustomOverlay, KakaoMap, KakaoMapsNamespace, KakaoPolygon, KakaoPolyline } from '../../types/kakao';
import { MissingKakaoKeyError, hasKakaoAppKey, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_FOCUS_BBOX, districtBoundaries } from '../../data/districtBoundaries';
import { SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';
import StaticDistrictMap from './StaticDistrictMap';
import { computeCoincidentShifts, layoutLabels } from './labelLayout';
import type { MapFocusRequest } from './mapTypes';

export type { MapFocusRequest } from './mapTypes';

/**
 * 폴리곤 표현 기준. 구마다 다른 원색을 쓰지 않고 모두 Hwaseong Blue 한 톤 안에서
 * 옅음(기본) → 진함(hover/선택)으로만 구분한다 — "문제 있는 구"는 지도 위 KPI 라벨과
 * 개별 거점 마커 색으로 전달하고, 폴리곤은 화성시 자체를 브랜드 오브젝트로 보여주는 역할만 한다.
 */
const HWASEONG_BLUE = '#004696';
const POLYGON_STYLE = {
  base: { strokeWeight: 1, strokeOpacity: 0.5, fillOpacity: 0.06, zIndex: 1 },
  hover: { strokeWeight: 1, strokeOpacity: 0.7, fillOpacity: 0.11, zIndex: 3 },
  selected: { strokeWeight: 1, strokeOpacity: 0.9, fillOpacity: 0.17, zIndex: 4 },
  dimmed: { strokeWeight: 1, strokeOpacity: 0.3, fillOpacity: 0.03, zIndex: 1 },
} as const;

/**
 * 구 경계선. 읍면동 경계보다 굵게, 화성시 외곽이 지도에서 즉시 인지되도록 짙은 남색으로 얹는다.
 */
const DISTRICT_OUTLINE_COLOR = '#183B63';
const DISTRICT_OUTLINE_STYLE = {
  base: { strokeWeight: 2.2, strokeOpacity: 0.8, zIndex: 6 },
  selected: { strokeWeight: 2.8, strokeOpacity: 0.95, zIndex: 8 },
  dimmed: { strokeWeight: 1.5, strokeOpacity: 0.3, zIndex: 6 },
} as const;

/** 화성시 바깥 지역을 눌러 화성시 자체가 지도의 주인공이 되게 하는 마스크 색. */
const OUTSIDE_MASK_COLOR = '#0B2547';
const OUTSIDE_MASK_OPACITY = 0.32;
/** 마스크 사각형이 화면 팬닝에도 항상 화면을 덮도록 화성시 범위 밖으로 넉넉히 잡는 여백(도). */
const MASK_PADDING_DEG = 1.5;

const BOUNDS_PADDING = 24;
/**
 * 구 경계 fitting 전용 여백. 카카오맵 레벨이 정수라 화면 점유율이 2배 단위로 끊기는데,
 * 24px 로는 효행구·동탄구가 한 단계 더 축소된 레벨로 밀려 경계가 화면의 절반도 못 채웠다.
 * 12px 이면 네 구 모두 가장 조밀한 레벨을 고르면서 최소 14px 여백이 남는다.
 */
const DISTRICT_BOUNDS_PADDING = 12;
const RELAYOUT_DEBOUNCE_MS = 160;
/** 지도 최초 생성 레벨. 화성시 전체가 뷰포트에 들어온다. */
const INITIAL_LEVEL = 9;
/** 검색 결과 선택 시 이동할 확대 레벨. 클러스터 임계값보다 한참 낮아 개별 마커가 바로 보인다. */
const FOCUS_SITE_LEVEL = 4;
/**
 * 카카오맵 레벨(level) 이 이 값 이상이면 구 단위 요약 오버레이만 표시하고 개별 마커는 숨긴다.
 * 두 표현의 역할을 분리한다.
 *   - level ≥ 10 (화성시보다 더 넓은 광역 뷰): 구 단위 요약 = "이 구에 몇 곳"
 *   - level ≤ 9  (화성시 전체 ~ 확대):        개별 거점 마커 + 기관명 = "어디에 무엇"
 * 실제 거점 위치가 읽히는 배율에서는 항상 개별 사업장이 우선한다.
 */
const CLUSTER_ZOOM_THRESHOLD = 10;

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
  /** 설정되면 해당 거점 좌표로 지도 center/zoom 을 이동한다. (검색 결과 선택 등) */
  focusRequest?: MapFocusRequest | null;
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
  label: HTMLSpanElement;
  /** 현재 지도에 붙어 있는지. 라벨 배치 계산 대상 판단에 쓴다. */
  visible: boolean;
}

interface ClusterEntry {
  districtId: DistrictId;
  overlay: KakaoCustomOverlay;
  countElement: HTMLSpanElement;
  alertElement: HTMLParagraphElement;
  element: HTMLDivElement;
}

/** 마커가 화면에 나타날 때 살짝 pop 되는 간격(ms). 30~40ms 씩 어긋나 화면이 조립되는 느낌을 준다. */
const MARKER_POP_STAGGER_MS = 35;

/**
 * 거점 마커 = 상태 원형 + 기관명 라벨. 버튼 하나가 통째로 클릭 타깃이 된다.
 * 라벨은 absolute 라 버튼 크기(12px)를 바꾸지 않으므로 오버레이 앵커가 항상 원 중심이다.
 */
function createMarkerElement(
  site: OperationSite,
  shift: number,
  popIndex: number,
): { element: HTMLButtonElement; label: HTMLSpanElement } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gj-marker hci-pop';
  button.style.animationDelay = `${popIndex * MARKER_POP_STAGGER_MS}ms`;
  button.style.setProperty('--gj-status', SITE_STATUS_COLORS[site.status].fill);
  button.dataset.status = site.status;
  button.setAttribute('aria-label', `${site.name} · ${SITE_STATUS_LABELS[site.status]}`);
  button.dataset.selected = 'false';
  button.dataset.place = 'right';

  if (shift !== 0) {
    // 원의 반지름(6px)만큼은 원에 가리므로 stem 은 그만큼 짧게 그린다.
    const stemWidth = Math.abs(shift) - 6;
    button.dataset.coincident = 'true';
    button.style.setProperty('--gj-shift', `${shift}px`);
    button.style.setProperty('--gj-stem-left', `${shift > 0 ? -shift : 6}px`);
    button.style.setProperty('--gj-stem-width', `${stemWidth}px`);
  }

  const label = document.createElement('span');
  label.className = 'gj-marker-label';
  // 지도에는 축약형만 노출한다. 정식 기관명은 aria-label·상세 패널에서 확인한다.
  label.textContent = site.displayName;
  label.title = site.name;
  button.appendChild(label);

  return { element: button, label };
}

/**
 * 구 단위 요약 오버레이 — 광역 줌에서 지도를 가리지 않는 작은 floating KPI 라벨.
 * 구 이름 + 거점 수 + (있으면) 확인 필요 수만 담는다. 원형 배지가 아니라 화이트 카드라
 * 지도 자체(브랜드 블루 폴리곤)와 톤이 부딪히지 않는다.
 */
function createRegionKpiElement(districtName: string): {
  element: HTMLDivElement;
  countElement: HTMLSpanElement;
  alertElement: HTMLParagraphElement;
} {
  const div = document.createElement('div');
  div.className = 'gj-region-kpi';
  div.setAttribute('aria-label', `${districtName} 거점 요약`);

  const name = document.createElement('p');
  name.className = 'gj-region-kpi-name';
  name.textContent = districtName;

  const count = document.createElement('span');
  count.textContent = '0개 거점';

  const countLine = document.createElement('p');
  countLine.className = 'gj-region-kpi-count';
  countLine.appendChild(count);

  const alertLine = document.createElement('p');
  alertLine.className = 'gj-region-kpi-alert';
  alertLine.hidden = true;

  div.append(name, countLine, alertLine);
  return { element: div, countElement: count, alertElement: alertLine };
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
  focusRequest,
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
  const layoutFrameRef = useRef(0);

  // 키가 아예 없으면 카카오를 부르지 않는다 — 뜨지도 않을 스피너를 8초 보여줄 이유가 없다.
  const [phase, setPhase] = useState<MapPhase>(() => (hasKakaoAppKey() ? 'loading' : 'missing-key'));
  const [retryToken, setRetryToken] = useState(0);
  /** 대체 지도 안내에 쓸 실패 사유. */
  const [failureReason, setFailureReason] = useState<string | null>(null);
  /** true = 광역 줌(level ≥ CLUSTER_ZOOM_THRESHOLD). 구 단위 요약 원을 표시한다. */
  const [clusterMode, setClusterMode] = useState(INITIAL_LEVEL >= CLUSTER_ZOOM_THRESHOLD);

  /** 라벨 겹침 재계산. 지도 이동·줌·가시성 변경 뒤 한 프레임 뒤에 한 번만 돈다. */
  const scheduleLabelLayout = useCallback(() => {
    cancelAnimationFrame(layoutFrameRef.current);
    layoutFrameRef.current = requestAnimationFrame(() => layoutLabels(markersRef.current));
  }, []);

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
        strokeColor: '#ffffff',
        fillColor: HWASEONG_BLUE,
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
  }, []);

  /** 선택된 구(없으면 화성시 전체) 실제 outline 좌표로 bounds를 계산해 지도를 맞춘다. */
  const fitMapToDistrict = useCallback((district: DistrictId | null) => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;

    const targets = district === null
      ? districtBoundaries
      : districtBoundaries.filter((d) => d.id === district);
    if (targets.length === 0) return;

    // focusBBox 범위 안쪽 좌표만 포함해 서해 도서를 자동으로 제외한다.
    const points: Array<[number, number]> = [];
    targets.forEach((d) => {
      const [focusMinLng, focusMinLat, focusMaxLng, focusMaxLat] = d.focusBBox;
      d.outline.forEach((ring) => {
        ring.forEach(([lng, lat]) => {
          if (lng >= focusMinLng && lng <= focusMaxLng && lat >= focusMinLat && lat <= focusMaxLat) {
            points.push([lat, lng]);
          }
        });
      });
    });
    if (points.length === 0) return;

    const first = new maps.LatLng(points[0][0], points[0][1]);
    const bounds = new maps.LatLngBounds(first, first);
    for (let i = 1; i < points.length; i++) {
      bounds.extend(new maps.LatLng(points[i][0], points[i][1]));
    }
    map.relayout();
    map.setBounds(
      bounds,
      DISTRICT_BOUNDS_PADDING,
      DISTRICT_BOUNDS_PADDING,
      DISTRICT_BOUNDS_PADDING,
      DISTRICT_BOUNDS_PADDING,
    );
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
      fitMapToDistrict(selectedDist);
      return;
    }

    const first = new maps.LatLng(visible[0].site.latitude, visible[0].site.longitude);
    const bounds = new maps.LatLngBounds(first, first);
    visible.slice(1).forEach(({ site }) => bounds.extend(new maps.LatLng(site.latitude, site.longitude)));
    map.setBounds(bounds, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING, BOUNDS_PADDING);
  }, [fitMapToDistrict]);

  // 1) SDK 로드 + 지도 생성. 재시도할 때만 다시 실행한다.
  useEffect(() => {
    if (!hasKakaoAppKey()) {
      setPhase('missing-key');
      return;
    }

    let mounted = true;
    setPhase('loading');

    loadKakaoMaps()
      .then((maps) => {
        if (!mounted) return;
        if (!containerRef.current) {
          // 컨테이너가 사라졌는데 그대로 두면 'loading' 에 갇힌다.
          setFailureReason('지도를 그릴 영역을 찾지 못했습니다.');
          setPhase('error');
          return;
        }
        mapsRef.current = maps;

        const [minLng, minLat, maxLng, maxLat] = HWASEONG_FOCUS_BBOX;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2),
          level: INITIAL_LEVEL,
        });
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        mapRef.current = map;

        // 지도 배경 클릭(폴리곤·마커 제외)에만 반응한다.
        const onMapBackgroundClick = () => handlersRef.current.onMapClick?.();
        maps.event.addListener(map, 'click', onMapBackgroundClick);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'click', onMapBackgroundClick));

        // 줌 변경 → 구 요약 / 개별 거점 전환
        const onZoomChanged = () => {
          const level = mapRef.current?.getLevel() ?? INITIAL_LEVEL;
          setClusterMode(level >= CLUSTER_ZOOM_THRESHOLD);
        };
        maps.event.addListener(map, 'zoom_changed', onZoomChanged);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'zoom_changed', onZoomChanged));

        // 이동·줌이 끝나 오버레이 위치가 확정되면 라벨 배치를 다시 계산한다.
        const onIdle = () => scheduleLabelLayout();
        maps.event.addListener(map, 'idle', onIdle);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'idle', onIdle));

        // 화성시 바깥을 눌러 화성시 경계 자체가 지도의 주인공이 되게 하는 마스크.
        // 화성시보다 훨씬 큰 사각형에서 각 구 외곽선을 구멍으로 뚫어(evenodd) 시 안쪽만 남긴다.
        const maskOuterRing = [
          new maps.LatLng(minLat - MASK_PADDING_DEG, minLng - MASK_PADDING_DEG),
          new maps.LatLng(minLat - MASK_PADDING_DEG, maxLng + MASK_PADDING_DEG),
          new maps.LatLng(maxLat + MASK_PADDING_DEG, maxLng + MASK_PADDING_DEG),
          new maps.LatLng(maxLat + MASK_PADDING_DEG, minLng - MASK_PADDING_DEG),
        ];
        const maskHoles = districtBoundaries.flatMap((district) =>
          district.outline.map((ring) => ring.map(([lng, lat]) => new maps.LatLng(lat, lng))),
        );
        const maskPolygon = new maps.Polygon({
          path: [maskOuterRing, ...maskHoles],
          strokeWeight: 0,
          fillColor: OUTSIDE_MASK_COLOR,
          fillOpacity: OUTSIDE_MASK_OPACITY,
          zIndex: 0,
        });
        maskPolygon.setMap(map);
        cleanupRef.current.push(() => maskPolygon.setMap(null));

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
        // 좌표가 겹치는 거점은 표시 위치만 좌우로 벌린다. (실제 좌표는 그대로)
        const coincidentShifts = computeCoincidentShifts(sites);

        sites.forEach((site, index) => {
          const { element, label } = createMarkerElement(site, coincidentShifts.get(site.id) ?? 0, index);
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
          markersRef.current.push({ site, overlay, element, label, visible: false });
        });

        // 구 단위 클러스터 오버레이 (구당 1개)
        districtBoundaries.forEach((district) => {
          // bbox 중심은 서해 도서 때문에 만세구에서 바다로 나간다. 구 내부가 보장된 대표점을 쓴다.
          const [centerLng, centerLat] = district.center;

          const { element, countElement, alertElement } = createRegionKpiElement(district.name);
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
          clusterOverlaysRef.current.push({ districtId: district.id, overlay, countElement, alertElement, element });
        });

        paintPolygons();
        fitMapToDistrict(handlersRef.current.selectedDistrict);
        // setBounds 로 레벨이 바뀌어도 zoom_changed 가 오지 않는 경우가 있어 한 번 맞춰 둔다.
        setClusterMode(map.getLevel() >= CLUSTER_ZOOM_THRESHOLD);
        setPhase('ready');
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        if (error instanceof MissingKakaoKeyError) {
          setPhase('missing-key');
          return;
        }
        console.error('[KakaoDistrictMap] 지도를 초기화하지 못했습니다.', error);
        setFailureReason(error instanceof Error ? error.message : '지도를 불러오지 못했습니다.');
        setPhase('error');
      });

    return () => {
      mounted = false;
      cancelAnimationFrame(layoutFrameRef.current);
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
    markersRef.current.forEach((entry) => {
      const districtVisible = selectedDistrict === null || entry.site.district === selectedDistrict;
      const filterVisible = !fn || fn(entry.site);
      entry.visible = !inClusterMode && districtVisible && filterVisible;
      entry.overlay.setMap(entry.visible ? mapRef.current : null);
    });

    // 구 단위 요약 오버레이
    clusterOverlaysRef.current.forEach(({ districtId, overlay, countElement, alertElement }) => {
      if (!inClusterMode) {
        overlay.setMap(null);
        return;
      }
      const districtSites = markersRef.current
        .filter((m) => m.site.district === districtId && (!fn || fn(m.site)))
        .map((m) => m.site);
      const needsAttention = districtSites.filter((site) => site.status !== 'normal').length;
      countElement.textContent = `${districtSites.length}개 거점`;
      if (needsAttention > 0) {
        alertElement.textContent = `${needsAttention}곳 확인 필요`;
        alertElement.hidden = false;
      } else {
        alertElement.hidden = true;
      }
      overlay.setMap(districtSites.length > 0 ? mapRef.current : null);
    });

    scheduleLabelLayout();
  }, [phase, selectedDistrict, filterFn, clusterMode, paintPolygons, scheduleLabelLayout]);

  // 3) 거점 선택 표시. 선택된 마커는 강조하고, 나머지는 opacity 를 소폭 낮춰 대비를 준다.
  useEffect(() => {
    if (phase !== 'ready') return;
    markersRef.current.forEach(({ site, element, overlay }) => {
      const isSelected = site.id === selectedSiteId;
      element.dataset.selected = String(isSelected);
      element.style.opacity = selectedSiteId && !isSelected ? '0.55' : '1';
      overlay.setZIndex(isSelected ? 9 : 5);
    });
    // 선택 시 라벨 굵기가 바뀌어 폭이 달라지므로 배치를 다시 잡는다.
    scheduleLabelLayout();
  }, [phase, selectedSiteId, scheduleLabelLayout]);

  // 4) 구 선택 변경 시 해당 경계로 지도를 fitting 한다. 필터 버튼·폴리곤 클릭 모두 처리한다.
  useEffect(() => {
    if (phase !== 'ready') return;
    fitMapToDistrict(selectedDistrict);
  }, [phase, selectedDistrict, fitMapToDistrict]);

  // 4b) 검색 결과 선택 등 외부 focusRequest → 해당 거점 좌표로 이동. district-fit 이후에 실행되어 우선한다.
  useEffect(() => {
    if (phase !== 'ready' || !focusRequest) return;
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const entry = markersRef.current.find((m) => m.site.id === focusRequest.siteId);
    if (!entry) return;
    map.setCenter(new maps.LatLng(entry.site.latitude, entry.site.longitude));
    if (!focusRequest.panOnly) {
      map.setLevel(FOCUS_SITE_LEVEL);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, focusRequest?.siteId, focusRequest?.token]);

  // 5) 사이드바 접기 등으로 컨테이너 크기가 바뀌면 relayout 후 범위를 다시 맞춘다.
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
        fitMapToDistrict(handlersRef.current.selectedDistrict);
        scheduleLabelLayout();
      }, RELAYOUT_DEBOUNCE_MS);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [phase, scheduleLabelLayout, fitMapToDistrict]);

  const handleRetry = () => {
    resetKakaoMapsLoader();
    setFailureReason(null);
    setRetryToken((token) => token + 1);
  };

  /*
   * 카카오맵을 못 쓰는 상황에서도 지도는 나와야 한다.
   *
   * 키가 없거나(로컬 클론·시연 PC) 실행 도메인이 카카오에 등록되지 않은 배포본에서는
   * 예전 화면이 안내문만 띄우고 끝나 "거점이 어디 있는지" 자체를 볼 수 없었다.
   * 저장소에 이미 들어 있는 경계 GeoJSON 으로 같은 지도를 그려 기능을 잃지 않게 한다.
   */
  if (phase === 'missing-key' || phase === 'error') {
    return (
      <StaticDistrictMap
        sites={sites}
        districtRiskLevels={districtRiskLevels}
        selectedDistrict={selectedDistrict}
        selectedSiteId={selectedSiteId}
        onSelectDistrict={onSelectDistrict}
        onSelectSite={onSelectSite}
        onMapClick={onMapClick}
        filterFn={filterFn}
        focusRequest={focusRequest}
        notice={
          phase === 'missing-key'
            ? '카카오맵 키가 없어 기본 경계 지도로 표시 중입니다'
            : `카카오맵을 불러오지 못해 기본 경계 지도로 표시 중입니다 — ${failureReason ?? '원인은 콘솔 참고'}`
        }
        onRetryKakao={phase === 'error' ? handleRetry : undefined}
      />
    );
  }

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

    </div>
  );
}
