import { useState, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, ArrowLeft, ArrowRight, X } from 'lucide-react';
import {
  searchSitesByItem,
  searchSitesByCategory,
  calcDistanceKm,
  formatDistance,
  CATEGORY_LABELS,
  CATEGORY_EMOJIS,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_COLORS,
  SITE_OVERALL_STATUS_COLORS,
  SITE_OVERALL_STATUS_LABELS,
  type ItemCategory,
  type CitizenSite,
  type CitizenItem,
} from '../../data/citizenData';

const CATEGORIES: ItemCategory[] = ['food', 'household', 'hygiene', 'clothing', 'other'];

interface ResultEntry {
  site: CitizenSite;
  matchedItems: CitizenItem[];
  distanceKm?: number;
}

export default function ItemSearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ItemCategory | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 내 위치 가져오기
  const handleGetLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const results: ResultEntry[] = useMemo(() => {
    let raw: Array<{ site: CitizenSite; matchedItems: CitizenItem[] }> = [];

    if (query.trim()) {
      raw = searchSitesByItem(query);
    } else if (selectedCategory) {
      raw = searchSitesByCategory(selectedCategory);
    } else {
      // 아무것도 선택 안 됨 → 빈 결과
      return [];
    }

    return raw
      .map((r) => ({
        ...r,
        distanceKm: userPos
          ? calcDistanceKm(userPos.lat, userPos.lng, r.site.lat, r.site.lng)
          : undefined,
      }))
      .sort((a, b) =>
        a.distanceKm !== undefined && b.distanceKm !== undefined
          ? a.distanceKm - b.distanceKm
          : 0,
      );
  }, [query, selectedCategory, userPos]);

  const handleCategoryClick = (cat: ItemCategory) => {
    setSelectedCategory(selectedCategory === cat ? null : cat);
    setQuery('');
    if (userPos === null) handleGetLocation();
  };

  const handleSearch = (val: string) => {
    setQuery(val);
    setSelectedCategory(null);
    if (userPos === null && val.trim()) handleGetLocation();
  };

  const handleShowOnMap = (siteId: string) => {
    navigate(`/map?site=${siteId}`);
  };

  const showResults = query.trim().length > 0 || selectedCategory !== null;

  return (
    <div className="min-h-full bg-slate-50 pb-10">
      {/* 상단 — 지도로 돌아가기 */}
      <div className="bg-white px-5 pt-[max(20px,env(safe-area-inset-top))]">
        <Link
          to="/"
          className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-gray-200 bg-white px-4 text-[16px] font-semibold text-gray-700 shadow-sm transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ArrowLeft size={18} className="text-blue-600" aria-hidden />
          지도로 돌아가기
        </Link>
        <h1 className="mt-4 text-[24px] font-bold leading-snug text-gray-900">물품 찾기</h1>
      </div>

      {/* 검색 입력 */}
      <div className="bg-white px-5 pt-4 pb-5 border-b border-slate-100 shadow-sm">
        <div className="relative">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="라면, 쌀, 생리대… 물품명을 입력하세요"
            className="w-full bg-slate-100 rounded-2xl pl-12 pr-10 py-4 text-base font-medium text-slate-900 placeholder-slate-400 border-2 border-transparent focus:border-blue-500 focus:bg-white outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-full bg-slate-300 text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <p className="text-sm font-bold text-slate-500 mt-4 mb-3">또는 종류를 선택하세요</p>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition-colors font-bold text-sm ${
                  active
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className="text-2xl">{CATEGORY_EMOJIS[cat]}</span>
                <span>{CATEGORY_LABELS[cat]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 결과 */}
      <div className="px-5 py-5">
        {!showResults && (
          <div className="text-center py-12">
            <Search size={48} className="text-slate-200 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-400">
              위에서 물품명을 검색하거나<br />종류를 선택해 보세요
            </p>
            <button
              type="button"
              onClick={handleGetLocation}
              className="mt-4 text-sm text-blue-600 font-bold underline"
            >
              {userPos ? '📍 내 위치 확인됨' : '내 위치 허용하면 가까운 순서로 보여드려요'}
            </button>
          </div>
        )}

        {showResults && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-lg font-black text-slate-700 mb-2">아직 재고가 없어요</p>
            <p className="text-sm text-slate-500">
              다른 물품을 검색하거나<br />나중에 다시 확인해 주세요.
            </p>
          </div>
        )}

        {showResults && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-black text-slate-900">
                {query.trim()
                  ? `"${query}" 이(가) 있는 곳`
                  : `${CATEGORY_EMOJIS[selectedCategory!]} ${CATEGORY_LABELS[selectedCategory!]}이 있는 곳`}
              </h2>
              <span className="text-sm text-slate-500">{results.length}곳</span>
            </div>

            <div className="space-y-3">
              {results.map(({ site, matchedItems, distanceKm }) => (
                <div
                  key={site.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                >
                  {/* 지점 헤더 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-base font-black text-slate-900">{site.name}</p>
                      {distanceKm !== undefined && (
                        <p className="text-sm text-blue-600 font-bold mt-0.5">
                          📍 내 위치에서 {formatDistance(distanceKm)}
                        </p>
                      )}
                    </div>
                    <span
                      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: SITE_OVERALL_STATUS_COLORS[site.overallStatus] }}
                    >
                      {SITE_OVERALL_STATUS_LABELS[site.overallStatus]}
                    </span>
                  </div>

                  {/* 해당 물품 */}
                  <div className="mt-3 space-y-2">
                    {matchedItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between">
                        <span className="text-base text-slate-800">
                          {item.emoji} {item.name}
                        </span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: STOCK_STATUS_COLORS[item.stockStatus] }}
                        >
                          {STOCK_STATUS_LABELS[item.stockStatus]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => handleShowOnMap(site.id)}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm py-3 rounded-xl transition-colors"
                    >
                      <MapPin size={16} />
                      지도에서 보기
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/site/${site.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-sm py-3 rounded-xl transition-colors"
                    >
                      상세 정보
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
