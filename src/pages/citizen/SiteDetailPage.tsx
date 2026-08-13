import { useParams, useNavigate } from 'react-router-dom';
import { Phone, Navigation, MapPin, Clock } from 'lucide-react';
import {
  getSiteById,
  isCurrentlyOpen,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_COLORS,
  SITE_OVERALL_STATUS_LABELS,
  SITE_OVERALL_STATUS_COLORS,
  SITE_OVERALL_STATUS_BG,
} from '../../data/citizenData';

export default function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const site = getSiteById(siteId ?? '');

  if (!site) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
        <MapPin size={48} className="text-slate-300" />
        <p className="text-lg font-bold text-slate-700">지점을 찾을 수 없어요</p>
        <button
          type="button"
          onClick={() => navigate('/map')}
          className="bg-teal-600 text-white font-bold px-6 py-3 rounded-2xl text-base"
        >
          지도로 돌아가기
        </button>
      </div>
    );
  }

  const open = isCurrentlyOpen(site);

  const handleNavigate = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(site.name)},${site.lat},${site.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCall = () => {
    if (site.phone) window.location.href = `tel:${site.phone}`;
  };

  const handleShowOnMap = () => {
    navigate(`/map?site=${site.id}`);
  };

  return (
    <div className="min-h-full bg-slate-50 pb-10">
      {/* 헤더 카드 */}
      <div className="bg-white px-5 pt-5 pb-6 border-b border-slate-100 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <span className="inline-block text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded mb-2">
              {site.facilityType}
            </span>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">{site.name}</h1>
          </div>
          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold text-white flex-shrink-0 mt-1"
            style={{ backgroundColor: SITE_OVERALL_STATUS_COLORS[site.overallStatus] }}
          >
            {SITE_OVERALL_STATUS_LABELS[site.overallStatus]}
          </span>
        </div>

        {/* 운영 상태 */}
        <div className={`mt-4 flex items-center gap-2 px-4 py-3 rounded-2xl ${open ? 'bg-green-50' : 'bg-slate-100'}`}>
          <span className={`w-3 h-3 rounded-full flex-shrink-0 ${open ? 'bg-green-500' : 'bg-slate-400'}`} />
          <span className={`text-base font-black ${open ? 'text-green-700' : 'text-slate-500'}`}>
            {open ? '지금 이용할 수 있어요' : '지금은 운영 시간이 아니에요'}
          </span>
        </div>
      </div>

      <div className="px-5 py-5 space-y-4">
        {/* 기본 정보 */}
        <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm border border-slate-100">
          <h2 className="text-base font-black text-slate-900">기본 정보</h2>

          <div className="flex items-start gap-3">
            <MapPin size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 mb-0.5">주소</p>
              <p className="text-base font-medium text-slate-800">{site.address}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Clock size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-slate-500 mb-0.5">운영시간</p>
              <p className="text-base font-medium text-slate-800">
                {site.operatingDays} {site.operatingHours}
              </p>
            </div>
          </div>

          {site.phone && (
            <div className="flex items-start gap-3">
              <Phone size={18} className="text-teal-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-slate-500 mb-0.5">전화번호</p>
                <p className="text-base font-medium text-slate-800">{site.phone}</p>
              </div>
            </div>
          )}
        </div>

        {/* 재고 현황 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <h2 className="text-base font-black text-slate-900 mb-3">받을 수 있는 물품</h2>

          {site.items.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">
              현재 등록된 물품 정보가 없어요
            </p>
          ) : (
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{ backgroundColor: SITE_OVERALL_STATUS_BG[site.overallStatus] }}
            >
              {site.items.map((item) => {
                const label = STOCK_STATUS_LABELS[item.stockStatus];
                const color = STOCK_STATUS_COLORS[item.stockStatus];
                return (
                  <div key={item.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.emoji}</span>
                      <span className="text-base font-bold text-slate-900">{item.name}</span>
                    </div>
                    <span
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-black text-white"
                      style={{ backgroundColor: color }}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-slate-400 mt-3 text-right">
            마지막 업데이트: {site.lastUpdated.replace('T', ' ').slice(0, 16)}
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleNavigate}
            className="w-full flex items-center justify-center gap-3 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-black text-lg py-5 rounded-2xl transition-colors shadow"
          >
            <Navigation size={22} />
            여기로 가는 길
          </button>

          {site.phone && (
            <button
              type="button"
              onClick={handleCall}
              className="w-full flex items-center justify-center gap-3 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white font-black text-lg py-5 rounded-2xl transition-colors shadow"
            >
              <Phone size={22} />
              전화하기 ({site.phone})
            </button>
          )}

          <button
            type="button"
            onClick={handleShowOnMap}
            className="w-full flex items-center justify-center gap-3 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-base py-4 rounded-2xl transition-colors border border-slate-200"
          >
            <MapPin size={20} />
            지도에서 보기
          </button>
        </div>
      </div>
    </div>
  );
}
