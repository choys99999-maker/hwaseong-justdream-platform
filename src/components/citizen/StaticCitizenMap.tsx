import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { districtBoundaries } from '../../data/districtBoundaries';
import { bboxOfPoints, cameraForBBox, createProjector, ringsToPath } from '../../lib/mapProjection';
import { AVAILABILITY_LABEL, type RankedCitizenSite } from '../../utils/citizenSite';
import type { LatLng } from '../../lib/geo';

/**
 * 카카오맵 없이 뜨는 시민용 대체 지도.
 *
 * 카카오 SDK 를 못 쓰는 환경(키 없음·도메인 미등록)에서 예전에는 회색 안내판만 남아
 * "내가 어디 있고 추천 장소가 어디인지" 를 눈으로 확인할 수 없었다. 도로·지명은 없지만
 * 화성시 모양과 거점 위치, 내 위치는 그대로 보여 준다.
 *
 * 핀 DOM 은 카카오 버전과 같은 `.gjc-pin` 구조라 스타일·애니메이션을 그대로 쓴다.
 */

/** 추천 핀이 화면 가장자리에 붙지 않도록 두는 여백(px). */
const FIT_PADDING = 36;

/** 카카오 버전(CitizenDiscoveryMap)과 같은 상태 색을 쓴다. */
const AVAILABILITY_COLOR: Record<RankedCitizenSite['availability'], string> = {
  available: '#059669',
  low: '#d97706',
  unknown: '#64748b',
};

interface StaticCitizenMapProps {
  sites: RankedCitizenSite[];
  highlightIds: string[];
  userLocation: LatLng | null;
  selectedId: string | null;
  onSelect: (site: RankedCitizenSite) => void;
  /** 하단 시트가 가리는 높이(px). 그만큼 지도를 위로 올려 핀이 시트에 가리지 않게 한다. */
  bottomInset: number;
  quiet: boolean;
}

export default function StaticCitizenMap({
  sites,
  highlightIds,
  userLocation,
  selectedId,
  onSelect,
  bottomInset,
  quiet,
}: StaticCitizenMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /**
   * 무엇을 화면에 담을지.
   *   - 추천이 없으면(첫 화면) 거점 전체
   *   - 추천이 있으면 내 위치 + 추천 ①②③ 만 담아 확대한다
   */
  const framedPoints = useMemo<LatLng[]>(() => {
    if (highlightIds.length === 0) return sites.map((s) => ({ lat: s.lat, lng: s.lng }));
    const points: LatLng[] = [];
    if (userLocation) points.push(userLocation);
    for (const id of highlightIds) {
      const site = sites.find((s) => s.id === id);
      if (site) points.push({ lat: site.lat, lng: site.lng });
    }
    return points.length > 0 ? points : sites.map((s) => ({ lat: s.lat, lng: s.lng }));
  }, [sites, highlightIds, userLocation]);

  /**
   * 시트가 덮는 아래쪽은 지도로 쓸 수 없다. 그 영역을 뺀 높이에 맞춰 배율을 잡고
   * 중심을 위로 올려 핀이 전부 시트 위에 놓이게 한다.
   */
  const projector = useMemo(() => {
    if (size.width === 0 || size.height === 0) return null;
    const bbox = bboxOfPoints(framedPoints, 0.02);
    if (!bbox) return null;
    const visibleHeight = Math.max(size.height - bottomInset, 120);
    const camera = cameraForBBox(bbox, size.width, visibleHeight, FIT_PADDING);
    // 가시 영역 중앙 = 전체 캔버스 중앙보다 bottomInset/2 만큼 위다. 중심을 그만큼 남쪽으로 민다.
    const shifted = { ...camera, centerLat: camera.centerLat - bottomInset / 2 / camera.k };
    return createProjector(shifted, size.width, size.height);
  }, [framedPoints, size.width, size.height, bottomInset]);

  // 첫 화면에서는 핀이 배경이다 — 탭 순서와 스크린리더에서 뺀다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-[#eef2f6]">
      {projector && (
        <>
          <svg width={size.width} height={size.height} className="absolute inset-0" aria-hidden>
            {/* 화성시 면 — 첫 화면에서는 조금 진하게 깔아 "여기가 화성" 이 읽히게 한다 */}
            {districtBoundaries.map((district) =>
              district.outline.map((ring, index) => (
                <path
                  key={`${district.id}-${index}`}
                  d={ringsToPath([ring], projector)}
                  fill="#0d9488"
                  fillOpacity={quiet ? 0.26 : 0.14}
                  stroke="#0d9488"
                  strokeOpacity={0.35}
                  strokeWidth={1}
                />
              )),
            )}
          </svg>

          {sites.map((site) => {
            const rank = highlightIds.indexOf(site.id);
            const isRanked = rank >= 0;
            const x = projector.x(site.lng);
            const y = projector.y(site.lat);
            if (x < -40 || y < -40 || x > size.width + 40 || y > size.height + 40) return null;

            return (
              <div
                key={site.id}
                className="absolute"
                style={{
                  left: x,
                  top: y,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isRanked ? 40 - rank : 10,
                }}
              >
                <button
                  type="button"
                  className={`gjc-pin${isRanked && mounted ? ' gjc-pin-enter' : ''}`}
                  data-rank={isRanked ? String(rank + 1) : ''}
                  data-dim={highlightIds.length > 0 && !isRanked ? 'true' : 'false'}
                  data-selected={site.id === selectedId ? 'true' : 'false'}
                  data-quiet={quiet ? 'true' : 'false'}
                  tabIndex={quiet ? -1 : 0}
                  aria-hidden={quiet}
                  aria-label={`${isRanked ? `추천 ${rank + 1}순위 ` : ''}${site.displayName} · ${AVAILABILITY_LABEL[site.availability]}`}
                  style={{ '--gjc-delay': `${Math.max(rank, 0) * 110}ms` } as React.CSSProperties}
                  onClick={() => onSelect(site)}
                >
                  <span
                    className="gjc-pin-dot"
                    style={{ '--gjc-color': AVAILABILITY_COLOR[site.availability] } as React.CSSProperties}
                  >
                    {isRanked ? String(rank + 1) : ''}
                  </span>
                </button>
              </div>
            );
          })}

          {userLocation && (
            <div
              className="absolute"
              style={{
                left: projector.x(userLocation.lng),
                top: projector.y(userLocation.lat),
                transform: 'translate(-50%, -50%)',
                zIndex: 50,
              }}
            >
              <div className="gjc-user-dot" aria-label="내 위치" />
            </div>
          )}
        </>
      )}

      <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-2.5 py-0.5 text-[11px] text-slate-500">
        간이 지도 · 도로 정보는 표시되지 않아요
      </p>
    </div>
  );
}
