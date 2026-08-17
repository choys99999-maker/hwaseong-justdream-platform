import { ChevronRight, Navigation, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt } from '../../utils/citizenFormat';
import { distanceText, itemSummary, resolvePlaceStatus, type RankedPlace } from '../../utils/citizenPlace';
import Button from './ui/Button';
import StatusLine from './ui/StatusLine';

interface PlaceDetailProps {
  place: RankedPlace;
  /** 거리를 무엇 기준으로 잰 것인지. "내 위치" · "동탄5동". 없으면 거리를 감춘다. */
  originLabel?: string | null;
  /** 시트 안에서는 제목이 시트 라벨이 되도록 id 를 넘긴다. */
  titleId?: string;
  /**
   * 기관명을 여기서 낼지. 페이지로 열릴 때는 상단 헤더가 이미 기관명을 제목으로 달고 있어서
   * 끄고 쓴다 — 같은 이름을 두 번 읽게 하지 않는다.
   */
  showTitle?: boolean;
  /**
   * "직접 방문이 어려우신가요?" 줄을 여기서 낼지. `/site/:id` 페이지는 이미 자기 자리에
   * 같은 안내를 더 크게 두고 있어서 끄고 쓴다 — 지도 시트에서만 켠다.
   */
  showHelpRow?: boolean;
}

/**
 * 거점 한 곳을 설명하는 유일한 화면 조각. 지도 위 시트와 `/site/:id` 페이지가 이걸 같이 쓴다 —
 * 같은 거점을 어디서 열든 같은 순서, 같은 말이 나와야 한다.
 *
 * 정보 순서를 고정한다.
 *   ① 기관명  ② 지금 이용할 수 있는지  ③ 거리  ④ 확인된 물품  ⑤ 마지막 확인
 * 그 아래에만 주소·기관 유형을 둔다. 상태 문장은 `resolvePlaceStatus` 한 곳에서만 만들어서
 * "운영 종료" 와 "지금 받을 수 있어요" 가 함께 뜨는 모순이 생기지 않는다.
 */
export default function PlaceDetail({
  place,
  originLabel,
  titleId,
  showTitle = true,
  showHelpRow = false,
}: PlaceDetailProps) {
  const navigate = useNavigate();
  const status = resolvePlaceStatus(place);
  const items = itemSummary(place);

  return (
    <div>
      {/* ① 기관명 */}
      {showTitle && (
        <h2 id={titleId} className="text-title text-ink-950">
          {place.displayName}
        </h2>
      )}

      {/* ② 현재 이용 상태 */}
      <div className={showTitle ? 'mt-2.5' : ''}>
        <StatusLine status={status} size="lg" />
      </div>

      {/* ③ 거리 */}
      {place.distanceKm !== null && originLabel && (
        <p className="mt-3 text-lead font-semibold text-ink-950">
          {originLabel}에서 {distanceText(place.distanceKm)}
        </p>
      )}

      {/* ④ 지금 확인된 물품 — 문을 닫았으면 "지금" 이라고 말하지 않는다. */}
      {items && (
        <div className="mt-4">
          <p className="text-note font-bold text-ink-600">
            {status.closed ? '최근 확인된 물품' : '지금 확인된 물품'}
          </p>
          <p className="mt-1 text-lead text-ink-950">{items}</p>
        </div>
      )}

      {/* ⑤ 마지막 확인 */}
      <p className="mt-3 text-note text-ink-600">{formatCheckedAt(place.updatedAt)}</p>

      {/* 행동 — 지금 눌러야 할 것 하나, 다른 길 하나. */}
      <div className="mt-5 space-y-2">
        <Button href={kakaoDirectionsUrl(place.name, { lat: place.lat, lng: place.lng })} icon={Navigation}>
          길찾기
        </Button>
        {place.phone ? (
          <Button href={`tel:${place.phone}`} variant="secondary" icon={Phone}>
            전화하기
          </Button>
        ) : (
          <p className="pt-1 text-center text-note text-ink-600">전화번호는 아직 확인 중이에요</p>
        )}
      </div>

      {showHelpRow && (
        <button
          type="button"
          onClick={() => navigate('/help')}
          className="tap-md mt-2 flex w-full items-center justify-between rounded-control px-3 text-left transition-colors hover:bg-line-100 focus-ring"
        >
          <span className="text-note text-ink-600">직접 방문이 어려우신가요?</span>
          <span className="flex shrink-0 items-center gap-0.5 text-note font-bold text-brand-700">
            도움 요청하기
            <ChevronRight size={16} aria-hidden />
          </span>
        </button>
      )}

      {/* 덜 중요한 사실은 전부 아래로. */}
      <dl className="mt-6 space-y-2 border-t border-line-100 pt-4 text-note">
        {place.address && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 text-ink-600">주소</dt>
            <dd className="min-w-0 flex-1 text-ink-800">{place.address}</dd>
          </div>
        )}
        <div className="flex gap-2">
          <dt className="w-16 shrink-0 text-ink-600">기관</dt>
          <dd className="min-w-0 flex-1 text-ink-800">
            {place.name}
            {place.facilityType ? ` · ${place.facilityType}` : ''}
          </dd>
        </div>
      </dl>
    </div>
  );
}
