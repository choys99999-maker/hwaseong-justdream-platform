import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Phone, Navigation, ChevronDown, X, ArrowRight } from 'lucide-react';
import CitizenMap from '../../components/citizen/CitizenMap';
import {
  citizenSites,
  getSiteById,
  isCurrentlyOpen,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_COLORS,
  SITE_OVERALL_STATUS_LABELS,
  SITE_OVERALL_STATUS_COLORS,
  SITE_OVERALL_STATUS_BG,
  type CitizenSite,
} from '../../data/citizenData';

function StockBadge({ status }: { status: string }) {
  const label = STOCK_STATUS_LABELS[status as keyof typeof STOCK_STATUS_LABELS] ?? status;
  const color = STOCK_STATUS_COLORS[status as keyof typeof STOCK_STATUS_COLORS] ?? '#9ca3af';
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

interface BottomSheetProps {
  site: CitizenSite;
  onClose: () => void;
  onDetail: () => void;
}

function BottomSheet({ site, onClose, onDetail }: BottomSheetProps) {
  const open = isCurrentlyOpen(site);

  const handleNavigate = () => {
    const url = `https://map.kakao.com/link/to/${encodeURIComponent(site.name)},${site.lat},${site.lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCall = () => {
    if (site.phone) window.location.href = `tel:${site.phone}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl border-t border-slate-100 pb-safe" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
      {/* 드래그 핸들 */}
      <div className="flex justify-center pt-3 pb-1">
        <div className="w-10 h-1 rounded-full bg-slate-200" />
      </div>

      {/* 닫기 */}
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="absolute top-3 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-colors"
      >
        <X size={18} />
      </button>

      <div className="px-5 pb-6 pt-2">
        {/* 지점명 + 상태 */}
        <div className="flex items-start gap-3 mb-1">
          <div className="flex-1">
            <h2 className="text-xl font-black text-slate-900 leading-tight">{site.name}</h2>
            <p className="text-sm text-slate-500 mt-0.5">{site.address}</p>
          </div>
        </div>

        {/* 운영 상태 태그 */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
              open
                ? 'bg-green-100 text-green-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${open ? 'bg-green-500' : 'bg-slate-400'}`} />
            {open ? '지금 운영 중' : '운영 시간 외'}
          </span>
          <span
            className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold text-white"
            style={{
              backgroundColor: SITE_OVERALL_STATUS_COLORS[site.overallStatus],
            }}
          >
            {SITE_OVERALL_STATUS_LABELS[site.overallStatus]}
          </span>
        </div>

        <div className="flex items-center gap-2 mt-2 text-sm text-slate-500">
          <span>운영시간</span>
          <span className="font-medium text-slate-700">{site.operatingDays} {site.operatingHours}</span>
        </div>

        {/* 재고 목록 */}
        <div className="mt-4">
          <h3 className="text-base font-black text-slate-900 mb-2">지금 받을 수 있는 물품</h3>
          <div
            className="rounded-2xl p-3"
            style={{ backgroundColor: SITE_OVERALL_STATUS_BG[site.overallStatus] }}
          >
            {site.items.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-2">현재 등록된 물품 정보가 없어요</p>
            ) : (
              <div className="space-y-2.5">
                {site.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-base font-medium text-slate-800">
                      {item.emoji} {item.name}
                    </span>
                    <StockBadge status={item.stockStatus} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-2 text-right">
            마지막 업데이트: {site.lastUpdated.replace('T', ' ').slice(0, 16)}
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <button
            type="button"
            onClick={handleNavigate}
            className="flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white font-black text-base py-4 rounded-2xl transition-colors shadow"
          >
            <Navigation size={20} />
            길찾기
          </button>
          <button
            type="button"
            onClick={handleCall}
            disabled={!site.phone}
            className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 active:bg-slate-900 text-white font-black text-base py-4 rounded-2xl transition-colors shadow disabled:opacity-40"
          >
            <Phone size={20} />
            전화하기
          </button>
        </div>
        <button
          type="button"
          onClick={onDetail}
          className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 font-bold text-base py-4 rounded-2xl transition-colors mt-3"
        >
          상세보기
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default function MapPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const siteParam = searchParams.get('site');

  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(siteParam);
  const [focusSiteId, setFocusSiteId] = useState<string | null>(siteParam);

  // URL의 site 파라미터로 초기 포커스
  useEffect(() => {
    if (siteParam) {
      setSelectedSiteId(siteParam);
      setFocusSiteId(siteParam);
    }
  }, [siteParam]);

  const selectedSite = selectedSiteId ? getSiteById(selectedSiteId) : null;

  const handleSelectSite = useCallback((siteId: string | null) => {
    setSelectedSiteId(siteId);
    if (siteId) setFocusSiteId(siteId);
  }, []);

  const handleClose = useCallback(() => {
    setSelectedSiteId(null);
  }, []);

  const handleDetail = useCallback(() => {
    if (selectedSiteId) navigate(`/site/${selectedSiteId}`);
  }, [selectedSiteId, navigate]);

  return (
    <div className="relative flex flex-col h-full">
      <CitizenMap
        sites={citizenSites}
        selectedSiteId={selectedSiteId}
        onSelectSite={handleSelectSite}
        focusSiteId={focusSiteId}
        className="flex-1"
      />

      {/* 하단 안내 (지점 미선택 시) */}
      {!selectedSite && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 bg-slate-800/90 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg flex items-center gap-2 pointer-events-none whitespace-nowrap">
          <ChevronDown size={16} />
          핀을 눌러 재고를 확인하세요
        </div>
      )}

      {/* 바텀시트 */}
      {selectedSite && (
        <BottomSheet
          site={selectedSite}
          onClose={handleClose}
          onDetail={handleDetail}
        />
      )}
    </div>
  );
}
