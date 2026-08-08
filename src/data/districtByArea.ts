import type { DistrictId } from '../types';
import { districtBoundaries } from './districtBoundaries';

/**
 * 읍면동 이름 → 소속 구.
 *
 * 중앙 DB(`organizations`)는 읍면동 단위로 자료를 받고, main 화면은 4개 구 단위로 보여준다.
 * 그 사이를 잇는 유일한 지점이다.
 *
 * 매핑표를 손으로 적지 않고 `hwaseongDistricts.geo.json` 의 행정동 → 구 소속을 그대로 쓴다.
 * (SGIS 행정동 경계 ver20260701, 지도 폴리곤과 같은 원천이라 지도와 집계가 어긋나지 않는다)
 * 파일명·업로드 내용에서 지역명을 추론하지 않는다.
 */
const DISTRICT_BY_AREA: Record<string, DistrictId> = Object.fromEntries(
  districtBoundaries.flatMap((district) =>
    district.areas.map((area) => [area.name, district.id]),
  ),
);

/** 읍면동 이름으로 소속 구를 찾는다. 경계 데이터에 없는 이름이면 null. */
export function districtOfArea(areaName: string): DistrictId | null {
  return DISTRICT_BY_AREA[areaName.trim()] ?? null;
}

/** 읍면동 단위 행을 소속 구별로 묶는다. 구를 알 수 없는 행은 버리지 않고 따로 돌려준다. */
export function groupByDistrict<T>(
  rows: T[],
  areaNameOf: (row: T) => string,
): { byDistrict: Map<DistrictId, T[]>; unmatched: T[] } {
  const byDistrict = new Map<DistrictId, T[]>();
  const unmatched: T[] = [];

  for (const row of rows) {
    const id = districtOfArea(areaNameOf(row));
    if (!id) {
      unmatched.push(row);
      continue;
    }
    const list = byDistrict.get(id);
    if (list) list.push(row);
    else byDistrict.set(id, [row]);
  }

  return { byDistrict, unmatched };
}
