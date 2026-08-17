import type { BoundaryBBox } from '../types';

/**
 * 외부 지도 SDK 없이 화성시 경계를 그리기 위한 최소 투영.
 *
 * 화성시는 위도 37° 부근이고 남북으로 0.3° 밖에 안 되므로 등장방형(equirectangular) 투영으로
 * 충분하다. 다만 경도 1° 가 위도 1° 보다 짧다는 점(≈ cos(위도))만 보정하지 않으면 지도가
 * 동서로 늘어나 화성시 모양이 무너진다.
 */

/** 화면 좌표 변환기. `k` 는 위도 1° 당 픽셀 수다. */
export interface MapCamera {
  centerLng: number;
  centerLat: number;
  /** 위도 1° 당 픽셀 수. 경도는 여기에 cos(centerLat) 를 곱한 값이 적용된다. */
  k: number;
}

export interface Projector {
  x(lng: number): number;
  y(lat: number): number;
  /** 화면 좌표 → 경위도. 드래그 이동 계산에 쓴다. */
  lng(x: number): number;
  lat(y: number): number;
}

function lngScale(centerLat: number): number {
  return Math.cos((centerLat * Math.PI) / 180);
}

export function createProjector(camera: MapCamera, width: number, height: number): Projector {
  const kx = camera.k * lngScale(camera.centerLat);
  return {
    x: (lng) => width / 2 + (lng - camera.centerLng) * kx,
    y: (lat) => height / 2 - (lat - camera.centerLat) * camera.k,
    lng: (x) => camera.centerLng + (x - width / 2) / kx,
    lat: (y) => camera.centerLat - (y - height / 2) / camera.k,
  };
}

/** bbox 가 padding 을 남기고 화면에 꽉 차도록 카메라를 계산한다. */
export function cameraForBBox(
  bbox: BoundaryBBox,
  width: number,
  height: number,
  padding = 16,
): MapCamera {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;

  const spanLng = Math.max(maxLng - minLng, 1e-6);
  const spanLat = Math.max(maxLat - minLat, 1e-6);
  const usableW = Math.max(width - padding * 2, 1);
  const usableH = Math.max(height - padding * 2, 1);

  const k = Math.min(usableW / (spanLng * lngScale(centerLat)), usableH / spanLat);
  return { centerLng, centerLat, k };
}

/** 점 목록을 감싸는 bbox. 점이 하나뿐이면 `minSpan` 만큼 펼쳐 최대 배율에 붙지 않게 한다. */
export function bboxOfPoints(
  points: Array<{ lat: number; lng: number }>,
  minSpan = 0.01,
): BoundaryBBox | null {
  if (points.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const p of points) {
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
  }
  if (maxLng - minLng < minSpan) {
    const c = (minLng + maxLng) / 2;
    minLng = c - minSpan / 2;
    maxLng = c + minSpan / 2;
  }
  if (maxLat - minLat < minSpan) {
    const c = (minLat + maxLat) / 2;
    minLat = c - minSpan / 2;
    maxLat = c + minSpan / 2;
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** GeoJSON 링(경위도 배열)을 SVG path 문자열로 바꾼다. 여러 링은 구멍으로 이어 붙인다. */
export function ringsToPath(rings: Array<Array<[number, number]>>, projector: Projector): string {
  let d = '';
  for (const ring of rings) {
    if (ring.length === 0) continue;
    ring.forEach(([lng, lat], index) => {
      const x = projector.x(lng).toFixed(1);
      const y = projector.y(lat).toFixed(1);
      d += `${index === 0 ? 'M' : 'L'}${x} ${y}`;
      if (index < ring.length - 1) d += ' ';
    });
    d += 'Z';
  }
  return d;
}
