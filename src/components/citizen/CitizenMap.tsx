import { useCallback, useEffect, useRef, useState } from 'react';
import { LocateFixed, RotateCcw, MapPin } from 'lucide-react';
import type { KakaoCustomOverlay, KakaoMap, KakaoMapsNamespace } from '../../types/kakao';
import { MissingKakaoKeyError, loadKakaoMaps, resetKakaoMapsLoader } from '../../lib/kakaoMap';
import { HWASEONG_BBOX } from '../../data/districtBoundaries';
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
  className?: string;
}

interface MarkerEntry {
  site: CitizenSite;
  overlay: KakaoCustomOverlay;
  element: HTMLButtonElement;
}

const RELAYOUT_DEBOUNCE_MS = 160;

function createPinElement(site: CitizenSite): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'cj-pin';
  btn.dataset.status = site.overallStatus;
  btn.dataset.selected = 'false';
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
  className = '',
}: CitizenMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapsRef = useRef<KakaoMapsNamespace | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const myLocOverlayRef = useRef<KakaoCustomOverlay | null>(null);
  const cleanupRef = useRef<(() => void)[]>([]);

  const [phase, setPhase] = useState<MapPhase>('loading');
  const [retryToken, setRetryToken] = useState(0);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle');

  const handlersRef = useRef({ onSelectSite });
  handlersRef.current = { onSelectSite };

  /** 화성시 전체 범위로 맞추기 */
  const fitHwaseong = useCallback(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (!maps || !map) return;
    const [minLng, minLat, maxLng, maxLat] = HWASEONG_BBOX;
    const bounds = new maps.LatLngBounds(
      new maps.LatLng(minLat, minLng),
      new maps.LatLng(maxLat, maxLng),
    );
    map.setBounds(bounds, 40, 40, 40, 40);
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

        const [minLng, minLat, maxLng, maxLat] = HWASEONG_BBOX;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng((minLat + maxLat) / 2, (minLng + maxLng) / 2),
          level: 9,
        });
        map.addControl(new maps.ZoomControl(), maps.ControlPosition.RIGHT);
        mapRef.current = map;

        // 배경 클릭 → 선택 해제
        const onBgClick = () => handlersRef.current.onSelectSite(null);
        maps.event.addListener(map, 'click', onBgClick);
        cleanupRef.current.push(() => maps.event.removeListener(map, 'click', onBgClick));

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
      {phase === 'ready' && (
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
      {phase === 'ready' && (
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
