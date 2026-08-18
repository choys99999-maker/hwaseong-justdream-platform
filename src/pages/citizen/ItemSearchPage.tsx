import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import AppHeader from '../../components/citizen/ui/AppHeader';
import { EmptyState } from '../../components/citizen/ui/Feedback';
import { StatusChip } from '../../components/citizen/ui/StatusLine';
import { useCitizenPlaces } from '../../hooks/useCitizenPlaces';
import { useGeolocation } from '../../hooks/useGeolocation';
import { ITEM_GROUP_LABEL, ITEM_GROUP_ORDER, type ItemGroup } from '../../data/citizenDirectory';
import { distanceText, findPlacesWithItem, resolvePlaceStatus } from '../../utils/citizenPlace';

/**
 * 물품 찾기.
 *
 * 검색 화면도 결국 "어디로 가면 되는가" 를 답해야 한다. 그래서 결과는 물품 목록이 아니라
 * **거점 목록**이고, 순서는 홈의 추천과 똑같은 규칙(열려 있는지 → 물품 → 거리)을 쓴다.
 * 분류는 실제 데이터에 있는 세 가지뿐이다 — 눌러도 0건인 분류는 만들지 않는다.
 */
export default function ItemSearchPage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const { places } = useCitizenPlaces();
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();

  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [group, setGroup] = useState<ItemGroup | null>(null);

  const origin = geo.status === 'granted' ? geo.coords : null;
  const results = useMemo(
    () => findPlacesWithItem(places, origin, { query, group: group ?? undefined }),
    [places, origin, query, group],
  );

  const searching = query.trim().length > 0 || group !== null;

  /** 검색을 시작할 때 한 번만 위치를 묻는다. 화면에 들어오자마자 권한 창을 띄우지 않는다. */
  function ensureLocation() {
    if (geo.status === 'idle') geo.request();
  }

  // ?q= 로 검색어를 채워 들어온 경우(다른 거점의 "이 물품이 있는 가까운 곳 찾기")에도
  // 입력했을 때와 같이 위치를 한 번 묻는다.
  useEffect(() => {
    if (searchParams.get('q')?.trim()) ensureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleQuery(value: string) {
    setQuery(value);
    if (value.trim()) {
      setGroup(null);
      ensureLocation();
    }
  }

  function handleGroup(next: ItemGroup) {
    setGroup((prev) => (prev === next ? null : next));
    setQuery('');
    ensureLocation();
  }

  return (
    <>
      <AppHeader title="물품 찾기" />

      <div className="px-5 pt-5">
        <div className="relative">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" aria-hidden />
          {/*
            type="search" 를 쓰면 브라우저 기본 지우기 버튼이 따라붙어 X 가 두 개 보인다.
            지우기는 48px 터치 목표를 갖춘 우리 버튼 하나로만 제공한다.
          */}
          <input
            ref={inputRef}
            type="text"
            inputMode="search"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            aria-label="찾는 물품"
            placeholder="라면, 쌀, 분유…"
            className="tap-lg w-full rounded-control border border-line-200 bg-surface py-3 pl-12 pr-12 text-body text-ink-950 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-600 focus:ring-4 focus:ring-brand-600/15"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="검색어 지우기"
              className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-ink-600 hover:bg-line-100 focus-ring"
            >
              <X size={20} aria-hidden />
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {ITEM_GROUP_ORDER.map((key) => {
            const active = group === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => handleGroup(key)}
                aria-pressed={active}
                className={`tap-md rounded-control border px-2 text-body font-semibold transition-colors focus-ring ${
                  active
                    ? 'border-brand-600 bg-brand-50 text-brand-800'
                    : 'border-line-200 bg-surface text-ink-800 hover:border-brand-300'
                }`}
              >
                {ITEM_GROUP_LABEL[key]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 pb-[max(32px,env(safe-area-inset-bottom))] pt-5">
        {!searching && <EmptyState title="찾고 싶은 물품을 입력해 주세요" />}

        {searching && results.length === 0 && (
          <EmptyState title="지금은 확인된 곳이 없어요">
            <p className="text-body text-ink-600">다른 물품으로 찾아보시거나 잠시 뒤에 다시 봐 주세요.</p>
          </EmptyState>
        )}

        {searching && results.length > 0 && (
          <>
            <p className="text-note text-ink-600">{results.length}곳에서 확인됐어요</p>
            <ul className="mt-3 space-y-2">
              {results.map(({ place, matched }) => {
                const status = resolvePlaceStatus(place);
                return (
                  <li key={place.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/site/${place.id}`)}
                      className="flex w-full items-center gap-3 rounded-card border border-line-200 bg-surface px-4 py-3.5 text-left transition-colors hover:border-brand-300 focus-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-lead font-bold text-ink-950">
                          {place.displayName}
                        </span>
                        <span className="mt-1 block text-body text-ink-800">
                          {matched.map((m) => m.name).join(' · ')}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <StatusChip status={status} />
                          {place.distanceKm !== null && (
                            <span className="text-note font-semibold text-ink-800">
                              {distanceText(place.distanceKm)}
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRight size={20} className="shrink-0 text-ink-400" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
