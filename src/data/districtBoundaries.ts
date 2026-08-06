import type { BoundaryBBox, DistrictBoundary } from '../types';
import boundaryData from './geo/hwaseongDistricts.geo.json';

/**
 * 화성특례시 4개 구 경계 데이터.
 * 원본·가공 내역·정확도 한계는 `src/data/geo/README.md` 를 참고한다.
 * 구 단위 union은 생성 시점에 하지 않았고, 런타임에서도 계산하지 않는다.
 */
// JSON import 는 number[] 로 넓게 추론되므로 튜플 타입으로 좁혀서 내보낸다.
export const districtBoundaries = boundaryData.districts as unknown as DistrictBoundary[];

/** 화성시 전체 경계 상자 [minLng, minLat, maxLng, maxLat] */
export const HWASEONG_BBOX = boundaryData.bbox as unknown as BoundaryBBox;

export const BOUNDARY_ATTRIBUTION = boundaryData.meta.attribution;

export function getDistrictBBox(id: string | null): BoundaryBBox {
  if (!id) return HWASEONG_BBOX;
  return districtBoundaries.find((district) => district.id === id)?.bbox ?? HWASEONG_BBOX;
}
