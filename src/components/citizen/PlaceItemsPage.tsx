import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Navigation, Search, X } from 'lucide-react';
import { ITEM_GROUP_LABEL, ITEM_GROUP_ORDER, STOCK_LEVEL_LABEL, type ItemGroup } from '../../data/citizenDirectory';
import { kakaoDirectionsUrl } from '../../lib/geo';
import { formatCheckedAt, todayLocal } from '../../utils/citizenFormat';
import { resolvePlaceStatus, type RankedPlace } from '../../utils/citizenPlace';
import Button from './ui/Button';
import { StatusChip } from './ui/StatusLine';

/** 검색·카테고리 칩은 품목이 이 개수 이상일 때만 보여준다 — 몇 개 안 되면 그냥 다 보인다. */
const SEARCH_THRESHOLD = 8;

interface Props {
  place: RankedPlace;
  onClose: () => void;
}

/**
 * "물품 확인" 전용 화면. 이 화면의 목적은 딱 하나 —
 * "내가 찾는 물품이 지금 이 거점에 있는가?" 다.
 *
 * 주소·기관·전화·도움요청 같은 행정 정보는 여기 섞지 않는다(그건 `/site/:id`의 몫).
 * 라우트가 아니라 `HomePage` 가 그리는 전체화면 오버레이라서, 뒤로가기를 눌러도
 * 지도가 다시 로드되지 않고 zoom·중심·선택 거점이 그대로 남는다 — `Drawer.tsx` 와
 * 같은 popstate 패턴을 쓴다.
 */
export default function PlaceItemsPage({ place, onClose }: Props) {
  const pushedHistory = useRef(false);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ItemGroup | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const status = resolvePlaceStatus(place);
  // focusItem 은 실 재고가 아니다 — 이 화면도 place.items 실재고만 "확인됨" 근거로 쓴다.
  const hasItemInfo = place.items.length > 0;
  const isStale = place.updatedAt.split('T')[0] < todayLocal();
  const checkedText = formatCheckedAt(place.updatedAt);
  const directionUrl = kakaoDirectionsUrl(place.name, { lat: place.lat, lng: place.lng });

  // 뒤로가기가 지도를 벗어나지 않고 이 화면만 닫게 만든다. Drawer.tsx 와 같은 패턴.
  useEffect(() => {
    window.history.pushState({ citizenPlaceItems: true }, '');
    pushedHistory.current = true;

    function onPop() {
      pushedHistory.current = false;
      onClose();
    }
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (pushedHistory.current) {
        pushedHistory.current = false;
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const showSearch = place.items.length >= SEARCH_THRESHOLD;
  const groups = useMemo(
    () => ITEM_GROUP_ORDER.filter((g) => place.items.some((i) => i.category === g)),
    [place.items],
  );
  const showGroups = showSearch && groups.length > 1;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q && !group) return place.items;
    return place.items.filter((item) => {
      if (group && item.category !== group) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [place.items, query, group]);

  const searchedButEmpty = query.trim().length > 0 && filtered.length === 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${place.displayName} 물품 확인`}
      className="fixed inset-0 z-50 flex flex-col bg-surface"
    >
      {/* 헤더 */}
      <header className="shrink-0 border-b border-line-100 px-2 pb-3 pt-[max(8px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="tap-md inline-flex items-center gap-1 rounded-control px-2 text-body font-semibold text-ink-600 transition-colors hover:text-brand-700 focus-ring"
        >
          <ArrowLeft size={20} aria-hidden />
          지도
        </button>
        <h1 className="mt-1 px-2 text-title font-bold text-ink-950">{place.displayName}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-2">
          <StatusChip status={status} />
          {hasItemInfo && (
            <span className={`text-note ${isStale ? 'font-semibold text-warn-700' : 'text-ink-500'}`}>
              {checkedText}
            </span>
          )}
        </div>
      </header>

      {/* 본문 */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4">
        <h2 className="text-lead font-bold text-ink-950">지금 이용할 수 있는 물품</h2>

        {!hasItemInfo ? (
          <p className="mt-3 text-body text-ink-600">아직 확인된 물품 정보가 없어요</p>
        ) : (
          <>
            {showSearch && (
              <div className="relative mt-3">
                <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="찾는 물품"
                  placeholder="찾는 물품을 검색해보세요"
                  className="tap-lg w-full rounded-control border border-line-200 bg-surface py-3 pl-10 pr-10 text-body text-ink-950 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    aria-label="검색어 지우기"
                    className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-600 hover:bg-line-100 focus-ring"
                  >
                    <X size={18} aria-hidden />
                  </button>
                )}
              </div>
            )}

            {showGroups && (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setGroup(null)}
                  aria-pressed={group === null}
                  className={`tap-md rounded-control border px-3 text-body font-semibold transition-colors focus-ring ${
                    group === null
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-line-200 bg-surface text-ink-800 hover:border-brand-300'
                  }`}
                >
                  전체
                </button>
                {groups.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup((prev) => (prev === g ? null : g))}
                    aria-pressed={group === g}
                    className={`tap-md rounded-control border px-3 text-body font-semibold transition-colors focus-ring ${
                      group === g
                        ? 'border-brand-600 bg-brand-50 text-brand-800'
                        : 'border-line-200 bg-surface text-ink-800 hover:border-brand-300'
                    }`}
                  >
                    {ITEM_GROUP_LABEL[g]}
                  </button>
                ))}
              </div>
            )}

            {searchedButEmpty ? (
              <div className="mt-8 text-center">
                <p className="text-body text-ink-800">지금 이곳에서는 확인되지 않아요</p>
                <div className="mx-auto mt-4 max-w-[280px]">
                  <Button to={`/items?q=${encodeURIComponent(query.trim())}`} variant="secondary" size="md">
                    이 물품이 있는 가까운 곳 찾기
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line-100">
                {filtered.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <span className="text-body text-ink-950">{item.name}</span>
                    <span
                      className={`shrink-0 text-note font-semibold ${
                        item.level === 'few' ? 'text-warn-700' : 'text-open-700'
                      }`}
                    >
                      {STOCK_LEVEL_LABEL[item.level] ?? '확인 필요'}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-6 text-note text-ink-500">
              물품은 방문 시점에 달라질 수 있어요.
              {!isStale && <><br />{checkedText.replace(/확인$/, '현장 확인')}</>}
            </p>
          </>
        )}
      </div>

      {/* 하단 고정 Primary CTA */}
      <div className="shrink-0 border-t border-line-100 px-5 py-3 pb-[max(16px,env(safe-area-inset-bottom))]">
        <Button href={directionUrl} icon={Navigation}>
          길찾기
        </Button>
      </div>
    </div>
  );
}
