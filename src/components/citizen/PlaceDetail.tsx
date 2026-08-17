import { useState } from 'react';
import { ChevronRight, ChevronUp, Navigation, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ITEM_GROUP_LABEL, ITEM_GROUP_ORDER, type ItemGroup, type PlaceItem } from '../../data/citizenDirectory';
import { kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt, todayLocal } from '../../utils/citizenFormat';
import { distanceText, resolvePlaceStatus, type RankedPlace } from '../../utils/citizenPlace';
import Button from './ui/Button';
import StatusLine from './ui/StatusLine';

const STOCK_LABEL: Record<string, string> = {
  many: '있어요',
  some: '있어요',
  few: '얼마 안 남았어요',
};

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
 * 거점 한 곳을 설명하는 유일한 화면 조각. 지도 위 시트와 `/site/:id` 페이지가 이걸 같이 쓴다.
 *
 * 정보 순서 —
 *   A. 기관명 + 이용 가능 상태 (3초 안에 "지금 갈 수 있는가")
 *   B. 물품 현황 요약 + 목록 보기 (3초 안에 "원하는 물품이 있는가 + 얼마나 최신인가")
 *   C. 거리 + 길찾기 CTA (3초 안에 "어떻게 가는가")
 *   D. 나머지 — 전화, 도움요청, 주소, 기관
 */
export default function PlaceDetail({
  place,
  originLabel,
  titleId,
  showTitle = true,
  showHelpRow = false,
}: PlaceDetailProps) {
  const navigate = useNavigate();
  const [showItems, setShowItems] = useState(false);
  const status = resolvePlaceStatus(place);

  const itemsByCategory = ITEM_GROUP_ORDER.reduce<Record<ItemGroup, PlaceItem[]>>(
    (acc, g) => {
      acc[g] = place.items.filter((i) => i.category === g);
      return acc;
    },
    { food: [], living: [], hygiene: [] },
  );
  const totalItems = place.items.length;
  const categorySummary = ITEM_GROUP_ORDER.filter((g) => itemsByCategory[g].length > 0)
    .map((g) => `${ITEM_GROUP_LABEL[g]} ${itemsByCategory[g].length}종`)
    .join(' · ');

  const isStale = place.updatedAt.split('T')[0] < todayLocal();
  const checkedText = formatCheckedAt(place.updatedAt);

  return (
    <div>
      {/* A. 기관명 */}
      {showTitle && (
        <h2 id={titleId} className="text-title text-ink-950">
          {place.displayName}
        </h2>
      )}

      {/* A. 이용 가능 상태 */}
      <div className={showTitle ? 'mt-2.5' : ''}>
        <StatusLine status={status} size="lg" />
      </div>

      {/* B. 물품 현황 */}
      <div className="mt-4 rounded-card border border-line-200 bg-paper px-4 py-3">
        <p className="text-note font-bold text-ink-600">
          {status.closed ? '최근 확인된 물품' : '현재 확인된 물품'}
        </p>

        {totalItems > 0 ? (
          <>
            <p className="mt-1 text-lead font-bold text-ink-950">총 {totalItems}종</p>
            {categorySummary && (
              <p className="mt-0.5 text-body text-ink-800">{categorySummary}</p>
            )}
          </>
        ) : place.focusItem ? (
          <p className="mt-1 text-lead text-ink-800">{place.focusItem}</p>
        ) : (
          <p className="mt-1 text-body text-ink-600">물품 정보를 확인 중이에요</p>
        )}

        <p
          className={`mt-2 text-note ${
            isStale ? 'font-semibold text-warn-700' : 'text-ink-600'
          }`}
        >
          {isStale ? '방문 전 확인이 필요해요' : checkedText}
        </p>

        {totalItems > 0 && (
          <button
            type="button"
            onClick={() => setShowItems((v) => !v)}
            className="tap-md mt-2.5 flex w-full items-center justify-between rounded-control border border-line-200 bg-surface px-3 py-3 text-left transition-colors hover:border-brand-300 hover:text-brand-700 focus-ring"
          >
            <span className="text-body font-semibold text-ink-800">
              {showItems ? '물품 목록 접기' : '물품 목록 보기'}
            </span>
            {showItems ? (
              <ChevronUp size={18} className="shrink-0 text-ink-400" aria-hidden />
            ) : (
              <ChevronRight size={18} className="shrink-0 text-ink-400" aria-hidden />
            )}
          </button>
        )}
      </div>

      {/* B-expanded. 물품 전체 목록 */}
      {showItems && totalItems > 0 && (
        <div className="mt-3">
          <h3 className="text-lead font-bold text-ink-950">받을 수 있는 물품</h3>
          <div className="mt-2 divide-y divide-line-100">
            {ITEM_GROUP_ORDER.filter((g) => itemsByCategory[g].length > 0).map((g) => (
              <div key={g} className="py-3">
                <p className="text-note font-bold text-ink-600">{ITEM_GROUP_LABEL[g]}</p>
                <ul className="mt-1.5 space-y-2">
                  {itemsByCategory[g].map((item) => (
                    <li key={item.id} className="flex items-center justify-between">
                      <span className="text-body text-ink-950">{item.name}</span>
                      <span
                        className={`text-note font-semibold ${
                          item.level === 'few' ? 'text-warn-700' : 'text-open-700'
                        }`}
                      >
                        {STOCK_LABEL[item.level] ?? '확인 필요'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-2 text-note text-ink-600">
            {checkedText} 기준 · 방문 전 재고가 달라질 수 있어요
          </p>
        </div>
      )}

      {/* C. 거리 + 길찾기 */}
      <div className="mt-5">
        {place.distanceKm !== null && originLabel && (
          <p className="mb-2 text-body font-semibold text-ink-800">
            {originLabel}에서 {distanceText(place.distanceKm)}
          </p>
        )}
        <Button href={kakaoDirectionsUrl(place.name, { lat: place.lat, lng: place.lng })} icon={Navigation}>
          길찾기
        </Button>
      </div>

      {/* D. 나머지 */}
      <div className="mt-2">
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

      {/* 행정 정보는 전부 아래로 */}
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
