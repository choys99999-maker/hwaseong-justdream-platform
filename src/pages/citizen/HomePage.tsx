import { useNavigate } from 'react-router-dom';
import { BookOpen, ChevronRight, HeartHandshake, Home, MapPin, MessageSquare, Phone, Search } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface SecondaryItem {
  path: string;
  icon: LucideIcon;
  title: string;
  desc: string;
}

const SECONDARY_ITEMS: SecondaryItem[] = [
  { path: '/items',    icon: Search,         title: '물품 찾기',  desc: '필요한 물품이 있는 곳을 찾아요' },
  { path: '/help',     icon: HeartHandshake, title: '도움 요청',  desc: '필요한 도움을 요청해요'         },
  { path: '/info',     icon: Home,           title: '도움 정보',  desc: '생활에 필요한 도움을 찾아요'    },
  { path: '/feedback', icon: MessageSquare,  title: '말 남기기',  desc: '익명으로 의견을 남겨요'         },
];

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-full flex-col bg-slate-50">

      {/* ── 브랜드 헤더 ─────────────────────────────────────────────── */}
      <header className="px-6 pb-5 pt-10">
        <p className="text-[13px] font-semibold uppercase tracking-widest text-blue-600">
          화성특례시
        </p>
        <h1 className="mt-1 text-[28px] font-black leading-tight tracking-tight text-gray-900">
          그냥드림
        </h1>
        <p className="mt-1.5 text-[16px] leading-snug text-gray-500">
          필요한 물품을 가까운 곳에서 찾아보세요.
        </p>
      </header>

      {/* ── 메인 콘텐츠 ─────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col gap-3 px-5 pb-6">

        {/* 메인 CTA — 내 주변 그냥드림 찾기 */}
        <button
          type="button"
          onClick={() => navigate('/map')}
          className="group flex w-full flex-col rounded-2xl bg-blue-600 px-6 py-6 text-left shadow-md transition-colors hover:bg-blue-700 active:bg-blue-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
          aria-label="내 주변 그냥드림 찾기 — 지도 열기"
        >
          <MapPin
            size={26}
            className="mb-3 text-blue-200"
            aria-hidden
          />
          <p className="text-[26px] font-black leading-tight text-white">
            내 주변 그냥드림 찾기
          </p>
          <div className="mt-2 flex w-full items-end justify-between">
            <p className="text-[16px] text-blue-200">가까운 곳을 찾아볼게요</p>
            <ChevronRight
              size={22}
              className="shrink-0 text-blue-300 transition-transform group-hover:translate-x-0.5"
              aria-hidden
            />
          </div>
        </button>

        {/* 보조 기능 2×2 그리드 */}
        <div className="grid grid-cols-2 gap-3">
          {SECONDARY_ITEMS.map(({ path, icon: Icon, title, desc }) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="flex min-h-[120px] flex-col items-start justify-between rounded-2xl bg-white p-5 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
            >
              <Icon size={22} className="text-blue-600" aria-hidden />
              <div className="mt-3">
                <p className="text-[18px] font-bold leading-snug text-gray-900">{title}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-gray-400">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {/* 전화 도움 — 보조 기능보다 살짝 더 눈에 띄게 */}
        <a
          href="tel:031-369-1000"
          className="flex min-h-[60px] w-full items-center justify-between rounded-xl bg-white px-5 py-4 shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/40"
          aria-label="031-369-1000 으로 전화하기"
        >
          <div className="flex items-center gap-3">
            <Phone size={20} className="text-blue-600" aria-hidden />
            <span className="text-[16px] font-bold text-gray-800">전화로 도움받기</span>
          </div>
          <span className="text-[14px] text-gray-400">031-369-1000</span>
        </a>

        {/* 이용 안내 */}
        <button
          type="button"
          onClick={() => navigate('/guide')}
          className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[14px] font-medium text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <BookOpen size={15} aria-hidden />
          이용 안내
        </button>
      </main>

      {/* ── 최하단 ──────────────────────────────────────────────────── */}
      <footer className="px-5 pb-8 pt-2 text-center">
        <p className="text-[12px] text-gray-300">
          화성특례시 복지정책과 · 화성형 그냥드림 플랫폼
        </p>
        <button
          type="button"
          onClick={() => window.open('/admin', '_blank')}
          className="mt-1 text-[12px] text-gray-300 underline hover:text-gray-400"
        >
          관리자 페이지
        </button>
      </footer>
    </div>
  );
}
