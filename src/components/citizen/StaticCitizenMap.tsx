import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { districtBoundaries } from '../../data/districtBoundaries';
import { bboxOfPoints, cameraForBBox, createProjector, ringsToPath } from '../../lib/mapProjection';
import type { CitizenPlace } from '../../data/citizenDirectory';
import type { DistrictId } from '../../types';
import type { LatLng } from '../../lib/geo';
import { clusterSubText, markerAriaLabel, markerViewOf, summarizeByDistrict } from './mapMarkers';

/**
 * 카카오맵 없이 뜨는 시민용 대체 지도.
 *
 * 카카오 SDK 를 못 쓰는 환경(키 없음·도메인 미등록)에서 예전에는 회색 안내판만 남아
 * "내가 어디 있고 추천 장소가 어디인지" 를 눈으로 확인할 수 없었다. 도로·지명은 없지만
 * 화성시 모양과 거점 위치, 내 위치는 그대로 보여 준다.
 *
 * 마커 DOM 은 카카오 버전(CitizenMap)과 같은 `.cj-marker` 구조라 크기·상태색·터치 영역을
 * 그대로 쓴다 — 지도 종류가 바뀌어도 시민이 누르는 대상은 같아야 한다.
 * 마크업 규칙의 출처는 `mapMarkers.ts` 한 곳이다.
 */

/**
 * 화면 가장자리에 두는 여백(px).
 *
 * 개별 캡슐이 뜰 때는 크게 잡는다 — 마커가 점이 아니라 폭 200px 안팎의 캡슐이라
 * 좌표만 화면에 넣으면 이름표가 잘려 나간다. 반대로 구역 묶음만 뜨는 넓은 화면에서는
 * 카드 자리를 따로 보정하므로(positionedClusters) 여백을 키울 이유가 없다 —
 * 키우면 화성시 모양만 쓸데없이 작아진다.
 */
const FIT_PADDING_MARKERS = 92;
const FIT_PADDING_CLUSTERS = 36;

/** 이 개수 미만인 구역은 묶지 않는다. 카카오 버전(`CLUSTER_MIN_PLACES`)과 같은 규칙. */
const CLUSTER_MIN_PLACES = 2;

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
  /**
   * 지금 파고든 구(區). 카카오 버전의 "줌 인" 을 대신한다 —
   * 이 지도는 확대 조작이 없으므로 구역 묶음 카드를 누른 것 자체가 한 단계 들어가는 행동이다.
   */
  const [zoomDistrict, setZoomDistrict] = useState<DistrictId | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const apply = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const fitKey = (fitPoints ?? []).map((p) => `${p.lat},${p.lng}`).join('|');
  // 호출자가 카메라를 다시 잡으면(내 주변 찾기·초기화 등) 파고든 구는 풀린다.
  useEffect(() => setZoomDistrict(null), [fitKey]);

  /**
   * 넓게 볼 때는 개별 캡슐 대신 구역 묶음 카드를 세운다.
   *
   * 30개 캡슐을 화성시 전역에 한꺼번에 뿌리면 서로 겹쳐 아무것도 못 읽는다 —
   * 카카오 버전이 줌 레벨로 하는 판단(`CLUSTER_ZOOM_LEVEL`)을 여기서는
   * "아직 아무 곳도 지목되지 않았는가" 로 대신한다. 추천·선택된 거점은 언제나 개별로 남는다.
   */
  const pinnedIds = useMemo(
    () => new Set([...rankedIds, ...(selectedId ? [selectedId] : [])]),
    [rankedIds, selectedId],
  );

  const grouping = zoomDistrict === null && (!fitPoints || fitPoints.length === 0);

  const clusters = useMemo(() => {
    if (!grouping) return [];
    const groupable = places.filter((p) => !pinnedIds.has(p.id));
    return summarizeByDistrict(groupable).filter((c) => c.count >= CLUSTER_MIN_PLACES);
  }, [grouping, places, pinnedIds]);

  const clusteredIds = useMemo(
    () => new Set(clusters.flatMap((c) => c.placeIds)),
    [clusters],
  );


  /**
   * 무엇을 화면에 담을지.
   * 카카오 버전과 같은 기준을 쓴다 — 호출자가 `fitPoints` 를 주면 그것만 담아 확대하고,
   * 없으면 거점 전체를 담아 "화성시 어디에 무엇이 있는지" 를 먼저 보여 준다.
   * 구역 묶음을 눌러 파고들었으면 그 구의 거점만 담는다.
   */
  const framedPoints = useMemo<LatLng[]>(() => {
    if (zoomDistrict) {
      const inDistrict = places
        .filter((p) => p.district === zoomDistrict)
        .map((place) => ({ lat: place.lat, lng: place.lng }));
      if (inDistrict.length > 0) return inDistrict;
    }
    const all = places.map((place) => ({ lat: place.lat, lng: place.lng }));
    if (!fitPoints || fitPoints.length === 0) return all;
    return fitPoints;
  }, [places, fitPoints, zoomDistrict]);

  /**
   * 시트가 덮는 아래쪽은 지도로 쓸 수 없다. 그 영역을 뺀 높이에 맞춰 배율을 잡고
   * 중심을 위로 올려 핀이 전부 시트 위에 놓이게 한다.
   */
  const projector = useMemo(() => {
    if (size.width === 0 || size.height === 0) return null;
    const bbox = bboxOfPoints(framedPoints, 0.02);
    if (!bbox) return null;
    const visibleHeight = Math.max(size.height - bottomInset, 120);
    const camera = cameraForBBox(
      bbox,
      size.width,
      visibleHeight,
      grouping ? FIT_PADDING_CLUSTERS : FIT_PADDING_MARKERS,
    );
    // 가시 영역 중앙 = 전체 캔버스 중앙보다 bottomInset/2 만큼 위다. 중심을 그만큼 남쪽으로 민다.
    const shifted = { ...camera, centerLat: camera.centerLat - bottomInset / 2 / camera.k };
    return createProjector(shifted, size.width, size.height);
  }, [framedPoints, size.width, size.height, bottomInset, grouping]);

  /**
   * 묶음 카드의 실제 화면 자리.
   *
   * 거점이 몰린 구는 무게중심끼리도 가까워서, 좌표를 그대로 쓰면 카드 넉 장이 화면 가운데서
   * 겹쳐 서로를 가린다(맨 위 한 장만 눌린다). 그래서 겹치면 아래로 한 칸씩 밀고,
   * 화면 밖으로 나가지 않게 좌우를 가둔다. 카드는 "구역 요약" 이지 정밀 좌표가 아니므로
   * 몇십 픽셀 어긋나는 편이 서로 가리는 것보다 낫다.
   */
  const positionedClusters = useMemo(() => {
    if (!projector) return [];
    const CARD_W = 176;
    const CARD_H = 64;
    const placed: { left: number; top: number }[] = [];
    return clusters
      .map((cluster) => ({
        cluster,
        left: projector.x(cluster.lng),
        top: projector.y(cluster.lat),
      }))
      .sort((a, b) => a.top - b.top)
      .map((entry) => {
        const maxLeft = Math.max(size.width - CARD_W / 2 - 8, CARD_W / 2 + 8);
        // 하단 패널·안내줄이 덮는 높이는 지도로 쓸 수 없다. 그 위까지만 카드를 둔다.
        const maxTop = Math.max(size.height - bottomInset - CARD_H, 96);
        const left = Math.min(Math.max(entry.left, CARD_W / 2 + 8), maxLeft);
        const base = Math.min(Math.max(entry.top, 96), maxTop);

        // 원래 자리에서 위·아래로 한 칸씩 번갈아 비어 있는 줄을 찾는다.
        // 후보를 유한하게 만들어 두지 않으면 위아래 경계 사이에서 무한히 튕긴다.
        const overlaps = (top: number) =>
          placed.some((p) => Math.abs(p.left - left) < CARD_W && Math.abs(p.top - top) < CARD_H);
        const candidates = [base];
        for (let step = 1; step <= 6; step += 1) {
          candidates.push(base + step * CARD_H, base - step * CARD_H);
        }
        // 어느 자리도 비어 있지 않을 만큼 화면이 낮으면(200% 확대 등) 완전히 포개지 말고
        // 조금씩 어긋나게 쌓는다 — 맨 위 한 장만 보이는 것보다 넉 장이 있다는 게 읽혀야 한다.
        const top = candidates.find((t) => t >= 96 && t <= maxTop && !overlaps(t)) ?? base + placed.length * 14;

        placed.push({ left, top });
        return { ...entry, left, top };
      });
  }, [clusters, projector, size.width, size.height, bottomInset]);

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

          {/* 구역 묶음 카드 — 넓게 볼 때는 개별 거점 대신 "어디에 몇 곳" 만 말한다. */}
          {positionedClusters.map(({ cluster, left, top }) => (
            <div
              key={cluster.districtId}
              className="absolute w-max"
              style={{
                left,
                top,
                transform: 'translate(-50%, -50%)',
                zIndex: 30,
              }}
            >
              <button
                type="button"
                className="cj-cluster-card"
                data-alert={cluster.alertCount > 0 ? 'true' : 'false'}
                aria-label={`${cluster.districtName} 거점 ${cluster.count}곳${
                  cluster.alertCount > 0 ? `, 물품 부족 ${cluster.alertCount}곳` : ''
                } — 눌러서 이 구역 거점 보기`}
                onClick={() => setZoomDistrict(cluster.districtId)}
              >
                <span className="cj-cluster-count" aria-hidden>
                  {cluster.count}
                </span>
                <span className="cj-cluster-text">
                  <span className="cj-cluster-name">{cluster.districtName}</span>
                  <span className="cj-cluster-sub">{clusterSubText(cluster)}</span>
                </span>
              </button>
            </div>
          ))}

          {zoomDistrict && (
            <button
              type="button"
              onClick={() => setZoomDistrict(null)}
              // 상단 헤더(햄버거 + BI) 아래에 둔다 — 두 줄이 겹치면 둘 다 못 누른다.
              className="tap-md absolute left-1/2 top-[68px] z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-surface px-4 py-2 text-note font-bold text-ink-950 shadow-raise ring-[1.5px] ring-ink-950/85 focus-ring"
            >
              <Undo2 size={17} aria-hidden />
              화성시 전체 보기
            </button>
          )}

          {places.map((place) => {
            if (clusteredIds.has(place.id)) return null;
            const rank = rankedIds.indexOf(place.id);
            const isRanked = rank >= 0 && rank < 3;
            const selected = place.id === selectedId;
            const view = markerViewOf(place);
            const x = projector.x(place.lng);
            const y = projector.y(place.lat);
            if (x < -80 || y < -80 || x > size.width + 80 || y > size.height + 80) return null;

            return (
              <div
                key={place.id}
                className="absolute w-max"
                style={{
                  left: x,
                  top: y,
                  // 캡슐 아래 꼬리 끝이 좌표를 가리킨다 — 카카오 버전의 yAnchor:1 과 같은 규칙.
                  transform: 'translate(-50%, -100%)',
                  zIndex: selected ? 60 : isRanked ? 50 - rank : 20 - view.priority,
                }}
              >
                <button
                  type="button"
                  className="cj-marker"
                  // 순위가 있는 마커만 data-rank 를 갖는다.
                  {...(isRanked ? { 'data-rank': String(rank + 1) } : {})}
                  data-tone={view.tone}
                  data-priority={view.priority}
                  data-dim={rankedIds.length > 0 && !isRanked && !selected ? 'true' : 'false'}
                  data-selected={selected ? 'true' : 'false'}
                  data-zoomed="true"
                  data-clustered="false"
                  aria-label={markerAriaLabel(place, view, isRanked ? rank + 1 : null)}
                  onClick={() => onSelect(place.id)}
                >
                  <span className="cj-marker-body">
                    <span className="cj-marker-icon" aria-hidden>
                      {isRanked ? String(rank + 1) : view.glyph}
                    </span>
                    <span className="cj-marker-text">
                      <span className="cj-marker-name">{place.displayName}</span>
                      <span className="cj-marker-status">{view.statusText}</span>
                    </span>
                  </span>
                  <span className="cj-marker-tail" aria-hidden />
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
