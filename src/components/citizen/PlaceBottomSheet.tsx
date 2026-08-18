import { useEffect, useRef } from 'react';
import { Navigation } from 'lucide-react';
import { kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt, todayLocal } from '../../utils/citizenFormat';
import { distanceText, resolvePlaceStatus, type RankedPlace } from '../../utils/citizenPlace';
import Button from './ui/Button';
import { StatusChip } from './ui/StatusLine';

/**
 * 장소 선택 직후 뜨는 첫 Bottom Sheet.
 *
 * 여기서 판단할 건 "여기가 어디인지 / 지금 이용 가능한지 / 물품을 확인할지 / 길찾기할지"
 * 뿐이다 — 그래서 다섯 줄(이름+거리, 상태, 물품 확인 여부, 확인 시각, 버튼 두 개)을 넘기지
 * 않는다. 운영시간 상세·물품 목록·주소·전화 같은 나머지는 전부 `onCheckItems` 로 여는
 * 별도 화면(`PlaceItemsPage`) 몫이다.
 *
 * 드래그로 키우는 상태가 없으므로 닫기도 이 시트가 직접 하지 않는다 — 지도 배경을 탭하면
 * `CitizenMap` 이 이미 선택을 해제한다(`onSelect(null)`).
 */
interface Props {
  place: RankedPlace;
  originLabel: string | null;
  onHeightChange: (height: number) => void;
  onCheckItems: () => void;
}

export default function PlaceBottomSheet({ place, originLabel, onHeightChange, onCheckItems }: Props) {
  const ref = useRef<HTMLElement>(null);

  const status = resolvePlaceStatus(place);
  // focusItem 은 실 재고가 아니라 SITE_EXTRAS 의 대표 문구 fallback일 수 있어
  // "물품 정보 확인됨" 근거로 쓰지 않는다 — 실제 품목이 있을 때만 확인됐다고 말한다.
  const hasItemInfo = place.items.length > 0;
  const isStale = place.updatedAt.split('T')[0] < todayLocal();
  const checkedText = formatCheckedAt(place.updatedAt);
  const directionUrl = kakaoDirectionsUrl(place.name, { lat: place.lat, lng: place.lng });

  // 높이 변화를 지도에 전달해 카메라 오프셋을 맞춘다.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      onHeightChange(Math.round(entry.contentRect.height));
    });
    observer.observe(el);
    onHeightChange(Math.round(el.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [onHeightChange]);

  return (
    <section
      ref={ref}
      aria-label={`${place.displayName} 요약`}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col gap-3 rounded-t-sheet bg-surface px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 shadow-float"
    >
      {/* 기관명 + 거리 */}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-title font-bold leading-tight text-ink-950">{place.displayName}</h2>
        {place.distanceKm !== null && originLabel && (
          <span className="shrink-0 text-note font-semibold text-ink-600">
            {distanceText(place.distanceKm)}
          </span>
        )}
      </div>

      {/* 이용 상태 — 라벨만, 운영시간 등 상세는 붙이지 않는다 */}
      <div>
        <StatusChip status={status} />
      </div>

      {/* 물품 정보 확인 여부 + 시각 */}
      <div>
        <p className="text-body font-bold text-ink-800">
          {hasItemInfo ? '물품 정보 확인됨' : '아직 확인된 물품 정보가 없어요'}
        </p>
        {hasItemInfo && (
          <p className={`mt-0.5 text-note ${isStale ? 'font-semibold text-warn-700' : 'text-ink-500'}`}>
            {isStale ? `${checkedText} · 최신 정보가 아닐 수 있어요` : checkedText}
          </p>
        )}
      </div>

      {/* 물품 확인 · 길찾기 */}
      <div className="flex gap-2">
        <Button variant="secondary" block={false} onClick={onCheckItems} className="flex-1">
          물품 확인
        </Button>
        <Button href={directionUrl} icon={Navigation} block={false} className="flex-1">
          길찾기
        </Button>
      </div>
    </section>
  );
}
