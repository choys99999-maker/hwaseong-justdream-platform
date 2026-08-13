import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronRight, LocateFixed, Menu, Navigation, Phone, Type } from 'lucide-react';
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
import CitizenDrawer from '../../components/citizen/CitizenDrawer';
import HelpRequestForm from '../../components/citizen/HelpRequestForm';

type Stage = 'intro' | 'recommend' | 'detail' | 'help';
type SheetStage = Exclude<Stage, 'intro'>;

/** 단계별 시트 최대 높이(화면 비율). 지도와의 공간 관계가 어느 단계에서도 끊기지 않게 한다. */
const SHEET_RATIO: Record<SheetStage, number> = {
  recommend: 0.64,
  detail: 0.76,
  help: 0.88,
};

/**
 * 첫 화면에서 지도 프레이밍에 쓰는 아래 여백(px).
 *
 * 화성시는 동서로 아주 길어서(경도 0.43°) 390px 폭에 전체를 담으면 세로로는 화면의 20% 밖에
 * 차지하지 못한다. 그 띠를 화면 한가운데 두면 중앙 CTA 가 정확히 그 위를 덮으므로,
 * 여백을 크게 잡아 도시를 CTA 위쪽으로 올려 둔다 — 지도와 CTA 가 서로를 가리지 않는다.
 */
const INTRO_MAP_INSET = 460;

/**
 * 시민 첫 화면.
 *
 * 첫 화면은 설명 화면이 아니라 행동을 시작하는 화면이다 — 지도는 배경 무드로만 깔고
 * (딤 한 겹 + 조용한 점 핀), 그 위 정중앙에 핵심 CTA 하나만 또렷하게 둔다.
 * 정보형 UX(줌인·추천 ①②③·상세 시트)는 그 버튼을 누른 뒤에야 시작된다.
 *   첫 화면 → [내 주변에서 찾기] → 지도 줌인 + ①②③ → "지금은 여기가 가장 좋아요" → 길찾기
 *   첫 화면 → 도움 요청(작은 보조 액션)
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
  const [showDrawer, setShowDrawer] = useState(false);

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

  const isIntro = stage === 'intro';

  return (
    <div className="relative h-full overflow-hidden bg-slate-200">
      <CitizenDiscoveryMap
        sites={ranked}
        highlightIds={highlightIds}
        userLocation={geo.status === 'granted' ? geo.coords : null}
        selectedId={selectedId}
        onSelect={handleSelectSite}
        bottomInset={isIntro ? INTRO_MAP_INSET : sheetHeight}
        focusToken={focusToken}
        spotlightToken={spotlightToken}
        quiet={isIntro}
      />

      {/* 화면 상단은 최소 UI만 둔다 — 왼쪽 햄버거(전체 메뉴), 오른쪽 큰 글씨 모드. 어느 단계에서나 같은 자리. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => setShowDrawer(true)}
          aria-label="전체 메뉴 열기"
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm ring-1 ring-slate-900/5 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Menu size={22} aria-hidden />
        </button>
        <Link
          to="/easy"
          className="pointer-events-auto inline-flex min-h-[40px] items-center gap-1 rounded-full bg-white/90 px-3 text-sm font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
        >
          <Type size={15} aria-hidden />
          쉽게 보기
        </Link>
      </div>

      <CitizenDrawer open={showDrawer} onClose={() => setShowDrawer(false)} />

      {isIntro ? (
        <IntroOverlay
          locating={geo.status === 'locating'}
          geoBlocked={geo.status === 'denied' || geo.status === 'unsupported' || geo.status === 'error'}
          onLocate={geo.request}
          onPickDong={() => setShowDongPicker(true)}
          onHelp={() => setStage('help')}
        />
      ) : (
        <>
          <CitizenSheet
            onHeightChange={handleSheetHeight}
            onDismiss={handleBack}
            maxHeightRatio={SHEET_RATIO[stage]}
            labelledBy="citizen-sheet-title"
          >
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
        </>
      )}

      {showDongPicker && <DongPicker onSelect={handleSelectDong} onClose={() => setShowDongPicker(false)} />}
    </div>
  );
}

// ── 단계 1. 첫 화면 ────────────────────────────────────────────────────────

/**
 * 첫 진입 화면. 시트도 카드도 없이 지도 위에 바로 얹는다.
 *
 * 위계는 딱 세 단이다 — ① 화면 정중앙의 CTA 하나, ② 그 아래 작은 보조 액션 두 개,
 * ③ 화면 맨 아래 아주 약한 부가 진입로. 설명문은 한 줄로 줄였고, 나머지는 전부 지웠다.
 */
function IntroOverlay({
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
    <div className="absolute inset-0 z-20">
      {/* 지도를 지우지 않고 한 겹만 덮는다 — 가운데는 밝게(CTA 가독), 가장자리만 살짝 어둡게. */}
      <div className="gjc-intro-scrim absolute inset-0" aria-hidden />

      {/*
        화면이 아주 낮아지는 경우(200% 확대·가로 모드)에도 CTA 가 잘리면 안 된다.
        평소에는 min-h-full + 가운데 정렬로 중앙 배치, 모자랄 때만 이 안에서 스크롤한다.
      */}
      <div className="relative h-full overflow-y-auto overscroll-contain">
        <div className="gjc-intro-in flex min-h-full flex-col items-center px-6 pb-[max(12px,env(safe-area-inset-bottom))] pt-5">
          {/* 화면이 아주 낮으면(200% 확대) 장식부터 접는다 — 남는 높이는 전부 CTA 몫이다. */}
          <span className="hidden rounded-full bg-white/70 px-3 py-1 text-[13px] font-bold tracking-[0.16em] text-teal-800 backdrop-blur-sm [@media(min-height:560px)]:inline-flex">
            화성 모아드림
          </span>

          <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 py-4 [@media(min-height:560px)]:py-6">
            <h1 className="text-balance text-center text-[21px] font-bold leading-snug tracking-tight text-slate-900">
              가까운 그냥드림을 찾아드릴게요
            </h1>

            {/* 화면에서 가장 강한 요소 하나. 흰 링 + 그림자로 지도 배경에서 확실히 떠오르게 한다. */}
            <div className="w-full max-w-[300px] rounded-2xl shadow-[0_14px_30px_-12px_rgba(13,118,110,0.75)] ring-4 ring-white/60">
              <BigButton onClick={onLocate} icon={LocateFixed} disabled={locating}>
                {locating ? '위치를 확인하는 중이에요' : '내 주변에서 찾기'}
              </BigButton>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <IntroMiniAction onClick={onPickDong}>동네로 찾기</IntroMiniAction>
              <IntroMiniAction onClick={onHelp}>도움 요청</IntroMiniAction>
            </div>

            {geoBlocked && (
              <p className="rounded-full bg-white/85 px-3 py-1 text-center text-[15px] text-slate-600">
                위치를 쓸 수 없어요. 동네로 찾아드릴게요.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 첫 화면의 보조 액션. 메인 CTA 와 색·크기·무게를 모두 낮춰 한눈에 2순위로 읽히게 둔다. */
function IntroMiniAction({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-full bg-white/85 px-4 text-[15px] font-semibold text-slate-600 ring-1 ring-slate-900/5 backdrop-blur-sm hover:text-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40"
    >
      {children}
    </button>
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
