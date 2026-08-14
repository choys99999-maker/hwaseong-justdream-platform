import type { BoundaryBBox, DistrictBoundary } from '../types';
import boundaryData from './geo/hwaseongDistricts.geo.json';

/**
 * 화성특례시 4개 구 경계 데이터.
 * 원본·가공 내역·정확도 한계는 `src/data/geo/README.md` 를 참고한다.
 * 구 단위 union은 생성 시점에 하지 않았고, 런타임에서도 계산하지 않는다.
 */
// JSON import 는 number[] 로 넓게 추론되므로 튜플 타입으로 좁혀서 내보낸다.
export const districtBoundaries = boundaryData.districts as unknown as DistrictBoundary[];

/** 화성시 전체 경계 상자 [minLng, minLat, maxLng, maxLat]. 서해 도서를 모두 포함한다. */
export const HWASEONG_BBOX = boundaryData.bbox as unknown as BoundaryBBox;

/** 서해 도서를 제외한 본토 중심 범위. 화면을 맞출 때는 이 값을 쓴다. */
export const HWASEONG_FOCUS_BBOX = boundaryData.focusBBox as unknown as BoundaryBBox;

export const BOUNDARY_ATTRIBUTION = boundaryData.meta.attribution;

/** 지도 확대 범위. 도서까지 넣으면 화면 대부분이 바다가 되므로 focusBBox 를 쓴다. */
export function getDistrictBBox(id: string | null): BoundaryBBox {
  if (!id) return HWASEONG_FOCUS_BBOX;
  return districtBoundaries.find((district) => district.id === id)?.focusBBox ?? HWASEONG_FOCUS_BBOX;
}

// ── 좌표 → 행정구역 조회 ────────────────────────────────────────────

export interface AreaLookup {
  districtId: string;
  districtName: string;
  areaName: string;
  areaCode: string;
}

/** 링 하나에 대한 ray-casting 내부 판정. 링은 `[lng, lat]` 순서다. */
function pointInRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * 좌표가 어느 읍·면·동에 속하는지 실제 경계 폴리곤으로 판정한다.
 * 주소 문자열 파싱이 아니라 GIS 경계를 쓰므로, 주소 표기가 달라져도 결과가 흔들리지 않는다.
 * 폴리곤의 첫 링은 외곽선, 나머지는 구멍이다 — 구멍 안이면 그 구역이 아니다.
 */
export function findAreaByPoint(lat: number, lng: number): AreaLookup | null {
  for (const district of districtBoundaries) {
    for (const area of district.areas) {
      for (const polygon of area.polygons) {
        const [outer, ...holes] = polygon;
        if (!outer || !pointInRing(lng, lat, outer)) continue;
        if (holes.some((hole) => pointInRing(lng, lat, hole))) continue;
        return {
          districtId: district.id,
          districtName: district.name,
          areaName: area.name,
          areaCode: area.code,
        };
      }
    }
  }
  return null;
}
