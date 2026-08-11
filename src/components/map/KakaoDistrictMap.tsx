import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, KeyRound, RotateCw } from 'lucide-react';
import type { DistrictId, OperationSite, SiteStatus } from '../../types';
import type { KakaoCustomOverlay, KakaoMap, KakaoMapsNamespace, KakaoPolygon, KakaoPolyline } from '../../types/kakao';
import { KAKAO_KEY_ENV_NAME, MissingKakaoKeyError, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_FOCUS_BBOX, districtBoundaries } from '../../data/districtBoundaries';
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

/**
 * 라벨 배치 후보. 오른쪽을 기본으로 하고, 이미 놓인 라벨·마커와 겹치면 순서대로 옮긴다.
 * 후보를 다 써도 자리가 없으면 이름을 숨기지 않고 겹침 면적이 가장 작은 자리를 쓴다.
 */
const LABEL_PLACES = [
  'right',
  'left',
  'bottom',
  'top',
  'bottom-right',
  'top-right',
  'bottom-left',
  'top-left',
] as const;
type LabelPlace = (typeof LABEL_PLACES)[number];

/** 다른 거점의 원형 마커를 덮는 것이 라벨끼리 겹치는 것보다 나쁘므로 가중치를 준다. */
const DOT_OVERLAP_WEIGHT = 3;

/** 원형 마커 중심에서 라벨 변까지의 거리(px). CSS 의 calc(100% + 5px) 와 맞춘다. */
const LABEL_OFFSET = 11;
/** 대각선 배치의 중심-변 거리(px). CSS 의 calc(100% + 3px) 와 맞춘다. */
const DIAGONAL_OFFSET = 9;
/** 원형 마커가 차지하는 반경(px). 라벨이 다른 거점의 점을 덮지 않도록 장애물로 넣는다. */
const DOT_RADIUS = 8;
/** 겹침 판정 여유(px) */
const COLLISION_SLACK = 2;

interface LabelBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** true 면 다른 거점의 원형 마커 자리 */
  isDot?: boolean;
}

interface MeasuredMarker {
  entry: MarkerEntry;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function labelBox(place: LabelPlace, m: MeasuredMarker): LabelBox {
  switch (place) {
    case 'right':
      return { left: m.cx + LABEL_OFFSET, top: m.cy - m.h / 2, right: m.cx + LABEL_OFFSET + m.w, bottom: m.cy + m.h / 2 };
    case 'left':
      return { left: m.cx - LABEL_OFFSET - m.w, top: m.cy - m.h / 2, right: m.cx - LABEL_OFFSET, bottom: m.cy + m.h / 2 };
    case 'bottom':
      return { left: m.cx - m.w / 2, top: m.cy + LABEL_OFFSET, right: m.cx + m.w / 2, bottom: m.cy + LABEL_OFFSET + m.h };
    case 'top':
      return { left: m.cx - m.w / 2, top: m.cy - LABEL_OFFSET - m.h, right: m.cx + m.w / 2, bottom: m.cy - LABEL_OFFSET };
    case 'bottom-right':
      return { left: m.cx + DIAGONAL_OFFSET, top: m.cy + DIAGONAL_OFFSET, right: m.cx + DIAGONAL_OFFSET + m.w, bottom: m.cy + DIAGONAL_OFFSET + m.h };
    case 'top-right':
      return { left: m.cx + DIAGONAL_OFFSET, top: m.cy - DIAGONAL_OFFSET - m.h, right: m.cx + DIAGONAL_OFFSET + m.w, bottom: m.cy - DIAGONAL_OFFSET };
    case 'bottom-left':
      return { left: m.cx - DIAGONAL_OFFSET - m.w, top: m.cy + DIAGONAL_OFFSET, right: m.cx - DIAGONAL_OFFSET, bottom: m.cy + DIAGONAL_OFFSET + m.h };
    case 'top-left':
      return { left: m.cx - DIAGONAL_OFFSET - m.w, top: m.cy - DIAGONAL_OFFSET - m.h, right: m.cx - DIAGONAL_OFFSET, bottom: m.cy - DIAGONAL_OFFSET };
  }
}

/** 두 사각형이 겹치는 넓이(px²). 여유(COLLISION_SLACK) 안쪽 스침은 0 으로 본다. */
function overlapArea(a: LabelBox, b: LabelBox): number {
  const x = Math.min(a.right, b.right) - Math.max(a.left, b.left) - COLLISION_SLACK;
  const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) - COLLISION_SLACK;
  if (x <= 0 || y <= 0) return 0;
  return x * y * (b.isDot ? DOT_OVERLAP_WEIGHT : 1);
}

/**
 * 화면에 보이는 거점 라벨의 겹침을 배치 방향만 바꿔 줄인다.
 * 이름은 절대 숨기지 않는다. 8방향 어디에도 빈자리가 없으면 겹침 면적이 가장 작은 쪽을 쓴다.
 * (거점이 지나치게 몰린 구간은 확대하면 풀린다 — 확대 시 개별 거점이 우선이다)
 */
function layoutLabels(entries: MarkerEntry[]): void {
  const measured: MeasuredMarker[] = [];
  entries.forEach((entry) => {
    if (!entry.visible) return;
    const dot = entry.element.getBoundingClientRect();
    const label = entry.label.getBoundingClientRect();
    if (label.width === 0 || label.height === 0) return;
    measured.push({
      entry,
      cx: dot.left + dot.width / 2,
      cy: dot.top + dot.height / 2,
      w: label.width,
      h: label.height,
    });
  });
  if (measured.length === 0) return;

  // 위 → 아래, 왼쪽 → 오른쪽 순으로 자리를 잡아 배치 결과가 재계산마다 흔들리지 않게 한다.
  measured.sort((a, b) => a.cy - b.cy || a.cx - b.cx);

  // 모든 거점의 원형 마커 자리를 먼저 장애물로 깔아 둔다.
  const occupied: LabelBox[] = measured.map((m) => ({
    left: m.cx - DOT_RADIUS,
    top: m.cy - DOT_RADIUS,
    right: m.cx + DOT_RADIUS,
    bottom: m.cy + DOT_RADIUS,
    isDot: true,
  }));

  measured.forEach((m) => {
    let best: LabelPlace = LABEL_PLACES[0];
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of LABEL_PLACES) {
      const box = labelBox(candidate, m);
      const cost = occupied.reduce((sum, other) => sum + overlapArea(box, other), 0);
      if (cost < bestCost) {
        best = candidate;
        bestCost = cost;
      }
      if (bestCost === 0) break; // 앞선 후보에서 자리를 찾으면 더 볼 필요가 없다
    }
    occupied.push(labelBox(best, m));
    m.entry.element.dataset.place = best;
  });
}

type MapPhase = 'loading' | 'ready' | 'missing-key' | 'error';

/** 검색 결과 선택 등 외부에서 특정 거점으로 지도를 이동시키고 싶을 때 쓴다. token 을 매번 올려 같은 거점을 다시 선택해도 이동이 재실행되게 한다. */
export interface MapFocusRequest {
  siteId: string;
  token: number;
}

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
  element: HTMLDivElement;
}

/**
 * 좌표가 완전히 같은 거점들의 **표시 위치**만 좌우로 벌리는 오프셋(px)을 계산한다.
 *
 * 같은 건물에 두 기관이 들어 있는 경우(예: 동탄대로8길 36 — 동탄노인복지관 / 동탄7동 협의체)
 * 카카오가 두 기관에 같은 좌표를 주기 때문에 원형 마커가 정확히 포개진다.
 * 실제 lat/lng 는 손대지 않고, 화면에서만 좌우로 밀어 각각 클릭할 수 있게 한다.
 * 밀어낸 원과 실제 지점 사이는 짧은 stem 으로 이어 붙여 위치 관계가 어색해 보이지 않게 한다.
 *
 * id 정렬 기준으로 자리를 배분하므로 렌더링할 때마다 같은 결과가 나온다.
 */
const COINCIDENT_STEP = 14;

function computeCoincidentShifts(sites: OperationSite[]): Map<string, number> {
  const groups = new Map<string, OperationSite[]>();
  sites.forEach((site) => {
    const key = `${site.latitude.toFixed(6)},${site.longitude.toFixed(6)}`;
    groups.set(key, [...(groups.get(key) ?? []), site]);
  });

  const shifts = new Map<string, number>();
  groups.forEach((group) => {
    if (group.length < 2) return;
    [...group]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((site, index) => {
        // 그룹 중앙을 기준으로 좌우 대칭 배치한다. 2개면 -14px / +14px.
        shifts.set(site.id, (index - (group.length - 1) / 2) * (COINCIDENT_STEP * 2));
      });
  });
  return shifts;
}

/**
 * 거점 마커 = 상태 원형 + 기관명 라벨. 버튼 하나가 통째로 클릭 타깃이 된다.
 * 라벨은 absolute 라 버튼 크기(12px)를 바꾸지 않으므로 오버레이 앵커가 항상 원 중심이다.
 */
function createMarkerElement(site: OperationSite, shift: number): { element: HTMLButtonElement; label: HTMLSpanElement } {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'gj-marker';
  button.style.setProperty('--gj-status', SITE_STATUS_COLORS[site.status].fill);
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

/** 구 단위 요약 오버레이. 개별 거점 마커와 헷갈리지 않도록 구 이름을 함께 적는다. */
function createClusterElement(districtName: string): { element: HTMLDivElement; countElement: HTMLSpanElement } {
  const div = document.createElement('div');
  div.className = 'gj-cluster';
  div.setAttribute('aria-label', `${districtName} 거점 요약`);

  const count = document.createElement('span');
  count.className = 'gj-cluster-count';
  count.textContent = '0';

  const name = document.createElement('span');
  name.className = 'gj-cluster-name';
  name.textContent = districtName;

  div.append(count, name);
  return { element: div, countElement: count };
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

  const [phase, setPhase] = useState<MapPhase>('loading');
  const [retryToken, setRetryToken] = useState(0);
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
    let mounted = true;
    setPhase('loading');

    loadKakaoMaps()
      .then((maps) => {
        if (!mounted || !containerRef.current) return;
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

        sites.forEach((site) => {
          const { element, label } = createMarkerElement(site, coincidentShifts.get(site.id) ?? 0);
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

          const { element, countElement } = createClusterElement(district.name);
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
          clusterOverlaysRef.current.push({ districtId: district.id, overlay, countElement, element });
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
    clusterOverlaysRef.current.forEach(({ districtId, overlay, countElement }) => {
      if (!inClusterMode) {
        overlay.setMap(null);
        return;
      }
      const count = markersRef.current.filter(
        (m) => m.site.district === districtId && (!fn || fn(m.site)),
      ).length;
      countElement.textContent = String(count);
      overlay.setMap(count > 0 ? mapRef.current : null);
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
    map.setLevel(FOCUS_SITE_LEVEL);
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
