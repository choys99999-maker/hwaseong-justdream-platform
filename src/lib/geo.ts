/** 위경도 좌표 1점. */
export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** 두 좌표 사이 직선거리(km). 도보·차량 경로 거리가 아니라 정렬·표시용 근사값이다. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * "300m 거리" / "1.2km 거리". 소요 시간은 실제 경로 데이터가 없어 표시하지 않는다.
 * 100m 단위로 반올림한다 — GPS 오차, 동네 선택 시 근사 중심좌표 둘 다 미터 단위
 * 정밀도를 보장하지 못하므로 "1m 거리" 같은 거짓 정밀도를 보여주지 않는다.
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(100, Math.round((km * 1000) / 100) * 100)}m 거리`;
  return `${km.toFixed(1)}km 거리`;
}

/** 카카오맵 앱/웹에서 길찾기를 여는 딥링크. 자체 경로 안내 기능은 없다 — 카카오맵에 위임한다. */
export function kakaoDirectionsUrl(name: string, dest: LatLng): string {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${dest.lat},${dest.lng}`;
}

/** 카카오맵에서 해당 위치를 보기만 할 때 쓰는 딥링크(길찾기 아님). */
export function kakaoMapViewUrl(name: string, at: LatLng): string {
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${at.lat},${at.lng}`;
}
