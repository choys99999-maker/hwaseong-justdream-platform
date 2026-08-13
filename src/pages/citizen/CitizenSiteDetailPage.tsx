import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Navigation, Phone, PhoneCall } from 'lucide-react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useCitizenSites } from '../../hooks/useCitizenSites';
import { rankCitizenSites } from '../../utils/citizenSite';
import { formatDistance, kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt } from '../../utils/citizenFormat';
import AvailabilityBadge from '../../components/citizen/AvailabilityBadge';
import BigButton from '../../components/citizen/BigButton';

/**
 * 거점 상세. 정보를 최소화한다 — 재고율·D-day·관리자 KPI 같은 숫자는 넣지 않는다.
 * 거리 표시는 위치 권한이 이미 허용돼 있을 때만 조용히(재요청 프롬프트 없이) 보여주고,
 * 그렇지 않으면 주소만으로 충분히 판단할 수 있게 한다.
 */
export default function CitizenSiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const geo = useGeolocation();
  const { sites } = useCitizenSites();

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') geo.request();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const origin = geo.status === 'granted' ? geo.coords : null;
  const ranked = rankCitizenSites(sites, origin);
  const site = ranked.find((s) => s.id === id);

  if (!site) {
    return (
      <div className="px-5 py-8">
        <BackLink />
        <p className="mt-6 text-lg text-slate-600">거점 정보를 찾을 수 없어요.</p>
      </div>
    );
  }

  return (
    <div className="px-5 py-6 pb-[max(40px,env(safe-area-inset-bottom))]">
      <BackLink />

      <h1 className="mt-3 text-[24px] font-bold leading-snug text-slate-900">{site.displayName}</h1>
      <div className="mt-2">
        <AvailabilityBadge availability={site.availability} size="lg" />
      </div>
      {site.availability !== 'unknown' && site.focusItem && (
        <p className="mt-2 text-lg font-semibold text-slate-800">{site.focusItem}</p>
      )}

      <div className="mt-4 space-y-1.5 text-lg text-slate-700">
        {site.address && <p>{site.address}</p>}
        {site.distanceKm !== null && <p className="text-slate-500">{formatDistance(site.distanceKm)}</p>}
        <p className="text-slate-500">{formatCheckedAt(site.updatedAt)}</p>
        <p className="text-slate-500">운영시간은 아직 확인이 필요해요</p>
      </div>

      <div className="mt-6 space-y-3">
        <BigButton
          href={kakaoDirectionsUrl(site.name, { lat: site.lat, lng: site.lng })}
          icon={Navigation}
        >
          길찾기
        </BigButton>
        {site.phone ? (
          <BigButton href={`tel:${site.phone}`} variant="secondary" icon={Phone}>
            전화하기
          </BigButton>
        ) : (
          <p className="text-center text-base text-slate-400">전화번호는 아직 확인 중이에요</p>
        )}
      </div>

      <div className="mt-10 border-t border-slate-100 pt-6">
        <p className="mb-3 text-lg font-bold text-slate-800">직접 가기 어려우신가요?</p>
        <BigButton to="/help" variant="secondary" icon={PhoneCall}>
          도움 요청하기
        </BigButton>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex min-h-[48px] items-center gap-1.5 text-lg font-medium text-slate-500 hover:text-teal-700"
    >
      <ArrowLeft size={20} aria-hidden /> 지도로 돌아가기
    </Link>
  );
}
