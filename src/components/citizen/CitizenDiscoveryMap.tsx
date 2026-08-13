import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { hasKakaoAppKey, loadKakaoMaps } from '../../lib/kakaoMap';
import type { KakaoCustomOverlay, KakaoLatLngBounds, KakaoMap, KakaoMapsNamespace, KakaoPolygon } from '../../types/kakao';
import { distanceKm, type LatLng } from '../../lib/geo';
import { districtBoundaries } from '../../data/districtBoundaries';
import { AVAILABILITY_LABEL, type RankedCitizenSite } from '../../utils/citizenSite';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

type Phase = 'loading' | 'ready' | 'unavailable';

const AVAILABILITY_COLOR: Record<RankedCitizenSite['availability'], string> = {
  available: '#059669',
  low: '#d97706',
  unknown: '#64748b',
};

/** 지도 연출 총 길이. 과한 연출 대신 "이동 → 줌인" 두 동작만 이어 붙인다. */
const PAN_MS = 300;
const ZOOM_MS = 520;

/**
 * 프레이밍 여백(px). 위쪽은 지도 위 보조 버튼 줄을, 아래쪽은 시트 높이를 따로 더한다.
 * 좌표는 핀의 중심이고 1순위 원은 반지름 19px 이므로 여백은 그보다 넉넉해야 잘리지 않는다.
 */
const PAD_TOP = 88;
const PAD_X = 40;
const PAD_BOTTOM = 40;
/** "한 단계 더 당겨도 되는가" 판정은 여백을 조금 더 크게 잡아 아슬아슬한 통과를 막는다. */
const TIGHTEN_MARGIN = 1.3;

/** 이 거리 안이면 추천 배율에서 핀이 서로 겹쳐 보인다(같은 건물·같은 복합청사). */
const COINCIDENT_KM = 0.05;

/**
 * 서로 겹쳐 보이는 거점끼리 묶는다. 반환값은 거점 id → 같은 자리에 있는 id 목록(입력 순서).
 * 좌표 자체는 건드리지 않는다 — 화면에서 좌우로 벌릴 때 몇 번째인지만 알면 된다.
 */
function clusterByProximity(sites: RankedCitizenSite[]): Map<string, string[]> {
  const groups: RankedCitizenSite[][] = [];
  for (const site of sites) {
    const group = groups.find((g) => distanceKm(g[0], site) <= COINCIDENT_KM);
    if (group) group.push(site);
    else groups.push([site]);
  }
  const byId = new Map<string, string[]>();
  for (const group of groups) {
    const ids = group.map((s) => s.id);
    for (const id of ids) byId.set(id, ids);
  }
  return byId;
}

interface CitizenDiscoveryMapProps {
  /** 거점 25곳 전체. 첫 화면에서는 전부 같은 무게로 조용히 깔린다. */
  sites: RankedCitizenSite[];
  /** 추천 ①②③ 의 id (순서 그대로). 비어 있으면 첫 화면(전체 보기) 상태다. */
  highlightIds: string[];
  userLocation: LatLng | null;
  selectedId: string | null;
  onSelect: (site: RankedCitizenSite) => void;
  /** 하단 시트가 가리는 높이(px). 지도 프레이밍에서 그만큼 아래 여백으로 잡는다. */
  bottomInset: number;
  /** 값이 바뀔 때마다 "내 위치 + 추천 3곳"으로 부드럽게 이동한다. */
  focusToken: number;
  /** 값이 바뀔 때마다 selectedId 거점을 시트 위 영역 한가운데로 올린다. */
  spotlightToken: number;
}

/**
 * 시민 첫 화면의 무대가 되는 지도.
 *
 * 이 지도는 "탐색 UI" 가 아니다 — 시민이 25개를 비교하러 들어오는 곳이 아니라,
 * "당신 위치는 여기이고 추천 장소는 여기입니다" 를 눈으로 증명하는 화면이다.
 * 그래서 줌 컨트롤·검색·필터·행정구역 폴리곤·기관명 라벨 25개를 전부 두지 않는다.
 * (그런 기능이 필요한 관리자 지도는 KakaoDistrictMap 이 따로 있다)
 */
export default function CitizenDiscoveryMap({
  sites,
  highlightIds,
  userLocation,
  selectedId,
  onSelect,
  bottomInset,
  focusToken,
  spotlightToken,
}: CitizenDiscoveryMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const pinsRef = useRef(new Map<string, { overlay: KakaoCustomOverlay; button: HTMLButtonElement; dot: HTMLSpanElement }>());
  const userOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const cityShapeRef = useRef<KakaoPolygon[]>([]);
  const timersRef = useRef<number[]>([]);
  /** 마지막으로 프레이밍한 점들. 시트 높이가 바뀌면 이 점들 기준으로 다시 맞춘다. */
  const framedRef = useRef<LatLng[] | null>(null);
  const animatingRef = useRef(false);
  const [phase, setPhase] = useState<Phase>('loading');

  const reduceMotion = usePrefersReducedMotion();

  // 콜백/최신 값은 ref 로 들고 간다 — 지도 오버레이는 React 트리 밖 DOM 이라
  // 매 렌더마다 다시 만들면 첫 화면에서 마커가 깜빡인다.
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const bottomInsetRef = useRef(bottomInset);
  bottomInsetRef.current = bottomInset;
  const reduceMotionRef = useRef(reduceMotion);
  reduceMotionRef.current = reduceMotion;

  function clearTimers() {
    for (const id of timersRef.current) window.clearTimeout(id);
    timersRef.current = [];
  }

  function later(fn: () => void, ms: number) {
    timersRef.current.push(window.setTimeout(fn, ms));
  }

  /**
   * 화성시 모양을 아주 옅은 색 면으로 한 번 깔아 둔다.
   * 첫 화면에서 주변 도시(수원·오산·평택)까지 함께 보일 수밖에 없는데(레벨이 2배 단위라
   * 화성시에 딱 맞출 수 없다), 이 면이 있으면 "여기가 화성이고 그 안에 거점이 흩어져 있다"가
   * 설명 없이 읽힌다. 경계선(구 구분선)은 그리지 않는다 — 시민이 행정구역을 해석할 일은 없다.
   */
  function drawCityShape(maps: KakaoMapsNamespace, map: KakaoMap) {
    const polygons: KakaoPolygon[] = [];
    for (const district of districtBoundaries) {
      for (const ring of district.outline) {
        const polygon = new maps.Polygon({
          path: ring.map(([lng, lat]) => new maps.LatLng(lat, lng)),
          strokeWeight: 0,
          strokeOpacity: 0,
          fillColor: '#0d9488',
          fillOpacity: 0.16,
          zIndex: 1,
        });
        polygon.setMap(map);
        polygons.push(polygon);
      }
    }
    cityShapeRef.current = polygons;
  }

  function boundsOf(points: LatLng[]): KakaoLatLngBounds | null {
    const maps = mapsRef.current;
    if (!maps || points.length === 0) return null;
    const bounds = new maps.LatLngBounds();
    for (const p of points) bounds.extend(new maps.LatLng(p.lat, p.lng));
    return bounds;
  }

  /** 지금 레벨에서 점들이 전부 "시트에 가려지지 않는 영역" 안에 들어오는가. */
  function allPointsClear(points: LatLng[], inset: number): boolean {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return false;
    const view = map.getBounds();
    const sw = view.getSouthWest();
    const ne = view.getNorthEast();
    const dLat = ne.getLat() - sw.getLat();
    const dLng = ne.getLng() - sw.getLng();
    const top = ne.getLat() - (dLat * PAD_TOP * TIGHTEN_MARGIN) / el.clientHeight;
    const bottom = sw.getLat() + (dLat * (inset + PAD_BOTTOM * TIGHTEN_MARGIN)) / el.clientHeight;
    const left = sw.getLng() + (dLng * PAD_X * TIGHTEN_MARGIN) / el.clientWidth;
    const right = ne.getLng() - (dLng * PAD_X * TIGHTEN_MARGIN) / el.clientWidth;
    return points.every((p) => p.lat <= top && p.lat >= bottom && p.lng >= left && p.lng <= right);
  }

  /**
   * 점들이 시트 위쪽 영역에 딱 들어오도록 중심·레벨을 맞춘다.
   * 카카오 레벨은 2배씩 뛰어서 setBounds 만으로는 한 단계 과하게 축소되는 일이 잦다
   * (화성시만 보여주려는데 수도권 전체가 나온다). 한 단계 당겨 보고 그래도 다 보이면 그대로 둔다.
   */
  function fitPoints(points: LatLng[], inset: number) {
    const map = mapRef.current;
    const bounds = boundsOf(points);
    if (!map || !bounds || bounds.isEmpty()) return;
    map.setBounds(bounds, PAD_TOP, PAD_X, inset + PAD_BOTTOM, PAD_X);
    const level = map.getLevel();
    if (level > 1) {
      map.setLevel(level - 1);
      if (!allPointsClear(points, inset)) map.setLevel(level);
    }
  }

  /**
   * 목표 영역으로 "이동 후 줌인". 카카오에는 bounds 애니메이션이 없으므로
   * 최종 중심/레벨을 먼저 계산해 두고(같은 태스크 안이라 화면에 그려지지 않는다)
   * 원래 위치로 되돌린 뒤 panTo → setLevel(animate) 순서로 그 값에 도달한다.
   */
  function flyToPoints(points: LatLng[]) {
    const map = mapRef.current;
    if (!map || points.length === 0) return;
    clearTimers();
    framedRef.current = points;

    const from = { center: map.getCenter(), level: map.getLevel() };
    fitPoints(points, bottomInsetRef.current);
    const to = { center: map.getCenter(), level: map.getLevel() };

    if (reduceMotionRef.current) return; // 이미 목적지 — 연출만 생략한다

    map.setCenter(from.center);
    map.setLevel(from.level);
    animatingRef.current = true;
    map.panTo(to.center);
    later(() => map.setLevel(to.level, { animate: { duration: ZOOM_MS } }), PAN_MS);
    // 연출 중 시트 높이가 확정되므로(단계마다 다르다) 마지막에 프레이밍을 한 번 더 맞춘다.
    later(() => {
      animatingRef.current = false;
      fitPoints(points, bottomInsetRef.current);
    }, PAN_MS + ZOOM_MS + 60);
  }

  // ── 지도 생성 ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!hasKakaoAppKey()) {
      setPhase('unavailable');
      return;
    }
    let cancelled = false;

    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        mapsRef.current = maps;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(37.1996, 126.9314), // 화성시 중앙부 — 곧 전체 bounds 로 덮인다
          level: 10,
        });
        mapRef.current = map;
        drawCityShape(maps, map);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('unavailable');
      });

    return () => {
      cancelled = true;
      clearTimers();
      for (const polygon of cityShapeRef.current) polygon.setMap(null);
      cityShapeRef.current = [];
    };
  }, []);

  // ── 거점 핀 생성 ─────────────────────────────────────────────────────────
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (phase !== 'ready' || !maps || !map) return;

    const pins = pinsRef.current;
    for (const { overlay } of pins.values()) overlay.setMap(null);
    pins.clear();

    /*
     * 같은 건물에 두 기관이 있는 거점이 실제로 있다(동탄호수공원 복합커뮤니티센터 등).
     * 좌표가 완전히 같으면 위 핀이 아래 핀을 완전히 덮어 ① 이 사라진 것처럼 보이므로,
     * 데이터의 좌표는 그대로 두고 화면에서만 좌우로 벌린다.
     */
    const clusters = clusterByProximity(sites);

    for (const site of sites) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gjc-pin';
      button.addEventListener('click', () => onSelectRef.current(site));

      const group = clusters.get(site.id) ?? [site.id];
      if (group.length > 1) {
        const offset = (group.indexOf(site.id) - (group.length - 1) / 2) * 24;
        button.style.transform = `translateX(${offset}px)`;
      }

      const dot = document.createElement('span');
      dot.className = 'gjc-pin-dot';
      dot.style.setProperty('--gjc-color', AVAILABILITY_COLOR[site.availability]);
      button.appendChild(dot);

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(site.lat, site.lng),
        content: button,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 10,
        map,
      });
      pins.set(site.id, { overlay, button, dot });
    }

    return () => {
      for (const { overlay } of pins.values()) overlay.setMap(null);
      pins.clear();
    };
  }, [phase, sites]);

  // ── 첫 화면: 화성시 전체가 한눈에 ────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || sites.length === 0) return;
    const points = sites.map((s) => ({ lat: s.lat, lng: s.lng }));
    framedRef.current = points;
    fitPoints(points, bottomInsetRef.current);
    // 첫 진입에서만 잡는다 — 이후 프레이밍은 focus/spotlight 토큰이 담당한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sites.length]);

  // ── 핀 상태(추천 순위·선택·흐림) 반영 ────────────────────────────────────
  useEffect(() => {
    if (phase !== 'ready') return;
    const focusing = highlightIds.length > 0;

    for (const site of sites) {
      const pin = pinsRef.current.get(site.id);
      if (!pin) continue;
      const rank = highlightIds.indexOf(site.id);
      const isRanked = rank >= 0;

      pin.dot.textContent = isRanked ? String(rank + 1) : '';
      pin.button.dataset.rank = isRanked ? String(rank + 1) : '';
      pin.button.dataset.dim = focusing && !isRanked ? 'true' : 'false';
      pin.button.dataset.selected = site.id === selectedId ? 'true' : 'false';
      pin.button.setAttribute(
        'aria-label',
        `${isRanked ? `추천 ${rank + 1}순위 ` : ''}${site.displayName} · ${AVAILABILITY_LABEL[site.availability]}`,
      );
      pin.overlay.setZIndex(isRanked ? 40 - rank : 10);

      if (isRanked && !reduceMotion) {
        // 추천 핀은 등장 순서가 그대로 순위 설명이 되도록 ①②③ 순으로 뜬다.
        pin.button.classList.remove('gjc-pin-enter');
        void pin.button.offsetWidth; // 애니메이션 재시작을 위한 강제 reflow
        pin.button.style.setProperty('--gjc-delay', `${rank * 110}ms`);
        pin.button.classList.add('gjc-pin-enter');
      }
    }
  }, [phase, sites, highlightIds, selectedId, reduceMotion]);

  // ── 내 위치 점 ───────────────────────────────────────────────────────────
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (phase !== 'ready' || !maps || !map) return;

    userOverlayRef.current?.setMap(null);
    userOverlayRef.current = null;
    if (!userLocation) return;

    const dot = document.createElement('div');
    dot.className = 'gjc-user-dot';
    dot.setAttribute('aria-label', '내 위치');
    userOverlayRef.current = new maps.CustomOverlay({
      position: new maps.LatLng(userLocation.lat, userLocation.lng),
      content: dot,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: 50,
      map,
    });
  }, [phase, userLocation]);

  // ── 연출 1: 내 주변으로 줌인 (추천이 없으면 화성시 전체로 복귀) ──────────
  useEffect(() => {
    if (phase !== 'ready' || focusToken === 0) return;
    const points: LatLng[] = [];
    if (highlightIds.length > 0) {
      if (userLocation) points.push(userLocation);
      for (const id of highlightIds) {
        const site = sites.find((s) => s.id === id);
        if (site) points.push({ lat: site.lat, lng: site.lng });
      }
    } else {
      for (const site of sites) points.push({ lat: site.lat, lng: site.lng });
    }
    flyToPoints(points);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, focusToken]);

  // ── 연출 2: 핀 하나를 시트 위쪽으로 올려 보여주기 ────────────────────────
  useEffect(() => {
    if (phase !== 'ready' || spotlightToken === 0 || !selectedId) return;
    const site = sites.find((s) => s.id === selectedId);
    if (!site) return;
    // 한 점만으로 bounds 를 잡으면 최대 배율까지 붙으므로 주변 약 500m 를 함께 담는다.
    const pad = 0.005;
    flyToPoints([
      { lat: site.lat - pad, lng: site.lng - pad },
      { lat: site.lat + pad, lng: site.lng + pad },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, spotlightToken]);

  /*
   * 시트 높이가 바뀌면(단계 전환) 지도가 실제로 보이는 영역이 달라진다.
   * 그대로 두면 추천 ③ 이 시트 뒤로 숨는다 — 마지막 프레이밍을 새 높이로 다시 맞춘다.
   * 연출 중이면 건너뛴다(연출 끝에서 어차피 한 번 더 맞춘다).
   */
  useEffect(() => {
    if (phase !== 'ready' || !framedRef.current) return;
    const id = window.setTimeout(() => {
      if (animatingRef.current || !framedRef.current) return;
      fitPoints(framedRef.current, bottomInset);
    }, 220);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, bottomInset]);

  // 창 크기가 바뀌면 지도 캔버스를 다시 계산하고 프레이밍도 되살린다.
  useEffect(() => {
    function handleResize() {
      mapRef.current?.relayout();
      if (framedRef.current) fitPoints(framedRef.current, bottomInsetRef.current);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="absolute inset-0 bg-slate-200" aria-hidden={phase !== 'ready'}>
      <div ref={containerRef} className="h-full w-full" data-testid="citizen-map" />

      {phase === 'loading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-500">
          <Loader2 size={26} className="animate-spin" aria-hidden />
          <p className="text-base">지도를 불러오는 중이에요</p>
        </div>
      )}

      {phase === 'unavailable' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 px-8 text-center text-slate-500">
          <p className="text-lg font-semibold text-slate-700">지도를 불러올 수 없어요</p>
          <p className="text-base">지도 없이도 아래에서 갈 곳을 찾아드릴게요.</p>
        </div>
      )}
    </div>
  );
}
