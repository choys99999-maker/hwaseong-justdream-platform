import { useEffect, useRef } from 'react';
import { List } from 'lucide-react';
import { distanceText, type RankedPlace } from '../../utils/citizenPlace';
import { markerViewOf } from './mapMarkers';
import type { StatusTone } from '../../utils/citizenPlace';

/**
 * 지도 아래 붙는 거점 카드 줄.
 *
 * 왜 필요한가 —
 * 지도 위 마커를 아무리 크게 만들어도, 마커를 "찾아서 누르는" 일 자체가 어려운 사용자가 있다.
 * (고령·저시력·한 손 조작·작은 화면) 그래서 지도와 **같은 거점 목록**을 늘 아래에 깔아 두고,
 * 마커를 못 누르겠으면 카드로, 카드가 답답하면 마커로 — 어느 쪽으로도 같은 선택을 하게 한다.
 *
 * 지도가 움직이면 여기 목록도 함께 바뀐다(`CitizenMap.onVisibleChange`). 즉 이 줄은
 * "지금 화면에 보이는 것" 의 목록이지, 별도의 검색 결과가 아니다.
 */

interface Props {
  /** 지금 지도 화면에 들어온 거점. 추천 순서가 이미 적용된 목록이 온다. */
  places: RankedPlace[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** 카드 줄로 부족할 때 여는 전체 목록. */
  onOpenList: () => void;
  onHeightChange: (height: number) => void;
  /** 하단 패널 위 어디에 뜰지(px). 패널 높이가 바뀌면 같이 올라간다. */
  bottom: number;
  /**
   * 지도가 "지금 이만큼 보인다" 를 실제로 알려주고 있는가.
   * 대체 지도(카카오 없음)에서는 알 수 없어서, 그때는 "이 화면에" 라고 말하지 않는다.
   */
  viewportKnown: boolean;
}

const TONE_CHIP: Record<StatusTone, string> = {
  open: 'bg-open-600',
  warn: 'bg-warn-600',
  unknown: 'bg-ink-600',
  closed: 'bg-ink-400',
};

const TONE_TEXT: Record<StatusTone, string> = {
  open: 'text-open-700',
  warn: 'text-warn-700',
  unknown: 'text-ink-600',
  closed: 'text-ink-600',
};

export default function PlaceCarousel({
  places,
  selectedId,
  onSelect,
  onOpenList,
  onHeightChange,
  bottom,
  viewportKnown,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const cardRefs = useRef(new Map<string, HTMLLIElement>());

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => onHeightChange(Math.round(el.getBoundingClientRect().height)));
    observer.observe(el);
    onHeightChange(Math.round(el.getBoundingClientRect().height));
    return () => observer.disconnect();
  }, [onHeightChange]);

  /**
   * 지도에서 마커를 누르면 그 카드가 스스로 앞으로 나온다.
   * 선택이 어디서 시작됐든 지도와 목록이 같은 곳을 가리켜야 "지금 이걸 보고 있다" 가 성립한다.
   */
  const placesKey = places.map((p) => p.id).join('|');
  useEffect(() => {
    if (!selectedId) return;
    const card = cardRefs.current.get(selectedId);
    if (!card || !scrollerRef.current) return;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedId, placesKey]);

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-x-0 z-20"
      style={{ bottom }}
      aria-label="지도에 보이는 거점"
    >
      <div className="pointer-events-auto flex items-center justify-between gap-2 px-3 pb-1.5">
        <span className="rounded-full bg-ink-950/80 px-3 py-1 text-note font-bold text-white backdrop-blur-sm">
          {places.length === 0
            ? '이 화면에는 거점이 없어요'
            : viewportKnown
              ? `이 화면에 거점 ${places.length}곳`
              : `거점 ${places.length}곳`}
        </span>
        <button
          type="button"
          onClick={onOpenList}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-3.5 py-2 text-note font-bold text-ink-950 shadow-raise ring-[1.5px] ring-ink-950/85 focus-ring"
        >
          <List size={17} aria-hidden />
          목록 보기
        </button>
      </div>

      {places.length === 0 ? (
        <p className="pointer-events-auto mx-3 rounded-card bg-surface px-4 py-3 text-note font-semibold text-ink-600 shadow-raise ring-1 ring-ink-950/10">
          지도를 움직이거나 축소해 보세요. 목록 보기로 전체 거점을 볼 수도 있어요.
        </p>
      ) : (
        <ul
          ref={scrollerRef}
          className="pointer-events-auto flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {places.map((place) => {
            const view = markerViewOf(place);
            const selected = place.id === selectedId;
            return (
              <li
                key={place.id}
                ref={(el) => {
                  if (el) cardRefs.current.set(place.id, el);
                  else cardRefs.current.delete(place.id);
                }}
                className="shrink-0 snap-center"
              >
                <button
                  type="button"
                  onClick={() => onSelect(place.id)}
                  aria-current={selected ? 'true' : undefined}
                  className={`flex w-[228px] items-center gap-3 rounded-card px-3 py-3 text-left shadow-raise transition-colors tap-lg ${
                    selected
                      ? 'bg-brand-600 ring-[2.5px] ring-brand-800'
                      : 'bg-surface ring-[1.5px] ring-ink-950/85'
                  } focus-ring`}
                >
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-body font-bold ${
                      selected ? 'bg-surface text-brand-700' : `text-white ${TONE_CHIP[view.tone]}`
                    }`}
                  >
                    {view.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-body font-bold ${selected ? 'text-white' : 'text-ink-950'}`}
                    >
                      {place.displayName}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`text-note font-bold ${selected ? 'text-white/90' : TONE_TEXT[view.tone]}`}
                      >
                        {view.statusText}
                      </span>
                      {place.distanceKm !== null && (
                        <span className={`text-note font-semibold ${selected ? 'text-white/80' : 'text-ink-600'}`}>
                          · {distanceText(place.distanceKm)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
