import { useNavigate } from 'react-router-dom';
import { MapPin, Search, HelpCircle, Info, MessageSquare, Phone, BookOpen } from 'lucide-react';
import hwaseongLogo from '../../assets/hwaseong-signature.png';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col min-h-full bg-white">
      {/* 헤더 영역 */}
      <div className="bg-teal-600 px-6 pt-10 pb-10">
        <img src={hwaseongLogo} alt="화성특례시" className="h-8 brightness-0 invert mb-4" />
        <h1 className="text-3xl font-black text-white leading-tight">그냥드림</h1>
        <p className="text-teal-100 text-lg mt-2 leading-snug">
          필요한 물품을<br />가까운 곳에서 찾아보세요.
        </p>
      </div>

      {/* 메인 버튼 영역 */}
      <div className="flex-1 px-5 py-6 flex flex-col gap-4">

        {/* 가장 큰 메인 버튼 */}
        <button
          type="button"
          onClick={() => navigate('/map')}
          className="w-full flex items-center gap-4 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-3xl px-6 py-6 shadow-lg transition-colors"
        >
          <div className="flex items-center justify-center w-14 h-14 bg-teal-500 rounded-2xl flex-shrink-0">
            <MapPin size={30} strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <p className="text-xl font-black leading-tight">내 주변 그냥드림 찾기</p>
            <p className="text-teal-100 text-sm mt-1">지금 있는 곳에서 가까운 그냥드림을 찾아요</p>
          </div>
        </button>

        {/* 2단 버튼 */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/items')}
            className="flex flex-col items-center gap-3 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded-3xl px-4 py-5 transition-colors border-2 border-blue-100"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-blue-600 rounded-2xl text-white">
              <Search size={24} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-900">물품 찾기</p>
              <p className="text-xs text-slate-500 mt-0.5">필요한 물품이 어디에 있는지 찾아요</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/help')}
            className="flex flex-col items-center gap-3 bg-orange-50 hover:bg-orange-100 active:bg-orange-200 rounded-3xl px-4 py-5 transition-colors border-2 border-orange-100"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-orange-500 rounded-2xl text-white">
              <HelpCircle size={24} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-900">도움 요청</p>
              <p className="text-xs text-slate-500 mt-0.5">필요한 도움을 요청해요</p>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate('/info')}
            className="flex flex-col items-center gap-3 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 rounded-3xl px-4 py-5 transition-colors border-2 border-purple-100"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-purple-600 rounded-2xl text-white">
              <Info size={24} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-900">도움 정보</p>
              <p className="text-xs text-slate-500 mt-0.5">생활·주거·금융·노동 도움을 찾아요</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/feedback')}
            className="flex flex-col items-center gap-3 bg-green-50 hover:bg-green-100 active:bg-green-200 rounded-3xl px-4 py-5 transition-colors border-2 border-green-100"
          >
            <div className="flex items-center justify-center w-12 h-12 bg-green-600 rounded-2xl text-white">
              <MessageSquare size={24} strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="text-base font-black text-slate-900">말 남기기</p>
              <p className="text-xs text-slate-500 mt-0.5">익명으로 의견을 남겨요</p>
            </div>
          </button>
        </div>

        {/* 하단 작은 버튼 */}
        <div className="flex gap-3 mt-2">
          <a
            href="tel:031-369-1000"
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-2xl py-4 transition-colors border border-slate-200"
          >
            <Phone size={18} className="text-slate-600" />
            <span className="text-sm font-bold text-slate-700">전화로 도움받기</span>
          </a>
          <button
            type="button"
            onClick={() => navigate('/guide')}
            className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-2xl py-4 transition-colors border border-slate-200"
          >
            <BookOpen size={18} className="text-slate-600" />
            <span className="text-sm font-bold text-slate-700">이용 안내</span>
          </button>
        </div>
      </div>

      {/* 최하단 */}
      <div className="px-5 pb-8 pt-2 text-center">
        <p className="text-xs text-slate-400">화성특례시 복지정책과 · 화성형 그냥드림 플랫폼</p>
        <button
          type="button"
          onClick={() => window.open('/admin', '_blank')}
          className="mt-1 text-xs text-slate-300 hover:text-slate-400 underline"
        >
          관리자 페이지
        </button>
      </div>
    </div>
  );
}
