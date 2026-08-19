import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { districtBoundaries } from '../../data/districtBoundaries';
import { bboxOfPoints, cameraForBBox, createProjector, ringsToPath } from '../../lib/mapProjection';
import type { CitizenPlace } from '../../data/citizenDirectory';
import type { LatLng } from '../../lib/geo';

/**
 * 카카오맵 없이 뜨는 시민용 대체 지도.
 *
 * 카카오 SDK 를 못 쓰는 환경(키 없음·도메인 미등록)에서 예전에는 회색 안내판만 남아
 * "내가 어디 있고 추천 장소가 어디인지" 를 눈으로 확인할 수 없었다. 도로·지명은 없지만
 * 화성시 모양과 거점 위치, 내 위치는 그대로 보여 준다.
 *
 * 핀 DOM 은 카카오 버전(CitizenMap)과 같은 `.cj-pin` 구조라 스타일·크기·순위 표현을
 * 그대로 쓴다 — 지도 종류가 바뀌어도 시민이 보는 핀은 같아야 한다.
 */

/** 추천 핀이 화면 가장자리에 붙지 않도록 두는 여백(px). */
const FIT_PADDING = 36;

interface StaticCitizenMapProps {
  places: CitizenPlace[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** 추천 순서대로의 거점 id. 카카오 버전과 같은 규칙으로 크기·숫자를 정한다. */
  rankedIds?: string[];
  userLocation?: LatLng | null;
  /** 이 좌표들이 한 화면에 다 보이게 맞춘다. 없으면 거점 전체를 담는다. */
  fitPoints?: LatLng[] | null;
  /** 하단 시트가 가리는 높이(px). 그만큼 지도를 위로 올려 핀이 시트에 가리지 않게 한다. */
  bottomInset?: number;
}

export default function StaticCitizenMap({
  places,
  selectedId,
  onSelect,
  rankedIds = [],
  userLocation = null,
  fitPoints = null,
  bottomInset = 0,
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
   * 카카오 버전과 같은 기준을 쓴다 — 호출자가 `fitPoints` 를 주면 그것만 담아 확대하고,
   * 없으면 거점 전체를 담아 "화성시 어디에 무엇이 있는지" 를 먼저 보여 준다.
   */
  const framedPoints = useMemo<LatLng[]>(() => {
    const all = places.map((place) => ({ lat: place.lat, lng: place.lng }));
    if (!fitPoints || fitPoints.length === 0) return all;
    return fitPoints.length > 0 ? fitPoints : all;
  }, [places, fitPoints]);

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

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-paper">
      {projector && (
        <>
          <svg width={size.width} height={size.height} className="absolute inset-0" aria-hidden>
            <defs>
              {/* 화성시 내부를 검정(=오버레이 숨김)으로 잘라낸 마스크 — 외부에만 dim 덮기 위해 */}
              <mask id="hwaseong-outside-dim">
                <rect x="0" y="0" width={size.width} height={size.height} fill="white" />
                {districtBoundaries.map((district) =>
                  district.outline.map((ring, index) => (
                    <path
                      key={`hmask-${district.id}-${index}`}
                      d={ringsToPath([ring], projector)}
                      fill="black"
                    />
                  )),
                )}
              </mask>
            </defs>

            {/* 화성시 외부 dim 오버레이 */}
            <rect
              x="0"
              y="0"
              width={size.width}
              height={size.height}
              fill="#0a121c"
              fillOpacity={0.52}
              mask="url(#hwaseong-outside-dim)"
            />

            {/* 화성시 구 경계 내부 면 + 기존 파란 선 */}
            {districtBoundaries.map((district) =>
              district.outline.map((ring, index) => (
                <path
                  key={`outline-${district.id}-${index}`}
                  d={ringsToPath([ring], projector)}
                  fill="#131c2e"
                  fillOpacity={0.06}
                  stroke="none"
                />
              )),
            )}
            {districtBoundaries.map((district) =>
              district.areas.map((area) =>
                area.polygons.map((polygon, index) => (
                  <path
                    key={`area-${area.code}-${index}`}
                    d={ringsToPath(polygon, projector)}
                    fill="none"
                    stroke="#0054a6"
                    strokeOpacity={0.22}
                    strokeWidth={0.8}
                  />
                )),
              ),
            )}

            {/* 화성시 외곽 경계선 — 진한 차콜로 내/외부를 명확히 구분 */}
            {districtBoundaries.map((district) =>
              district.outline.map((ring, index) => (
                <path
                  key={`boundary-${district.id}-${index}`}
                  d={ringsToPath([ring], projector)}
                  fill="none"
                  stroke="#111827"
                  strokeOpacity={0.85}
                  strokeWidth={2.5}
                  strokeLinejoin="round"
                />
              )),
            )}
          </svg>

          {places.map((place) => {
            const rank = rankedIds.indexOf(place.id);
            const isRanked = rank >= 0;
            const x = projector.x(place.lng);
            const y = projector.y(place.lat);
            if (x < -40 || y < -40 || x > size.width + 40 || y > size.height + 40) return null;

            return (
              <div
                key={place.id}
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
                  className="cj-pin"
                  // 순위가 있는 핀만 data-rank 를 갖는다 — 빈 문자열이면 CSS 가 이름표를 띄운다.
                  {...(isRanked ? { 'data-rank': String(rank + 1) } : {})}
                  data-dim={rankedIds.length > 0 && !isRanked ? 'true' : 'false'}
                  data-selected={place.id === selectedId ? 'true' : 'false'}
                  data-zoomed="false"
                  data-availability={place.availability}
                  aria-label={`${isRanked ? `추천 ${rank + 1}순위 ` : ''}${place.displayName}`}
                  onClick={() => onSelect(place.id)}
                >
                  <span className="cj-pin-dot">{isRanked ? String(rank + 1) : ''}</span>
                  <span className="cj-pin-name">{place.displayName}</span>
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
              <div className="cj-my-loc" aria-label="내 위치">
                <div className="cj-my-loc-dot" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
