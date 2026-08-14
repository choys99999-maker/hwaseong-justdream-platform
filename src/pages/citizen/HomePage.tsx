import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
  HandHeart,
  HeartHandshake,
  LifeBuoy,
  LocateFixed,
  MapPin,
  Menu,
  MessageSquare,
  Navigation,
  PackagePlus,
  Phone,
  Search,
  X,
} from 'lucide-react';
import CitizenMap from '../../components/citizen/CitizenMap';
import DongPicker from '../../components/citizen/DongPicker';
import {
  citizenSites,
  getSiteById,
  isCurrentlyOpen,
  calcDistanceKm,
  SITE_OVERALL_STATUS_LABELS,
  SITE_OVERALL_STATUS_COLORS,
  type CitizenSite,
} from '../../data/citizenData';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { AreaCentroid } from '../../data/mockSites';

// ── 헬퍼 ─────────────────────────────────────────────────────────

function kakaoNavUrl(site: CitizenSite) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(site.name)},${site.lat},${site.lng}`;
}

function findNearestSite(lat: number, lng: number): CitizenSite | null {
  return (
    citizenSites
      .map((s) => ({ site: s, d: calcDistanceKm(lat, lng, s.lat, s.lng) }))
      .sort((a, b) => a.d - b.d)[0]?.site ?? null
  );
}

// ── 홈 페이지 ────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const geo = useGeolocation();
  const pendingNearby = useRef(false);

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [focusSiteId, setFocusSiteId] = useState<string | null>(null);
  const [showDongPicker, setShowDongPicker] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);

  const selectedSite = selectedSiteId ? getSiteById(selectedSiteId) : null;

  // "내 주변 그냥드림 찾기" 버튼
  function handleFindNearby() {
    if (geo.status === 'granted' && geo.coords) {
      const nearest = findNearestSite(geo.coords.lat, geo.coords.lng);
      if (nearest) {
        setFocusSiteId(nearest.id);
        setSelectedSiteId(nearest.id);
      }
    } else {
      pendingNearby.current = true;
      geo.request();
    }
  }

  // 위치 권한 승인 후 자동으로 가장 가까운 거점 표시
  useEffect(() => {
    if (!pendingNearby.current) return;
    if (geo.status !== 'granted' || !geo.coords) return;
    pendingNearby.current = false;
    const nearest = findNearestSite(geo.coords.lat, geo.coords.lng);
    if (nearest) {
      setFocusSiteId(nearest.id);
      setSelectedSiteId(nearest.id);
    }
  }, [geo.status, geo.coords]);

  // 동네 선택 → 가장 가까운 거점으로 지도 이동
  const handleDongSelect = useCallback((area: AreaCentroid) => {
    setShowDongPicker(false);
    const nearest = findNearestSite(area.lat, area.lng);
    if (nearest) {
      setFocusSiteId(nearest.id);
      setSelectedSiteId(nearest.id);
    }
  }, []);

  const isLocating = geo.status === 'locating';

  return (
    <div className="relative h-full overflow-hidden bg-slate-100">

      {/* ── 전체 화면 지도 ───────────────────────────────────────── */}
      <CitizenMap
        sites={citizenSites}
        selectedSiteId={selectedSiteId}
        onSelectSite={setSelectedSiteId}
        focusSiteId={focusSiteId}
        hideControls
        className="absolute inset-0"
      />

      {/* ── 상단 바 ──────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          aria-label="전체 메뉴 열기"
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-gray-700 shadow-sm ring-1 ring-black/5 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Menu size={20} aria-hidden />
        </button>

        <div className="rounded-2xl bg-white/90 px-4 py-2 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
          <span className="text-[15px] font-black tracking-tight text-gray-900">그냥드림</span>
        </div>

        {/* 레이아웃 균형용 */}
        <div className="h-11 w-11" aria-hidden />
      </div>

      {/* ── 거점 바텀시트 (핀 클릭 시) ──────────────────────────── */}
      {selectedSite && (
        <SiteBottomSheet
          site={selectedSite}
          onClose={() => setSelectedSiteId(null)}
          onDetail={() => navigate(`/site/${selectedSite.id}`)}
        />
      )}

      {/* ── 메인 CTA 오버레이 (거점 미선택 시) ─────────────────── */}
      {!selectedSite && (
        <div className="absolute inset-x-0 bottom-0 z-20">
          {/* 지도와 패널 사이 그라디언트 */}
          <div
            className="pointer-events-none h-24 bg-gradient-to-t from-black/20 to-transparent"
            aria-hidden
          />

          {/* 하단 흰 패널 */}
          <div className="bg-white px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-4 shadow-[0_-1px_0_rgba(0,0,0,0.06)]">
            {/* 주 CTA — 내 주변 그냥드림 찾기 */}
            <button
              type="button"
              onClick={handleFindNearby}
              disabled={isLocating}
              className="flex min-h-[64px] w-full items-center justify-between rounded-2xl bg-blue-600 px-5 py-4 shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
              aria-label="내 주변 그냥드림 찾기"
            >
              <div className="flex items-center gap-3">
                <LocateFixed
                  size={22}
                  className={isLocating ? 'animate-pulse text-blue-300' : 'text-blue-200'}
                  aria-hidden
                />
                <div className="text-left">
                  <p className="text-[19px] font-black leading-tight text-white">
                    {isLocating ? '위치 확인 중…' : '내 주변 그냥드림 찾기'}
                  </p>
                  {geo.status === 'denied' && (
                    <p className="mt-0.5 text-[13px] text-blue-200">
                      위치 권한이 거부되었어요 · 동네로 찾기를 이용하세요
                    </p>
                  )}
                </div>
              </div>
              <ChevronRight size={20} className="shrink-0 text-blue-300" aria-hidden />
            </button>

            {/* 보조 CTA */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowDongPicker(true)}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-[15px] font-semibold text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <MapPin size={16} className="text-gray-400" aria-hidden />
                동네로 찾기
              </button>
              <button
                type="button"
                onClick={() => navigate('/help')}
                className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white text-[15px] font-semibold text-gray-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <HeartHandshake size={16} className="text-gray-400" aria-hidden />
                도움 요청
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 사이드바 ─────────────────────────────────────────────── */}
      {showDrawer && (
        <HomeDrawer onClose={() => setShowDrawer(false)} onNavigate={navigate} />
      )}

      {/* ── 동네 선택 ────────────────────────────────────────────── */}
      {showDongPicker && (
        <DongPicker onSelect={handleDongSelect} onClose={() => setShowDongPicker(false)} />
      )}
    </div>
  );
}

// ── 거점 바텀시트 ─────────────────────────────────────────────────

function SiteBottomSheet({
  site,
  onClose,
  onDetail,
}: {
  site: CitizenSite;
  onClose: () => void;
  onDetail: () => void;
}) {
  const open = isCurrentlyOpen(site);
  const availableItems = site.items.filter((i) => i.stockStatus !== 'none');
  const statusColor = SITE_OVERALL_STATUS_COLORS[site.overallStatus];

  return (
    <div className="absolute inset-x-0 bottom-0 z-20">
      <div className="rounded-t-3xl bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
        {/* 드래그 핸들 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-gray-200" aria-hidden />
        </div>

        <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
          {/* 헤더 */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[20px] font-bold leading-snug text-gray-900">
                {site.name}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span
                  className="text-[13px] font-semibold"
                  style={{ color: open ? '#16a34a' : '#9ca3af' }}
                >
                  {open ? '● 운영 중' : '○ 운영 종료'}
                </span>
                <span
                  className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                  style={{
                    background: statusColor + '20',
                    color: statusColor,
                  }}
                >
                  {SITE_OVERALL_STATUS_LABELS[site.overallStatus]}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={18} aria-hidden />
            </button>
          </div>

          {/* 물품 목록 */}
          {availableItems.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-[13px] font-semibold text-gray-400">지금 받을 수 있는 물품</p>
              <div className="flex flex-wrap gap-1.5">
                {availableItems.slice(0, 6).map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-gray-100 px-3 py-1 text-[14px] font-medium text-gray-700"
                  >
                    {item.name}
                  </span>
                ))}
                {availableItems.length > 6 && (
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-[14px] font-medium text-gray-500">
                    +{availableItems.length - 6}개 더
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[14px] text-gray-400">현재 확인된 물품이 없어요.</p>
          )}

          {/* 거리 */}
          {site.address && (
            <p className="mt-3 text-[13px] text-gray-400">{site.address}</p>
          )}

          {/* 액션 버튼 */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <a
              href={kakaoNavUrl(site)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-blue-600 text-white transition-colors hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Navigation size={18} aria-hidden />
              <span className="text-[13px] font-bold">길찾기</span>
            </a>
            <a
              href={`tel:${site.phone}`}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Phone size={18} className="text-gray-500" aria-hidden />
              <span className="text-[13px] font-bold">전화하기</span>
            </a>
            <button
              type="button"
              onClick={onDetail}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1.5 rounded-2xl border border-gray-200 bg-white text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <ChevronRight size={18} className="text-gray-500" aria-hidden />
              <span className="text-[13px] font-bold">상세보기</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 사이드바 드로어 ───────────────────────────────────────────────

type NavigateFn = (path: string) => void;

/** 아이콘은 기능이 서로 구분되게 고른다 — 색은 전부 Primary 하나로 통일한다. */
const DRAWER_ITEMS = [
  { icon: Search,        label: '물품 찾기',  desc: '필요한 물품이 있는 곳을 찾아요', path: '/items'    },
  { icon: PackagePlus,   label: '물품 기부',  desc: '사진 한 장으로 기부해요',       path: '/donate'   },
  { icon: LifeBuoy,      label: '도움 정보',  desc: '생활·주거·금융·일자리 도움',     path: '/info'     },
  { icon: MessageSquare, label: '말 남기기',  desc: '익명으로 의견을 남겨요',        path: '/feedback' },
  { icon: BookOpen,      label: '이용 안내',  desc: '처음이라면 여기부터',           path: '/guide'    },
] as const;

function HomeDrawer({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: NavigateFn;
}) {
  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function go(path: string) {
    onClose();
    onNavigate(path);
  }

  return (
    <>
      {/* 배경 딤 */}
      <div
        className="absolute inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* 드로어 패널 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="전체 메뉴"
        className="absolute inset-y-0 left-0 z-50 flex w-4/5 max-w-[320px] flex-col bg-white shadow-2xl"
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-gray-100 px-5 pb-4 pt-[max(20px,env(safe-area-inset-top))]">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600">
              화성특례시
            </p>
            <p className="mt-0.5 text-[22px] font-black text-gray-900">그냥드림</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* 메뉴 항목 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/*
            찾아가서드림은 "직접 올 수 없는 분" 을 위한 기능이라
            목록에 섞어두면 정작 필요한 사람이 못 찾는다 — 맨 위에 카드로 띄운다.
          */}
          <button
            type="button"
            onClick={() => go('/delivery')}
            className="mb-3 flex w-full items-start gap-3 rounded-2xl bg-blue-600 px-4 py-4 text-left shadow-md transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
          >
            <HandHeart size={22} className="mt-0.5 shrink-0 text-blue-200" aria-hidden />
            <span className="min-w-0">
              <span className="block text-[17px] font-black text-white">찾아가서드림</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-blue-100">
                못 오시면, 저희가 갑니다
              </span>
            </span>
          </button>

          {DRAWER_ITEMS.map(({ icon: Icon, label, desc, path }) => (
            <button
              key={path}
              type="button"
              onClick={() => go(path)}
              className="flex min-h-[64px] w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Icon size={21} className="shrink-0 text-blue-600" aria-hidden />
              <span className="min-w-0">
                <span className="block text-[17px] font-semibold text-gray-800">{label}</span>
                <span className="mt-0.5 block text-[13px] text-gray-400">{desc}</span>
              </span>
            </button>
          ))}
        </nav>

        {/* 전화 — 시각적으로 구분 */}
        <div className="border-t border-gray-100 px-5 py-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          <a
            href="tel:031-369-1000"
            className="flex min-h-[60px] items-center gap-4 rounded-xl bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Phone size={20} className="shrink-0 text-blue-600" aria-hidden />
            <div>
              <p className="text-[16px] font-bold text-blue-900">전화로 도움받기</p>
              <p className="text-[13px] text-blue-600">031-369-1000</p>
            </div>
          </a>
          <button
            type="button"
            onClick={() => window.open('/admin', '_blank')}
            className="mt-4 w-full text-center text-[12px] text-gray-300 hover:text-gray-400"
          >
            관리자 페이지
          </button>
        </div>
      </div>
    </>
  );
}
