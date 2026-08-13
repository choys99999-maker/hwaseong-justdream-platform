import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Navigation, X } from 'lucide-react';
import { loadKakaoMaps, hasKakaoAppKey } from '../../lib/kakaoMap';
import type { KakaoMap, KakaoMapsNamespace, KakaoCustomOverlay } from '../../types/kakao';
import type { LatLng } from '../../lib/geo';
import { formatDistance, kakaoDirectionsUrl } from '../../lib/geo';
import type { RankedCitizenSite } from '../../utils/citizenSite';
import { AVAILABILITY_ICON, AVAILABILITY_LABEL } from '../../utils/citizenSite';
import BigButton from './BigButton';

type Phase = 'loading' | 'ready' | 'missing-key' | 'error';

const AVAILABILITY_COLOR: Record<RankedCitizenSite['availability'], string> = {
  available: '#10b981',
  low: '#f59e0b',
  unknown: '#94a3b8',
};

interface CitizenMapProps {
  sites: RankedCitizenSite[];
  userLocation: LatLng | null;
  onClose: () => void;
}

/**
 * 시민용 지도 — 내 위치·거점 위치·거리·길찾기만 보여준다.
 * 행정구역 폴리곤, 클러스터, 사업유형·상태 필터, 관제용 KPI 는 전부 뺐다.
 * (관리자 KakaoDistrictMap 은 그런 기능을 위해 만들어졌고, 시민 화면에는 필요 없다)
 */
export default function CitizenMap({ sites, userLocation, onClose }: CitizenMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMap | null>(null);
  const overlaysRef = useRef<KakaoCustomOverlay[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [selected, setSelected] = useState<RankedCitizenSite | null>(null);

  useEffect(() => {
    if (!hasKakaoAppKey()) {
      setPhase('missing-key');
      return;
    }
    let cancelled = false;

    loadKakaoMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        renderMap(maps);
        setPhase('ready');
      })
      .catch(() => {
        if (!cancelled) setPhase('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function renderMap(maps: KakaoMapsNamespace) {
    if (!containerRef.current) return;

    const center = userLocation ?? averageOf(sites);
    const map = new maps.Map(containerRef.current, {
      center: new maps.LatLng(center.lat, center.lng),
      level: 8,
    });
    mapRef.current = map;

    const bounds = new maps.LatLngBounds();

    if (userLocation) {
      const dot = document.createElement('div');
      dot.className = 'gjc-user-dot';
      dot.setAttribute('aria-label', '내 위치');
      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(userLocation.lat, userLocation.lng),
        content: dot,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 20,
        map,
      });
      overlaysRef.current.push(overlay);
      bounds.extend(new maps.LatLng(userLocation.lat, userLocation.lng));
    }

    for (const site of sites) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gjc-marker';
      button.style.setProperty('--gjc-color', AVAILABILITY_COLOR[site.availability]);
      button.setAttribute('aria-label', `${site.displayName} · ${AVAILABILITY_LABEL[site.availability]}`);
      button.addEventListener('click', () => setSelected(site));

      const overlay = new maps.CustomOverlay({
        position: new maps.LatLng(site.lat, site.lng),
        content: button,
        xAnchor: 0.5,
        yAnchor: 0.5,
        zIndex: 10,
        map,
      });
      overlaysRef.current.push(overlay);
      bounds.extend(new maps.LatLng(site.lat, site.lng));
    }

    if (!bounds.isEmpty()) {
      map.setBounds(bounds, 60, 60, 60, 60);
    }
  }

  function averageOf(list: RankedCitizenSite[]): LatLng {
    if (list.length === 0) return { lat: 37.1996, lng: 126.8314 }; // 화성시청 근방 fallback
    const sum = list.reduce((acc, s) => ({ lat: acc.lat + s.lat, lng: acc.lng + s.lng }), { lat: 0, lng: 0 });
    return { lat: sum.lat / list.length, lng: sum.lng / list.length };
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="text-lg font-bold text-slate-900">지도에서 보기</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="지도 닫기"
          className="flex h-12 w-12 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <X size={24} />
        </button>
      </div>

      <div className="relative flex-1">
        <div ref={containerRef} className="h-full w-full bg-slate-100" />

        {phase === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white/90 text-slate-500">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-base">지도를 불러오는 중이에요</p>
          </div>
        )}

        {(phase === 'missing-key' || phase === 'error') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white px-6 text-center">
            <p className="text-lg font-medium text-slate-700">지도를 불러올 수 없어요</p>
            <p className="text-base text-slate-500">아래 목록으로 거점을 확인해 주세요.</p>
          </div>
        )}

        {phase === 'ready' && selected && (
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-slate-200 bg-white p-4 shadow-[0_-4px_16px_rgba(15,23,42,0.12)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900">{selected.displayName}</p>
                <p className="mt-1 text-base font-semibold text-slate-700">
                  <span aria-hidden>{AVAILABILITY_ICON[selected.availability]}</span>{' '}
                  {AVAILABILITY_LABEL[selected.availability]}
                </p>
                {selected.distanceKm !== null && (
                  <p className="mt-1 text-base text-slate-500">{formatDistance(selected.distanceKm)}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <BigButton
                href={kakaoDirectionsUrl(selected.name, { lat: selected.lat, lng: selected.lng })}
                variant="primary"
                icon={Navigation}
                size="md"
              >
                길찾기
              </BigButton>
              <BigButton to={`/site/${selected.id}`} variant="secondary" size="md">
                자세히 보기
              </BigButton>
            </div>
          </div>
        )}
      </div>

      {phase !== 'ready' || sites.length === 0 ? null : (
        <p className="border-t border-slate-100 px-4 py-2 text-center text-sm text-slate-400">
          점을 눌러 거점 정보를 확인하세요
        </p>
      )}

      {/* Link import 는 지도 실패 시에도 목록으로 돌아갈 수 있도록 남겨 둔다 */}
      {(phase === 'missing-key' || phase === 'error') && (
        <div className="border-t border-slate-100 p-4">
          <Link
            to="#"
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="block rounded-2xl bg-teal-600 py-4 text-center text-lg font-bold text-white"
          >
            목록으로 돌아가기
          </Link>
        </div>
      )}
    </div>
  );
}
