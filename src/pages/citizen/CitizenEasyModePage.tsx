import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, LifeBuoy, MapPin, PackageCheck, PhoneCall } from 'lucide-react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useCitizenSites } from '../../hooks/useCitizenSites';
import { recommendCitizenSites } from '../../utils/citizenSite';
import type { LatLng } from '../../lib/geo';
import { CITIZEN_HELP_PHONE } from '../../data/citizenContact';
import BigButton from '../../components/citizen/BigButton';
import RecommendationCard from '../../components/citizen/RecommendationCard';
import DongPicker from '../../components/citizen/DongPicker';

type Stage = 'menu' | 'results';

/**
 * 간편 이용 — "어르신 모드" 라는 이름은 쓰지 않는다. 같은 데이터를 더 단순한 화면으로 보여줄 뿐,
 * 별도 데이터·별도 서비스가 아니다. 한 화면의 행동은 항상 최대 3개다.
 */
export default function CitizenEasyModePage() {
  const [stage, setStage] = useState<Stage>('menu');
  const geo = useGeolocation();
  const { sites } = useCitizenSites();
  const [manualOrigin, setManualOrigin] = useState<LatLng | null>(null);
  const [showDongPicker, setShowDongPicker] = useState(false);

  const origin = geo.status === 'granted' ? geo.coords : manualOrigin;
  const recommended = useMemo(() => recommendCitizenSites(sites, origin, 3), [sites, origin]);

  function handleShowNearby() {
    setStage('results');
    if (geo.status === 'idle') geo.request();
  }

  return (
    <div className="px-5 py-6 pb-[max(40px,env(safe-area-inset-bottom))]">
      <Link
        to="/"
        className="inline-flex min-h-[48px] items-center gap-1.5 text-lg font-medium text-slate-500 hover:text-teal-700"
      >
        <ArrowLeft size={20} /> 처음 화면으로
      </Link>

      <h1 className="mt-3 text-[24px] font-bold leading-snug text-slate-900">간편하게 이용하기</h1>

      {stage === 'menu' && (
        <div className="mt-6 space-y-3">
          <BigButton icon={PackageCheck} onClick={handleShowNearby}>
            지금 받을 수 있는 곳
          </BigButton>
          <BigButton to="/help" variant="secondary" icon={LifeBuoy}>
            직접 가기 어려워요
          </BigButton>
          <BigButton href={`tel:${CITIZEN_HELP_PHONE}`} variant="secondary" icon={PhoneCall}>
            전화로 도와주세요
          </BigButton>
        </div>
      )}

      {stage === 'results' && (
        <div className="mt-6">
          {geo.status === 'locating' && (
            <p className="mb-3 text-lg text-slate-500">가까운 곳을 찾는 중이에요...</p>
          )}

          <ul className="space-y-3">
            {recommended.map((site, i) => (
              <RecommendationCard key={site.id} rank={i + 1} site={site} />
            ))}
          </ul>

          {origin === null && geo.status !== 'locating' && (
            <div className="mt-4">
              <BigButton onClick={() => setShowDongPicker(true)} variant="secondary" icon={MapPin}>
                사는 동네 선택하기
              </BigButton>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStage('menu')}
            className="mt-5 min-h-[48px] w-full text-base font-medium text-slate-400 underline underline-offset-4"
          >
            처음으로
          </button>
        </div>
      )}

      {showDongPicker && (
        <DongPicker
          onSelect={(area) => {
            setManualOrigin({ lat: area.lat, lng: area.lng });
            setShowDongPicker(false);
          }}
          onClose={() => setShowDongPicker(false)}
        />
      )}
    </div>
  );
}
