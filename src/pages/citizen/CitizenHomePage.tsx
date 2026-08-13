import { useMemo, useState } from 'react';
import { LocateFixed, Map, MapPin, PhoneCall, PlayCircle, Sparkles } from 'lucide-react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useCitizenSites } from '../../hooks/useCitizenSites';
import { recommendCitizenSites } from '../../utils/citizenSite';
import type { LatLng } from '../../lib/geo';
import type { AreaCentroid } from '../../data/mockSites';
import BigButton from '../../components/citizen/BigButton';
import RecommendationCard from '../../components/citizen/RecommendationCard';
import DongPicker from '../../components/citizen/DongPicker';
import CitizenMap from '../../components/citizen/CitizenMap';
import DemoRoleSheet from '../../components/demo/DemoRoleSheet';

/**
 * 시민 홈. 첫 화면은 지도도 메뉴도 아니라 질문 하나다 — "지금 받을 수 있는 곳을 찾으시나요?"
 * 위치를 고르면(내 주변 또는 동네 선택) 바로 추천 거점 최대 3개만 보여준다.
 * 필터·정렬·검색은 만들지 않는다 — 서비스가 대신 골라서 보여준다.
 */
export default function CitizenHomePage() {
  const geo = useGeolocation();
  const { sites } = useCitizenSites();
  const [manualOrigin, setManualOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [showDongPicker, setShowDongPicker] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showDemoSheet, setShowDemoSheet] = useState(false);

  const origin = geo.status === 'granted' ? geo.coords : manualOrigin;
  const hasOrigin = origin !== null;

  const recommended = useMemo(() => recommendCitizenSites(sites, origin, 3), [sites, origin]);

  function handleSelectDong(area: AreaCentroid) {
    setManualOrigin({ lat: area.lat, lng: area.lng });
    setOriginLabel(`${area.area} 기준`);
    setShowDongPicker(false);
  }

  function handleReset() {
    setManualOrigin(null);
    setOriginLabel(null);
  }

  return (
    <div className="pb-10">
      <div className="flex justify-end px-5 pt-3">
        <button
          type="button"
          onClick={() => setShowDemoSheet(true)}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <PlayCircle size={14} aria-hidden />
          시연 모드
        </button>
      </div>

      <div className="px-5 pt-2">
        <BigButton to="/easy" variant="outline" size="md" icon={Sparkles}>
          간편하게 이용하기
        </BigButton>
      </div>

      {!hasOrigin ? (
        <div className="px-5 pt-8">
          <h1 className="text-[26px] font-bold leading-snug text-slate-900">
            지금 받을 수 있는 곳을
            <br />
            찾으시나요?
          </h1>

          <div className="mt-8 space-y-3">
            <BigButton onClick={geo.request} icon={LocateFixed} disabled={geo.status === 'locating'}>
              {geo.status === 'locating' ? '위치를 확인하는 중이에요' : '내 주변에서 찾기'}
            </BigButton>
            <BigButton onClick={() => setShowDongPicker(true)} variant="secondary" icon={MapPin}>
              사는 동네 선택하기
            </BigButton>
          </div>

          {geo.status === 'denied' && (
            <p className="mt-4 text-base text-slate-500">
              위치 권한이 꺼져 있어요. 사는 동네를 선택해서 계속 진행할 수 있어요.
            </p>
          )}
        </div>
      ) : (
        <div className="px-5 pt-6">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900">가까운 곳부터 보여드릴게요</h2>
          </div>
          {originLabel && <p className="mt-1 text-base text-slate-500">{originLabel}</p>}

          {recommended.length === 0 ? (
            <p className="mt-6 text-lg text-slate-500">확인할 수 있는 거점이 없어요.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {recommended.map((site, i) => (
                <RecommendationCard key={site.id} rank={i + 1} site={site} />
              ))}
            </ul>
          )}

          <div className="mt-5">
            <BigButton variant="secondary" icon={Map} onClick={() => setShowMap(true)}>
              지도에서 보기
            </BigButton>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="mt-4 min-h-[48px] w-full text-base font-medium text-slate-400 underline underline-offset-4"
          >
            다른 동네로 다시 찾기
          </button>
        </div>
      )}

      <div className="mt-10 border-t border-slate-100 px-5 pt-6">
        <p className="mb-3 text-lg font-bold text-slate-800">직접 가기 어려우신가요?</p>
        <BigButton to="/help" variant="secondary" icon={PhoneCall}>
          도움 요청하기
        </BigButton>
      </div>

      {showDongPicker && <DongPicker onSelect={handleSelectDong} onClose={() => setShowDongPicker(false)} />}
      {showMap && (
        <CitizenMap
          sites={recommendCitizenSites(sites, origin, sites.length)}
          userLocation={origin}
          onClose={() => setShowMap(false)}
        />
      )}
      <DemoRoleSheet open={showDemoSheet} onClose={() => setShowDemoSheet(false)} />
    </div>
  );
}
