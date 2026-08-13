import { Navigation } from 'lucide-react';
import { formatDistance, kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt } from '../../utils/citizenFormat';
import type { RankedCitizenSite } from '../../utils/citizenSite';
import AvailabilityBadge from './AvailabilityBadge';
import BigButton from './BigButton';

interface RecommendationCardProps {
  rank: number;
  site: RankedCitizenSite;
  /** 위치 권한을 거부해 동네만 선택한 경우, 거리 대신 이 문구를 보여준다. */
  distanceFallbackLabel?: string;
}

export default function RecommendationCard({ rank, site, distanceFallbackLabel }: RecommendationCardProps) {
  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-teal-700">{rank}순위</p>
      <h3 className="mt-1 text-xl font-bold leading-snug text-slate-900">{site.displayName}</h3>

      <div className="mt-2">
        <AvailabilityBadge availability={site.availability} size="lg" />
      </div>

      {site.availability !== 'unknown' && site.focusItem && (
        <p className="mt-2 text-lg font-semibold text-slate-800">{site.focusItem}</p>
      )}

      <p className="mt-2 text-base text-slate-500">
        {site.distanceKm !== null ? formatDistance(site.distanceKm) : distanceFallbackLabel ?? site.address ?? ''}
      </p>
      <p className="mt-0.5 text-base text-slate-500">{formatCheckedAt(site.updatedAt)}</p>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <BigButton
          href={kakaoDirectionsUrl(site.name, { lat: site.lat, lng: site.lng })}
          icon={Navigation}
          size="md"
        >
          길찾기
        </BigButton>
        <BigButton to={`/site/${site.id}`} variant="secondary" size="md">
          자세히 보기
        </BigButton>
      </div>
    </li>
  );
}
