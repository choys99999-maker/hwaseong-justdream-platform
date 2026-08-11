import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { OperationSite } from '../../types';
import { REGION_NAMES } from '../../data/regionMeta';
import { siteAreaOf } from '../../data/mockSites';

interface MapSearchProps {
  sites: OperationSite[];
  onSelectSite: (site: OperationSite) => void;
  onClearSearch?: () => void;
  className?: string;
}

interface SearchEntry {
  site: OperationSite;
  area: string | null;
}

const MAX_RESULTS = 8;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * 지도 위 floating 검색창. 기관명·읍면동·구역명으로 로컬 거점 데이터(mockSites)에서만 찾는다.
 * 결과 선택은 marker 클릭과 동일한 onSelectSite 콜백을 타 selection source of truth 를 하나로 유지한다.
 */
export default function MapSearch({ sites, onSelectSite, onClearSearch, className }: MapSearchProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const entries = useMemo<SearchEntry[]>(
    () => sites.map((site) => ({ site, area: siteAreaOf(site.id) })),
    [sites],
  );

  const results = useMemo<SearchEntry[]>(() => {
    const q = normalize(query);
    if (!q) return [];
    return entries
      .filter(({ site, area }) => {
        const haystacks = [site.name, site.displayName, site.address ?? '', area ?? '', REGION_NAMES[site.district]];
        return haystacks.some((value) => normalize(value).includes(q));
      })
      .slice(0, MAX_RESULTS);
  }, [entries, query]);

  useEffect(() => {
    setActiveIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [isOpen]);

  const commitSelection = (entry: SearchEntry) => {
    onSelectSite(entry.site);
    setQuery(entry.site.displayName);
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      // 드롭다운이 열려 있을 때는 여기서 닫기만 하고, 상위(전체화면 Esc-닫기)로는 전파하지 않는다.
      if (isOpen) event.stopPropagation();
      setIsOpen(false);
      return;
    }
    if (!isOpen || results.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = results[activeIndex] ?? results[0];
      if (target) commitSelection(target);
    }
  };

  const showDropdown = isOpen && query.trim().length > 0;

  return (
    <div ref={containerRef} className={className ?? 'relative w-56 shrink-0'}>
      <div className="flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/40">
        <Search size={14} className="shrink-0 text-slate-400" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            const value = e.target.value;
            setQuery(value);
            setIsOpen(true);
            if (value === '') onClearSearch?.();
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="거점명 · 읍면동 · 복지관 검색"
          aria-label="지도 거점 검색"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls="map-search-listbox"
          autoComplete="off"
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setIsOpen(false);
              onClearSearch?.();
              inputRef.current?.focus();
            }}
            aria-label="검색어 지우기"
            className="shrink-0 rounded p-0.5 text-slate-300 hover:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {showDropdown && (
        <ul
          id="map-search-listbox"
          role="listbox"
          aria-label="검색 결과"
          className="absolute left-0 top-[calc(100%+4px)] z-20 max-h-72 w-full min-w-[240px] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-md"
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-400">일치하는 거점이 없습니다.</li>
          ) : (
            results.map((entry, i) => (
              <li key={entry.site.id} role="option" aria-selected={i === activeIndex}>
                <button
                  type="button"
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => commitSelection(entry)}
                  className={`flex w-full flex-col items-start gap-0.5 px-3 py-1.5 text-left ${
                    i === activeIndex ? 'bg-teal-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="text-xs font-medium text-slate-800">{entry.site.name}</span>
                  <span className="text-[11px] text-slate-400">
                    {REGION_NAMES[entry.site.district]}
                    {entry.area ? ` · ${entry.area}` : ''} · {entry.site.facilityType}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
