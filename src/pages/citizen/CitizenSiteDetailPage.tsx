import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { HandHeart } from 'lucide-react';
import AppHeader from '../../components/citizen/ui/AppHeader';
import Button from '../../components/citizen/ui/Button';
import { EmptyState } from '../../components/citizen/ui/Feedback';
import PlaceDetail from '../../components/citizen/PlaceDetail';
import { useCitizenPlaces } from '../../hooks/useCitizenPlaces';
import { useGeolocation } from '../../hooks/useGeolocation';
import { rankPlaces } from '../../utils/citizenPlace';

/**
 * 거점 상세 페이지. 지도 위 시트와 **똑같은** 조각(PlaceDetail)을 쓴다 —
 * 어디서 열든 같은 순서, 같은 문장이 나와야 "다른 화면에 온 것 같다" 는 느낌이 없다.
 *
 * 거리는 이미 허용된 위치가 있을 때만 조용히 계산한다. 이 화면에서 위치 권한을
 * 새로 묻지 않는다 — 사용자가 요청하지 않은 권한 창은 그 자체로 방해다.
 */
export default function CitizenSiteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const geo = useGeolocation();
  const { places } = useCitizenPlaces();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!cancelled && status.state === 'granted') setAllowed(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { request } = geo;
  useEffect(() => {
    if (allowed) request();
  }, [allowed, request]);

  const origin = geo.status === 'granted' ? geo.coords : null;
  const place = rankPlaces(places, origin).find((p) => p.id === id) ?? null;

  if (!place) {
    return (
      <>
        <AppHeader title="거점 정보" backTo="/" />
        <EmptyState title="거점 정보를 찾을 수 없어요">
          <div className="mx-auto max-w-[280px]">
            <Button to="/" variant="secondary">
              지도로 돌아가기
            </Button>
          </div>
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <AppHeader title={place.displayName} />
      <div className="px-5 py-5 pb-[max(32px,env(safe-area-inset-bottom))]">
        <PlaceDetail place={place} originLabel={origin ? '내 위치' : null} showTitle={false} />

        <div className="mt-8 border-t border-line-100 pt-5">
          <p className="mb-3 text-lead font-bold text-ink-950">직접 가기 어려우세요?</p>
          <Button to="/help" variant="secondary" size="md" icon={HandHeart}>
            도움 요청하기
          </Button>
        </div>
      </div>
    </>
  );
}
