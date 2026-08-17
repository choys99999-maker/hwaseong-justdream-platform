import { useEffect, useRef, useState } from 'react';
import { ChevronRight, Navigation } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ITEM_GROUP_LABEL, ITEM_GROUP_ORDER } from '../../data/citizenDirectory';
import { kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt, todayLocal } from '../../utils/citizenFormat';
import { distanceText, resolvePlaceStatus, type RankedPlace } from '../../utils/citizenPlace';
import Button from './ui/Button';
import StatusLine from './ui/StatusLine';
import { StatusChip } from './ui/StatusLine';

type SheetState = 'mini' | 'default' | 'expanded';

const DRAG_THRESHOLD = 44;

const STOCK_LABEL: Record<string, string> = {
  many: '있어요',
  some: '있어요',
  few: '얼마 안 남았어요',
};

/**
 * 장소 선택 시 지도 위에 뜨는 3단 Bottom Sheet.
 *
 * mini    — 지도를 넓게 보면서 기본 정보만 한 줄로 확인.
 * default — 30~35% 높이. 방문 결정에 필요한 요약만.
 * expanded — 88% 높이. 물품 목록·이용 안내·위치 정보 전체.
 *
 * 손잡이를 아래로 끌면 단계를 낮추고, mini에서 한 번 더 끌면 닫힌다.
 * 손잡이를 위로 끌거나 탭하면 단계를 높인다.
 * "물품 목록 보기"를 누르면 곧바로 expanded 로 올라간다.
 */
interface Props {
  place: RankedPlace;
  originLabel: string | null;
  onDismiss: () => void;
  onHeightChange: (height: number) => void;
  showOtherPlaces?: boolean;
  onShowOtherPlaces?: () => void;
}

export default function PlaceBottomSheet({
  place,
  originLabel,
  onDismiss,
  onHeightChange,
  showOtherPlaces,
  onShowOtherPlaces,
}: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const dragStart = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [state, setState] = useState<SheetState>('default');

  const status = resolvePlaceStatus(place);
  const isStale = place.updatedAt.split('T')[0] < todayLocal();
  const checkedText = formatCheckedAt(place.updatedAt);
  const closeTime = place.openHours?.split('~')[1]?.trim() ?? null;
  const directionUrl = kakaoDirectionsUrl(place.name, { lat: place.lat, lng: place.lng });

  const itemsByCategory = ITEM_GROUP_ORDER.reduce<Record<string, typeof place.items>>(
    (acc, g) => { acc[g] = place.items.filter((i) => i.category === g); return acc; },
    { food: [], living: [], hygiene: [] },
  );
  const totalItems = place.items.length;
  const categorySummary = ITEM_GROUP_ORDER
    .filter((g) => itemsByCategory[g].length > 0)
    .map((g) => `${ITEM_GROUP_LABEL[g]} ${itemsByCategory[g].length}종`)
    .join(' · ');

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

  // 장소가 바뀌면 default 상태로 리셋.
  useEffect(() => {
    setState('default');
  }, [place.id]);

  function handleDragDown() {
    if (state === 'expanded') { setState('default'); return; }
    if (state === 'default') { setState('mini'); return; }
    onDismiss();
  }

  function handleDragUp() {
    if (state === 'mini') setState('default');
    else if (state === 'default') setState('expanded');
  }

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    dragStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (dragStart.current === null) return;
    setDragY(e.clientY - dragStart.current);
  }

  function onPointerUp() {
    if (dragStart.current === null) return;
    const dy = dragY;
    dragStart.current = null;
    setDragY(0);
    if (dy > DRAG_THRESHOLD) handleDragDown();
    else if (dy < -DRAG_THRESHOLD) handleDragUp();
  }

  function handleHandleClick() {
    if (state === 'mini' || state === 'default') setState(state === 'mini' ? 'default' : 'expanded');
    else setState('default');
  }

  const HEIGHT: Record<SheetState, string> = {
    mini: 'clamp(60px, 13dvh, 76px)',
    default: 'clamp(240px, 38dvh, 340px)',
    expanded: 'clamp(400px, 88dvh, 800px)',
  };

  return (
    <section
      ref={ref}
      aria-label={`${place.displayName} 상세 정보`}
      style={{
        height: HEIGHT[state],
        transform: dragY ? `translateY(${Math.max(-20, dragY)}px)` : undefined,
      }}
      className="absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-sheet bg-surface shadow-float transition-[height] duration-300 ease-out motion-reduce:transition-none"
    >
      {/* 손잡이 */}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleHandleClick}
        aria-label={state === 'expanded' ? '접기' : state === 'mini' ? '펼치기' : '물품 목록 펼치기'}
        className="flex h-7 w-full shrink-0 touch-none items-center justify-center focus-ring"
      >
        <span className="h-1.5 w-11 rounded-full bg-line-200" />
      </button>

      {/* ── Mini: 한 줄 요약 ── */}
      {state === 'mini' && (
        <button
          type="button"
          onClick={() => setState('default')}
          className="flex min-h-0 flex-1 items-center gap-3 px-5 pb-[max(12px,env(safe-area-inset-bottom))] text-left focus-ring"
          aria-label={`${place.displayName} 상세 보기`}
        >
          <StatusChip status={status} />
          <span className="min-w-0 flex-1 truncate text-body font-bold text-ink-950">
            {place.displayName}
          </span>
          {place.distanceKm !== null && (
            <span className="shrink-0 text-note font-semibold text-ink-600">
              {distanceText(place.distanceKm)}
            </span>
          )}
        </button>
      )}

      {/* ── Default: 방문 결정 요약 카드 ── */}
      {state === 'default' && (
        <div className="flex min-h-0 flex-col overflow-hidden px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
          {/* 기관명 + 거리 */}
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-title font-bold leading-tight text-ink-950">{place.displayName}</h2>
            {place.distanceKm !== null && originLabel && (
              <span className="shrink-0 text-note font-semibold text-ink-600">
                {distanceText(place.distanceKm)}
              </span>
            )}
          </div>

          {/* 이용 상태 */}
          <div className="mt-2">
            <StatusLine status={status} size="lg" />
          </div>

          {/* 운영시간 — 데이터 있고 지금 열려 있을 때만 */}
          {!status.closed && closeTime && (
            <p className="mt-0.5 text-note text-ink-500">오늘 {closeTime}까지</p>
          )}

          {/* 물품 요약 카드 */}
          <div className="mt-3 rounded-card border border-line-200 bg-paper px-4 py-2.5">
            <p className="text-note font-bold text-ink-600">
              {status.closed ? '최근 확인된 물품' : '현재 확인된 물품'}
            </p>

            {totalItems > 0 ? (
              <p className="mt-0.5 text-body text-ink-800">{categorySummary}</p>
            ) : place.focusItem ? (
              <p className="mt-0.5 text-body text-ink-800">{place.focusItem}</p>
            ) : (
              <p className="mt-0.5 text-body text-ink-600">물품 정보를 확인 중이에요</p>
            )}

            {totalItems > 0 && (
              <button
                type="button"
                onClick={() => setState('expanded')}
                className="tap-md mt-1.5 flex items-center gap-0.5 text-note font-bold text-brand-700 focus-ring"
              >
                물품 목록 보기
                <ChevronRight size={15} aria-hidden />
              </button>
            )}

            <p className={`mt-1.5 text-note ${isStale ? 'text-warn-600' : 'text-ink-400'}`}>
              {isStale ? `${checkedText} · 최신 정보가 아닐 수 있어요` : checkedText}
            </p>
          </div>

          {/* 길찾기 — Primary CTA */}
          <div className="mt-3">
            <Button href={directionUrl} icon={Navigation}>
              길찾기
            </Button>
          </div>
        </div>
      )}

      {/* ── Expanded: 물품 목록 + 이용 안내 + 위치 정보 ── */}
      {state === 'expanded' && (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
          {/* 기관명 + 거리 */}
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-title font-bold leading-tight text-ink-950">{place.displayName}</h2>
            {place.distanceKm !== null && originLabel && (
              <span className="shrink-0 text-note font-semibold text-ink-600">
                {distanceText(place.distanceKm)}
              </span>
            )}
          </div>

          {/* 이용 상태 */}
          <div className="mt-2">
            <StatusLine status={status} size="lg" />
          </div>

          {/* 길찾기 — 확장 상태에서도 상단에 */}
          <div className="mt-4">
            <Button href={directionUrl} icon={Navigation}>
              길찾기
            </Button>
          </div>

          {/* 받을 수 있는 물품 */}
          <div className="mt-5">
            <h3 className="text-lead font-bold text-ink-950">받을 수 있는 물품</h3>

            {totalItems > 0 ? (
              <>
                <div className="mt-2 divide-y divide-line-100">
                  {ITEM_GROUP_ORDER.filter((g) => itemsByCategory[g].length > 0).map((g) => (
                    <div key={g} className="py-3">
                      <p className="text-note font-bold text-ink-600">{ITEM_GROUP_LABEL[g]}</p>
                      <ul className="mt-2 space-y-2.5">
                        {itemsByCategory[g].map((item) => (
                          <li key={item.id} className="flex items-center justify-between gap-2">
                            <span className="text-body text-ink-950">{item.name}</span>
                            <span
                              className={`shrink-0 text-note font-semibold ${
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
                <p className="mt-2 text-note text-ink-500">
                  {checkedText} 기준 · 방문 전 물품 상황이 달라질 수 있어요
                </p>
              </>
            ) : place.focusItem ? (
              <p className="mt-2 text-body text-ink-800">{place.focusItem}</p>
            ) : (
              <p className="mt-2 text-body text-ink-600">물품 정보를 확인 중이에요</p>
            )}

            {isStale && (
              <p className="mt-1.5 text-note font-semibold text-warn-700">
                최근 확인된 정보가 아니에요
              </p>
            )}
          </div>

          {/* 이용 안내 — 운영일·시간이 확인된 경우에만 */}
          {(place.openDays || place.openHours) && (
            <div className="mt-5">
              <h3 className="text-lead font-bold text-ink-950">이용 안내</h3>
              <p className="mt-1.5 text-body text-ink-800">
                {[place.openDays, place.openHours].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          {/* 위치 정보 */}
          <div className="mt-5">
            <h3 className="text-lead font-bold text-ink-950">위치 정보</h3>
            <dl className="mt-2 space-y-2 text-body">
              {place.address && (
                <div className="flex gap-3">
                  <dt className="w-14 shrink-0 text-ink-600">주소</dt>
                  <dd className="min-w-0 flex-1 text-ink-800">{place.address}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="w-14 shrink-0 text-ink-600">기관</dt>
                <dd className="min-w-0 flex-1 text-ink-800">
                  {place.name}{place.facilityType ? ` · ${place.facilityType}` : ''}
                </dd>
              </div>
              {place.phone && (
                <div className="flex gap-3">
                  <dt className="w-14 shrink-0 text-ink-600">전화</dt>
                  <dd className="min-w-0 flex-1">
                    <a
                      href={`tel:${place.phone}`}
                      className="text-brand-700 underline underline-offset-2 focus-ring"
                    >
                      {place.phone}
                    </a>
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* 도움 요청하기 — Tertiary CTA */}
          <button
            type="button"
            onClick={() => navigate('/help')}
            className="tap-md mt-5 flex w-full items-center justify-between rounded-control px-3 py-3 text-left transition-colors hover:bg-line-100 focus-ring"
          >
            <span className="text-body text-ink-600">직접 방문이 어려우신가요?</span>
            <span className="flex shrink-0 items-center gap-0.5 text-body font-bold text-brand-700">
              도움 요청하기
              <ChevronRight size={16} aria-hidden />
            </span>
          </button>

          {/* 가까운 다른 곳 보기 */}
          {showOtherPlaces && onShowOtherPlaces && (
            <button
              type="button"
              onClick={onShowOtherPlaces}
              className="tap-md mt-2 flex w-full items-center justify-center gap-1 text-body font-semibold text-brand-700 underline underline-offset-4 focus-ring"
            >
              가까운 다른 곳 보기
              <ChevronRight size={18} aria-hidden />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
