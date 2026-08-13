import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, LocateFixed, MapPin, Navigation, Phone, PlayCircle, Type } from 'lucide-react';
import { useGeolocation } from '../../hooks/useGeolocation';
import { useCitizenSites } from '../../hooks/useCitizenSites';
import {
  AVAILABILITY_LABEL,
  rankCitizenSites,
  recommendCitizenSites,
  recommendReason,
  type RankedCitizenSite,
} from '../../utils/citizenSite';
import { formatCheckedAt, todayLocal } from '../../utils/citizenFormat';
import { formatDistance, kakaoDirectionsUrl, type LatLng } from '../../lib/geo';
import type { AreaCentroid } from '../../data/mockSites';
import BigButton from '../../components/citizen/BigButton';
import AvailabilityBadge, { AvailabilityIcon } from '../../components/citizen/AvailabilityBadge';
import DongPicker from '../../components/citizen/DongPicker';
import CitizenSheet from '../../components/citizen/CitizenSheet';
import CitizenDiscoveryMap from '../../components/citizen/CitizenDiscoveryMap';
import HelpRequestForm from '../../components/citizen/HelpRequestForm';
import DemoRoleSheet from '../../components/demo/DemoRoleSheet';

type Stage = 'intro' | 'recommend' | 'detail' | 'help';

/** 단계별 시트 최대 높이(화면 비율). 지도와의 공간 관계가 어느 단계에서도 끊기지 않게 한다. */
const SHEET_RATIO: Record<Stage, number> = {
  intro: 0.46,
  recommend: 0.64,
  detail: 0.76,
  help: 0.88,
};

/**
 * 시민 첫 화면.
 *
 * 화성시 전체 지도를 무대로 깔고, 그 위 시트 한 장에서 모든 단계가 바뀐다.
 * 시민이 25곳을 비교하지 않는다 — 버튼 하나를 누르면 서비스가 갈 곳 한 곳을 정해서 보여준다.
 *   첫 화면 → [내 주변에서 찾기] → 지도 줌인 + ①②③ → "지금은 여기가 가장 좋아요" → 길찾기
 *   첫 화면 → 직접 가기 어려움 → 도움 요청
 */
export default function CitizenHomePage() {
  const geo = useGeolocation();
  const { sites } = useCitizenSites();

  const [stage, setStage] = useState<Stage>('intro');
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const [originLabel, setOriginLabel] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [spotlightToken, setSpotlightToken] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(320);
  const [showDongPicker, setShowDongPicker] = useState(false);
  const [showDemoSheet, setShowDemoSheet] = useState(false);

  const ranked = useMemo(() => rankCitizenSites(sites, origin), [sites, origin]);
  const recommended = useMemo(() => recommendCitizenSites(sites, origin, 3), [sites, origin]);
  const highlightIds = useMemo(
    () => (stage === 'intro' || origin === null ? [] : recommended.map((s) => s.id)),
    [stage, origin, recommended],
  );
  const selected = selectedId ? ranked.find((s) => s.id === selectedId) ?? null : null;

  // 위치 허용이 떨어지는 즉시 추천 단계로 넘어간다 — 사용자가 한 번 더 누를 이유가 없다.
  useEffect(() => {
    if (geo.status !== 'granted' || !geo.coords) return;
    setOrigin(geo.coords);
    setOriginLabel('내 위치 기준');
    setStage('recommend');
    setSelectedId(null);
    setFocusToken((t) => t + 1);
  }, [geo.status, geo.coords]);

  const handleSheetHeight = useCallback((height: number) => setSheetHeight(height), []);

  function handleSelectDong(area: AreaCentroid) {
    setOrigin({ lat: area.lat, lng: area.lng });
    setOriginLabel(`${area.area} 기준`);
    setStage('recommend');
    setSelectedId(null);
    setShowDongPicker(false);
    setFocusToken((t) => t + 1);
  }

  function handleSelectSite(site: RankedCitizenSite) {
    setSelectedId(site.id);
    setStage('detail');
    setSpotlightToken((t) => t + 1);
  }

  function handleBack() {
    if (stage === 'detail' || stage === 'help') {
      setSelectedId(null);
      setStage(origin ? 'recommend' : 'intro');
      setFocusToken((t) => t + 1);
      return;
    }
    // recommend → 처음 화면(화성시 전체)으로
    setOrigin(null);
    setOriginLabel(null);
    setStage('intro');
    setFocusToken((t) => t + 1);
  }

  const dismissable = stage !== 'intro' ? handleBack : null;

  return (
    <div className="relative h-full overflow-hidden bg-slate-200">
      <CitizenDiscoveryMap
        sites={ranked}
        highlightIds={highlightIds}
        userLocation={geo.status === 'granted' ? geo.coords : null}
        selectedId={selectedId}
        onSelect={handleSelectSite}
        bottomInset={sheetHeight}
        focusToken={focusToken}
        spotlightToken={spotlightToken}
      />

      {/* 지도 위 보조 액션. 지도를 가리지 않도록 작게, 그리고 첫 CTA 보다 항상 약하게 둔다. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
        {/* 아주 좁은 폭(200% 확대 등)에서는 브랜드 칩을 접어 보조 액션 자리를 남긴다. */}
        <span className="pointer-events-auto hidden rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-teal-800 shadow-sm ring-1 ring-slate-900/5 min-[360px]:inline-flex">
          화성 모아드림
        </span>
        <div className="pointer-events-auto ml-auto flex flex-wrap items-center justify-end gap-1.5">
          <Link
            to="/easy"
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <Type size={15} aria-hidden />
            쉽게 보기
          </Link>
          <button
            type="button"
            onClick={() => setShowDemoSheet(true)}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-medium text-slate-500 shadow-sm ring-1 ring-slate-900/5 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <PlayCircle size={15} aria-hidden />
            시연 모드
          </button>
        </div>
      </div>

      <CitizenSheet
        onHeightChange={handleSheetHeight}
        onDismiss={dismissable}
        maxHeightRatio={SHEET_RATIO[stage]}
        labelledBy="citizen-sheet-title"
      >
        {stage === 'intro' && (
          <IntroPanel
            locating={geo.status === 'locating'}
            geoBlocked={geo.status === 'denied' || geo.status === 'unsupported' || geo.status === 'error'}
            onLocate={geo.request}
            onPickDong={() => setShowDongPicker(true)}
            onHelp={() => setStage('help')}
          />
        )}

        {stage === 'recommend' && (
          <RecommendPanel
            recommended={recommended}
            originLabel={originLabel}
            onSelectSite={handleSelectSite}
            onHelp={() => setStage('help')}
            onRestart={handleBack}
          />
        )}

        {stage === 'detail' && selected && (
          <DetailPanel site={selected} onBack={handleBack} onHelp={() => setStage('help')} />
        )}

        {stage === 'help' && <HelpPanel onBack={handleBack} />}
      </CitizenSheet>

      {showDongPicker && <DongPicker onSelect={handleSelectDong} onClose={() => setShowDongPicker(false)} />}
      <DemoRoleSheet open={showDemoSheet} onClose={() => setShowDemoSheet(false)} />
    </div>
  );
}

// ── 단계 1. 첫 화면 ────────────────────────────────────────────────────────

function IntroPanel({
  locating,
  geoBlocked,
  onLocate,
  onPickDong,
  onHelp,
}: {
  locating: boolean;
  geoBlocked: boolean;
  onLocate: () => void;
  onPickDong: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="pt-1">
      <h1 className="text-[22px] font-bold leading-snug tracking-tight text-slate-900 min-[360px]:text-[26px]">
        <span id="citizen-sheet-title">
          지금 받을 수 있는 곳을
          <br />
          찾아드릴게요
        </span>
      </h1>
      {/* 200% 확대처럼 폭이 아주 좁아지면 보조 설명부터 접어 핵심 CTA 를 화면 안에 남긴다. */}
      <p className="mt-2 hidden text-base leading-relaxed text-slate-500 min-[360px]:block">
        내 위치와 최신 물품 정보를 보고 가장 가기 좋은 곳을 알려드려요.
      </p>

      <div className="mt-5">
        <BigButton onClick={onLocate} icon={LocateFixed} disabled={locating}>
          {locating ? '위치를 확인하는 중이에요' : '내 주변에서 찾기'}
        </BigButton>
      </div>

      <button
        type="button"
        onClick={onPickDong}
        className="mt-2.5 inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 text-lg font-semibold text-slate-600 underline underline-offset-4 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
      >
        <MapPin size={18} aria-hidden />
        사는 동네로 찾기
      </button>

      {geoBlocked && (
        <p className="mt-2 text-base text-slate-500">
          위치를 쓸 수 없어요. 사는 동네를 골라도 똑같이 찾아드려요.
        </p>
      )}

      <HelpFooter onHelp={onHelp} />
    </div>
  );
}

// ── 단계 2. 추천 ───────────────────────────────────────────────────────────

function RecommendPanel({
  recommended,
  originLabel,
  onSelectSite,
  onHelp,
  onRestart,
}: {
  recommended: RankedCitizenSite[];
  originLabel: string | null;
  onSelectSite: (site: RankedCitizenSite) => void;
  onHelp: () => void;
  onRestart: () => void;
}) {
  const [first, ...rest] = recommended;
  const today = todayLocal();

  if (!first) {
    return (
      <div className="pt-1">
        <h1 id="citizen-sheet-title" className="text-[22px] font-bold text-slate-900">
          확인할 수 있는 거점이 없어요
        </h1>
        <HelpFooter onHelp={onHelp} />
      </div>
    );
  }

  const reason = recommendReason(first, today);

  return (
    <div className="pt-1">
      <h1 id="citizen-sheet-title" className="text-[24px] font-bold leading-snug text-slate-900">
        지금은 여기가 가장 좋아요
      </h1>
      {originLabel && <p className="mt-1 text-base text-slate-400">{originLabel}</p>}

      {/* 1순위는 나머지와 같은 크기로 나열하지 않는다 — 압도적으로 크게 둔다. */}
      <div className="mt-3 rounded-2xl border-2 border-teal-600 bg-teal-50/40 p-4">
        <div className="flex items-start gap-2.5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-lg font-bold text-white"
            aria-hidden
          >
            1
          </span>
          <h2 className="text-[22px] font-bold leading-snug text-slate-900">
            <span className="sr-only">추천 1순위 </span>
            {first.displayName}
          </h2>
        </div>

        <div className="mt-2.5">
          <AvailabilityBadge availability={first.availability} size="lg" />
        </div>

        {first.availability !== 'unknown' && first.focusItem && (
          <p className="mt-2 text-lg font-semibold text-slate-800">{first.focusItem}</p>
        )}

        <p className="mt-2 text-lg font-semibold text-slate-700">
          {first.distanceKm !== null ? formatDistance(first.distanceKm) : first.address}
        </p>
        <p className="mt-0.5 text-base text-slate-500">{formatCheckedAt(first.updatedAt)}</p>

        {reason && <p className="mt-2.5 text-base font-medium text-teal-800">{reason}</p>}

        <div className="mt-3.5">
          <BigButton
            href={kakaoDirectionsUrl(first.name, { lat: first.lat, lng: first.lng })}
            icon={Navigation}
          >
            여기로 갈게요
          </BigButton>
        </div>
        <button
          type="button"
          onClick={() => onSelectSite(first)}
          className="mt-2 min-h-[48px] w-full text-base font-medium text-slate-500 underline underline-offset-4 hover:text-teal-700"
        >
          이곳 자세히 보기
        </button>
      </div>

      {rest.length > 0 && (
        <div className="mt-5">
          <p className="text-base font-semibold text-slate-500">다른 곳도 있어요</p>
          <ul className="mt-2 space-y-2">
            {rest.map((site, i) => (
              <li key={site.id}>
                <button
                  type="button"
                  onClick={() => onSelectSite(site)}
                  className="flex min-h-[56px] w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left hover:border-teal-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-700 text-base font-bold text-white"
                    aria-hidden
                  >
                    {i + 2}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lg font-semibold text-slate-900">
                      <span className="sr-only">추천 {i + 2}순위 </span>
                      {site.displayName}
                    </span>
                    <span className="mt-0.5 block text-base text-slate-500">
                      {site.distanceKm !== null ? `${formatDistance(site.distanceKm)} · ` : ''}
                      <AvailabilityIcon availability={site.availability} /> {AVAILABILITY_LABEL[site.availability]}
                    </span>
                  </span>
                  <ChevronRight size={20} className="shrink-0 text-slate-300" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <HelpFooter onHelp={onHelp} />

      <button
        type="button"
        onClick={onRestart}
        className="mt-2 min-h-[48px] w-full text-base font-medium text-slate-400 underline underline-offset-4"
      >
        다른 곳에서 다시 찾기
      </button>
    </div>
  );
}

// ── 단계 3. 거점 상세 ──────────────────────────────────────────────────────

function DetailPanel({
  site,
  onBack,
  onHelp,
}: {
  site: RankedCitizenSite;
  onBack: () => void;
  onHelp: () => void;
}) {
  return (
    <div className="pt-1">
      <BackButton onClick={onBack} label="추천으로 돌아가기" />

      <h1 id="citizen-sheet-title" className="mt-1 text-[24px] font-bold leading-snug text-slate-900">
        {site.displayName}
      </h1>
      <div className="mt-2">
        <AvailabilityBadge availability={site.availability} size="lg" />
      </div>

      {site.availability !== 'unknown' && site.focusItem && (
        <div className="mt-4">
          <p className="text-base font-semibold text-slate-500">지금 확인된 물품</p>
          <p className="mt-1 text-lg font-semibold text-slate-800">{site.focusItem}</p>
        </div>
      )}

      <dl className="mt-4 space-y-2.5 text-lg">
        {site.distanceKm !== null && (
          <div>
            <dt className="text-base font-semibold text-slate-500">가는 거리</dt>
            <dd className="text-slate-800">{formatDistance(site.distanceKm)}</dd>
          </div>
        )}
        {site.address && (
          <div>
            <dt className="text-base font-semibold text-slate-500">주소</dt>
            <dd className="text-slate-800">{site.address}</dd>
          </div>
        )}
        <div>
          <dt className="text-base font-semibold text-slate-500">마지막 확인</dt>
          <dd className="text-slate-800">{formatCheckedAt(site.updatedAt)}</dd>
        </div>
      </dl>

      {/* 운영시간·전화번호는 확인된 자료가 있을 때만 보여준다 — 지어내지 않는다. */}

      <div className="mt-5 space-y-2.5">
        <BigButton href={kakaoDirectionsUrl(site.name, { lat: site.lat, lng: site.lng })} icon={Navigation}>
          길찾기
        </BigButton>
        {site.phone && (
          <BigButton href={`tel:${site.phone}`} variant="secondary" icon={Phone}>
            전화하기
          </BigButton>
        )}
      </div>

      <HelpFooter onHelp={onHelp} />
    </div>
  );
}

// ── 단계 4. 도움 요청 ──────────────────────────────────────────────────────

function HelpPanel({ onBack }: { onBack: () => void }) {
  return (
    <div className="pt-1">
      <BackButton onClick={onBack} label="뒤로" />
      <h1 id="citizen-sheet-title" className="mt-1 text-[24px] font-bold leading-snug text-slate-900">
        직접 가기 어려우신가요?
      </h1>
      <p className="mt-1.5 mb-4 text-base text-slate-500">
        연락처와 사는 동네만 알려주시면 담당자가 확인 후 연락드려요.
      </p>
      <HelpRequestForm channel="CITIZEN" variant="citizen" onDone={onBack} doneLinkLabel="지도로 돌아가기" />
    </div>
  );
}

// ── 공통 조각 ──────────────────────────────────────────────────────────────

/** 어느 단계에서도 "직접 가기 어려운 시민" 경로를 잃지 않는다. 단, 첫 CTA 보다 약하게. */
function HelpFooter({ onHelp }: { onHelp: () => void }) {
  return (
    <div className="mt-5 border-t border-slate-100 pt-3.5">
      <p className="text-base text-slate-500">직접 가기 어려우신가요?</p>
      <button
        type="button"
        onClick={onHelp}
        className="mt-0.5 inline-flex min-h-[48px] items-center gap-1 text-lg font-bold text-teal-700 underline underline-offset-4 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
      >
        도움 요청하기
        <ChevronRight size={18} aria-hidden />
      </button>
    </div>
  );
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[48px] items-center gap-1.5 text-base font-medium text-slate-500 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
    >
      <ArrowLeft size={18} aria-hidden />
      {label}
    </button>
  );
}
