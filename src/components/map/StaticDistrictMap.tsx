import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Minus, Plus, RotateCw } from 'lucide-react';
import type { DistrictId, OperationSite, SiteStatus } from '../../types';
import { districtBoundaries, getDistrictBBox } from '../../data/districtBoundaries';
import { SITE_STATUS_COLORS, SITE_STATUS_LABELS } from '../../data/regionMeta';
import {
  bboxOfPoints,
  cameraForBBox,
  createProjector,
  ringsToPath,
  type MapCamera,
} from '../../lib/mapProjection';
import { computeCoincidentShifts, layoutLabels, type LabelTarget } from './labelLayout';
import type { MapFocusRequest } from './mapTypes';

/**
 * 카카오맵 없이 동작하는 대체 지도.
 *
 * 카카오 SDK 는 API 키와 "실행 도메인 등록"이 둘 다 맞아야 뜬다. 둘 중 하나라도 어긋나면
 * 지도가 통째로 사라져 거점 위치를 아예 볼 수 없었다 — 시연 자리에서 가장 자주 터진 문제다.
 * 이 컴포넌트는 이미 저장소에 들어 있는 행정동 경계 GeoJSON 과 거점 좌표만으로 같은 화면을
 * SVG 로 그린다. 도로·지명 같은 배경 타일은 없지만 "어느 구 어디에 무엇이 있는지" 라는
 * 지도의 본래 역할과 구 선택·거점 선택·필터·검색 이동은 그대로 동작한다.
 *
 * 마커 DOM 구조와 클래스(`.gj-marker`)는 카카오 지도와 동일하게 맞춰 스타일을 공유한다.
 */

const POLYGON_STYLE = {
  base: { strokeWidth: 1, strokeOpacity: 0.7, fillOpacity: 0.2 },
  hover: { strokeWidth: 1.5, strokeOpacity: 1, fillOpacity: 0.34 },
  selected: { strokeWidth: 1.5, strokeOpacity: 1, fillOpacity: 0.3 },
  dimmed: { strokeWidth: 0.75, strokeOpacity: 0.3, fillOpacity: 0.08 },
} as const;

const OUTLINE_COLOR = '#475569';
const FIT_PADDING = 20;
/** 검색으로 특정 거점을 고를 때의 표시 범위(도). 약 1km 안쪽이 보인다. */
const FOCUS_SPAN_DEG = 0.012;
/** 휠·버튼 한 번의 확대율 */
const ZOOM_STEP = 1.5;
/** 클릭과 드래그를 가르는 이동 거리(px) */
const DRAG_THRESHOLD = 4;

interface StaticDistrictMapProps {
  sites: OperationSite[];
  districtRiskLevels: Record<DistrictId, SiteStatus>;
  selectedDistrict: DistrictId | null;
  selectedSiteId: string | null;
  onSelectDistrict: (district: DistrictId | null) => void;
  onSelectSite: (siteId: string) => void;
  onMapClick?: () => void;
  filterFn?: (site: OperationSite) => boolean;
  focusRequest?: MapFocusRequest | null;
  /** 왜 카카오맵 대신 이 지도를 쓰는지 알리는 한 줄. */
  notice?: string;
  /** 있으면 안내 줄에 "카카오맵 다시 시도" 버튼을 붙인다. */
  onRetryKakao?: () => void;
}

export default function StaticDistrictMap({
  sites,
  districtRiskLevels,
  selectedDistrict,
  selectedSiteId,
  onSelectDistrict,
  onSelectSite,
  onMapClick,
  filterFn,
  focusRequest,
  notice,
  onRetryKakao,
}: StaticDistrictMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState<MapCamera | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<DistrictId | null>(null);

  const labelTargetsRef = useRef(new Map<string, LabelTarget>());
  const layoutFrameRef = useRef(0);

  // ── 크기 추적 ──────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitTo = useCallback(
    (bbox: [number, number, number, number]) => {
      if (size.width === 0 || size.height === 0) return;
      setCamera(cameraForBBox(bbox, size.width, size.height, FIT_PADDING));
    },
    [size.width, size.height],
  );

  // ── 구 선택 → 해당 구 경계로 맞춘다 (선택 없으면 화성시 전체) ──────────
  useEffect(() => {
    fitTo(getDistrictBBox(selectedDistrict));
  }, [selectedDistrict, fitTo]);

  // ── 검색 결과 선택 등 외부 focusRequest ────────────────────────────────
  useEffect(() => {
    if (!focusRequest) return;
    const site = sites.find((s) => s.id === focusRequest.siteId);
    if (!site) return;
    setCamera((prev) => {
      if (!prev) return prev;
      // panOnly 면 배율을 유지하고 중심만 옮긴다. (마커 직접 클릭)
      if (focusRequest.panOnly) return { ...prev, centerLng: site.longitude, centerLat: site.latitude };
      if (size.width === 0 || size.height === 0) return prev;
      return cameraForBBox(
        [
          site.longitude - FOCUS_SPAN_DEG,
          site.latitude - FOCUS_SPAN_DEG,
          site.longitude + FOCUS_SPAN_DEG,
          site.latitude + FOCUS_SPAN_DEG,
        ],
        size.width,
        size.height,
        FIT_PADDING,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest?.siteId, focusRequest?.token]);

  const projector = useMemo(
    () => (camera ? createProjector(camera, size.width, size.height) : null),
    [camera, size.width, size.height],
  );

  const coincidentShifts = useMemo(() => computeCoincidentShifts(sites), [sites]);

  const visibleSites = useMemo(
    () =>
      sites.filter((site) => {
        const districtVisible = selectedDistrict === null || site.district === selectedDistrict;
        return districtVisible && (!filterFn || filterFn(site));
      }),
    [sites, selectedDistrict, filterFn],
  );

  // ── 라벨 겹침 재계산 ───────────────────────────────────────────────────
  useEffect(() => {
    cancelAnimationFrame(layoutFrameRef.current);
    layoutFrameRef.current = requestAnimationFrame(() => {
      layoutLabels([...labelTargetsRef.current.values()]);
    });
    return () => cancelAnimationFrame(layoutFrameRef.current);
  }, [projector, visibleSites, selectedSiteId]);

  // ── 드래그 이동 ────────────────────────────────────────────────────────
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || !camera) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    const kx = camera.k * Math.cos((camera.centerLat * Math.PI) / 180);
    setCamera({
      ...camera,
      centerLng: camera.centerLng - dx / kx,
      centerLat: camera.centerLat + dy / camera.k,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // 드래그 직후의 click 이벤트는 배경 클릭으로 처리하지 않는다.
    window.setTimeout(() => {
      dragRef.current = null;
    }, 0);
  };

  const zoomBy = useCallback((factor: number) => {
    setCamera((prev) => (prev ? { ...prev, k: prev.k * factor } : prev));
  }, []);

  /*
   * 휠 확대·축소.
   *
   * React 의 onWheel 은 root 에 passive 로 붙어 preventDefault 가 듣지 않는다.
   * 그대로 두면 지도를 확대하면서 페이지까지 함께 스크롤돼 지도가 화면에서 달아난다.
   * 그래서 컨테이너에 직접 non-passive 리스너를 건다.
   */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomBy]);

  const handleFitToVisible = () => {
    const bbox = bboxOfPoints(visibleSites.map((s) => ({ lat: s.latitude, lng: s.longitude })));
    fitTo(bbox ?? getDistrictBBox(selectedDistrict));
  };

  const handleBackgroundClick = () => {
    if (dragRef.current?.moved) return;
    onMapClick?.();
  };

  const registerLabel = useCallback((siteId: string, element: HTMLButtonElement | null) => {
    if (!element) {
      labelTargetsRef.current.delete(siteId);
      return;
    }
    const label = element.querySelector<HTMLElement>('.gj-marker-label');
    if (!label) return;
    labelTargetsRef.current.set(siteId, { element, label, visible: true });
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200">
      <div
        ref={containerRef}
        role="region"
        aria-label="화성특례시 4개 구 거점 운영 지도"
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {projector && size.width > 0 && (
          <>
            <svg
              width={size.width}
              height={size.height}
              className="absolute inset-0"
              aria-hidden
            >
              {/* 배경 — 폴리곤·마커가 아닌 곳을 눌렀을 때 */}
              <rect
                x={0}
                y={0}
                width={size.width}
                height={size.height}
                fill="#eef2f6"
                onClick={handleBackgroundClick}
              />

              {/* 읍면동 폴리곤 — 구 상태 색으로 칠한다 */}
              {districtBoundaries.map((district) => {
                const colors = SITE_STATUS_COLORS[districtRiskLevels[district.id]];
                const isSelected = selectedDistrict === district.id;
                const isDimmed = selectedDistrict !== null && !isSelected;
                const style = isSelected
                  ? POLYGON_STYLE.selected
                  : isDimmed
                    ? POLYGON_STYLE.dimmed
                    : hoveredDistrict === district.id
                      ? POLYGON_STYLE.hover
                      : POLYGON_STYLE.base;

                return (
                  <g
                    key={district.id}
                    // 지도를 끌어 옮긴 직후의 click 은 구 선택으로 보지 않는다.
                    onClick={() => {
                      if (dragRef.current?.moved) return;
                      onSelectDistrict(district.id);
                    }}
                    onMouseEnter={() => setHoveredDistrict(district.id)}
                    onMouseLeave={() =>
                      setHoveredDistrict((current) => (current === district.id ? null : current))
                    }
                    className="cursor-pointer"
                  >
                    {district.areas.map((area) =>
                      area.polygons.map((rings, index) => (
                        <path
                          key={`${area.code}-${index}`}
                          d={ringsToPath(rings, projector)}
                          fill={colors.fill}
                          fillOpacity={style.fillOpacity}
                          fillRule="evenodd"
                          stroke={colors.stroke}
                          strokeOpacity={style.strokeOpacity}
                          strokeWidth={style.strokeWidth}
                        />
                      )),
                    )}
                  </g>
                );
              })}

              {/* 구 경계선 — 읍면동 경계보다 굵게 얹는다 */}
              {districtBoundaries.map((district) => {
                const isSelected = selectedDistrict === district.id;
                const dimmed = selectedDistrict !== null && !isSelected;
                return district.outline.map((ring, index) => (
                  <path
                    key={`${district.id}-outline-${index}`}
                    d={ringsToPath([ring], projector)}
                    fill="none"
                    stroke={OUTLINE_COLOR}
                    strokeOpacity={dimmed ? 0.25 : isSelected ? 0.9 : 0.7}
                    strokeWidth={isSelected ? 2 : 1.5}
                    pointerEvents="none"
                  />
                ));
              })}
            </svg>

            {/* 거점 마커 — 카카오 지도와 같은 DOM/클래스를 써 스타일을 공유한다 */}
            {visibleSites.map((site) => {
              const shift = coincidentShifts.get(site.id) ?? 0;
              const isSelected = site.id === selectedSiteId;
              const x = projector.x(site.longitude);
              const y = projector.y(site.latitude);
              // 화면 밖 마커는 그리지 않는다. 라벨이 화면 가장자리에 쌓이는 것을 막는다.
              if (x < -80 || y < -80 || x > size.width + 80 || y > size.height + 80) return null;

              return (
                <div
                  key={site.id}
                  className="absolute"
                  style={{ left: x, top: y, transform: 'translate(-50%, -50%)', zIndex: isSelected ? 9 : 5 }}
                >
                  <button
                    ref={(el) => registerLabel(site.id, el)}
                    type="button"
                    className="gj-marker"
                    data-selected={String(isSelected)}
                    data-place="right"
                    data-coincident={shift !== 0 ? 'true' : undefined}
                    aria-label={`${site.name} · ${SITE_STATUS_LABELS[site.status]}`}
                    style={
                      {
                        '--gj-status': SITE_STATUS_COLORS[site.status].fill,
                        '--gj-shift': `${shift}px`,
                        '--gj-stem-left': `${shift > 0 ? -shift : 6}px`,
                        '--gj-stem-width': `${Math.max(0, Math.abs(shift) - 6)}px`,
                        opacity: selectedSiteId && !isSelected ? 0.55 : 1,
                      } as React.CSSProperties
                    }
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectSite(site.id);
                    }}
                  >
                    <span className="gj-marker-label" title={site.name}>
                      {site.displayName}
                    </span>
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* 좌하단 — 전체 보기 */}
      <button
        type="button"
        onClick={handleFitToVisible}
        className="absolute bottom-3 left-3 z-10 inline-flex items-center rounded-md border border-slate-200 bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        전체 보기
      </button>

      {/* 우측 — 확대/축소 */}
      <div className="absolute right-3 top-3 z-10 flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white/90 shadow-sm">
        <button
          type="button"
          onClick={() => zoomBy(ZOOM_STEP)}
          aria-label="지도 확대"
          className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
        >
          <Plus size={14} />
        </button>
        <button
          type="button"
          onClick={() => zoomBy(1 / ZOOM_STEP)}
          aria-label="지도 축소"
          className="flex h-7 w-7 items-center justify-center border-t border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500"
        >
          <Minus size={14} />
        </button>
      </div>

      {/* 상단 — 왜 대체 지도인지 알린다 */}
      {notice && (
        <div className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100%-6rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-amber-200 bg-amber-50/95 px-3 py-1 text-[11px] text-amber-900 shadow-sm">
          <span className="truncate">{notice}</span>
          {onRetryKakao && (
            <button
              type="button"
              onClick={onRetryKakao}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-0.5 font-medium text-amber-800 hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
            >
              <RotateCw size={11} />
              다시 시도
            </button>
          )}
        </div>
      )}
    </div>
  );
}
