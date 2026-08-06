/**
 * 화성특례시 4개 구 경계 데이터 생성 스크립트
 *
 * 원본 데이터
 *   통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)가 공공누리 제1유형(출처표시)으로
 *   개방한 행정동 경계를 vuski/admdongkor(https://github.com/vuski/admdongkor)가 가공한 파일.
 *   가공물 라이선스: CC BY 4.0 / 원자료: 공공누리 제1유형.
 *
 * 사용 방법
 *   1) 원본 파일 다운로드 (약 35MB, 저장소에는 포함하지 않는다)
 *      curl -L -o /tmp/HangJeongDong.geojson \
 *        https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260701/HangJeongDong_ver20260701.geojson
 *   2) node scripts/build-hwaseong-districts.mjs /tmp/HangJeongDong.geojson
 *
 * 하는 일
 *   - 경기도 화성시(4개 구) 행정동 29개만 추출한다.
 *   - 구 단위 폴리곤 union은 계산하지 않는다. 행정동 경계를 그대로 두고 소속 구로 그룹핑만 한다.
 *   - Douglas-Peucker 방식으로 좌표를 단순화하고 소수점 5자리로 반올림한다.
 *   - 지도 축척에서 보이지 않는 아주 작은 섬 링은 제외한다.
 *   - 좌표를 임의로 이동하거나 형태를 바꾸지 않는다.
 */

import { readFileSync, writeFileSync } from 'node:fs';

/** 단순화 허용 오차(도). 위도 37도 기준 약 25~30m. */
const TOLERANCE = 0.0003;
/** 이 값보다 대각선이 짧은 링은 제외한다(도). 약 400m. */
const MIN_RING_SPAN = 0.004;
const PRECISION = 5;

const DISTRICTS = [
  { id: 'manse', sggnm: '화성시만세구', name: '만세구' },
  { id: 'hyohaeng', sggnm: '화성시효행구', name: '효행구' },
  { id: 'byeongjeom', sggnm: '화성시병점구', name: '병점구' },
  { id: 'dongtan', sggnm: '화성시동탄구', name: '동탄구' },
];

function perpendicularDistance([x, y], [x1, y1], [x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(x - x1, y - y1);
  const t = ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (x1 + clamped * dx), y - (y1 + clamped * dy));
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  let maxDistance = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[points.length - 1]];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function roundRing(ring) {
  const factor = 10 ** PRECISION;
  const rounded = [];
  for (const [lng, lat] of ring) {
    const point = [Math.round(lng * factor) / factor, Math.round(lat * factor) / factor];
    const previous = rounded[rounded.length - 1];
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) rounded.push(point);
  }
  return rounded;
}

function ringSpan(ring) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  return Math.hypot(maxLng - minLng, maxLat - minLat);
}

function toPolygons(geometry) {
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates;
  throw new Error(`지원하지 않는 geometry 타입: ${geometry.type}`);
}

/** 링의 면적 가중 중심점. 행정복지센터 위치가 아니라 행정동 경계의 중심점이다. */
function ringCentroid(ring) {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    area += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  area *= 0.5;
  if (area === 0) return ring[0];
  return [Number((cx / (6 * area)).toFixed(6)), Number((cy / (6 * area)).toFixed(6))];
}

function extendBBox(bbox, ring) {
  for (const [lng, lat] of ring) {
    bbox[0] = Math.min(bbox[0], lng);
    bbox[1] = Math.min(bbox[1], lat);
    bbox[2] = Math.max(bbox[2], lng);
    bbox[3] = Math.max(bbox[3], lat);
  }
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('사용법: node scripts/build-hwaseong-districts.mjs <원본 HangJeongDong geojson 경로>');
  process.exit(1);
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const cityBBox = [Infinity, Infinity, -Infinity, -Infinity];
const centroids = [];
let rawPointCount = 0;
let keptPointCount = 0;

const districts = DISTRICTS.map((district) => {
  const features = source.features.filter((feature) => feature.properties.sggnm === district.sggnm);
  if (features.length === 0) throw new Error(`${district.sggnm} 경계를 원본에서 찾지 못했습니다.`);

  const districtBBox = [Infinity, Infinity, -Infinity, -Infinity];
  const areas = features
    .map((feature) => {
      const name = feature.properties.adm_nm.split(' ').pop();
      const polygons = [];
      for (const polygon of toPolygons(feature.geometry)) {
        const rings = [];
        for (const ring of polygon) {
          rawPointCount += ring.length;
          const simplified = roundRing(simplify(ring, TOLERANCE));
          if (simplified.length < 4) continue;
          if (ringSpan(simplified) < MIN_RING_SPAN) continue;
          if (
            simplified[0][0] !== simplified[simplified.length - 1][0] ||
            simplified[0][1] !== simplified[simplified.length - 1][1]
          ) {
            simplified.push(simplified[0]);
          }
          keptPointCount += simplified.length;
          rings.push(simplified);
          extendBBox(districtBBox, simplified);
          extendBBox(cityBBox, simplified);
        }
        if (rings.length > 0) polygons.push(rings);
      }
      const largest = polygons
        .map((rings) => rings[0])
        .sort((a, b) => ringSpan(b) - ringSpan(a))[0];
      centroids.push({ district: district.id, name, center: ringCentroid(largest) });
      return { name, code: feature.properties.adm_cd2, polygons };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  return {
    id: district.id,
    name: district.name,
    sggnm: district.sggnm,
    bbox: districtBBox.map((value) => Number(value.toFixed(PRECISION))),
    areas,
  };
});

const output = {
  meta: {
    title: '화성특례시 4개 구 행정동 경계(단순화)',
    source: '통계청 통계지리정보서비스(SGIS) 행정동 경계 (공공누리 제1유형)',
    processedBy: 'vuski/admdongkor ver20260701 (CC BY 4.0)',
    sourceUrl: 'https://github.com/vuski/admdongkor',
    attribution:
      '본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다.',
    crs: 'WGS84 (EPSG:4326)',
    generatedBy: 'scripts/build-hwaseong-districts.mjs',
    simplification: `Douglas-Peucker tolerance ${TOLERANCE}도, 좌표 소수점 ${PRECISION}자리 반올림, 대각선 ${MIN_RING_SPAN}도 미만 링 제외`,
    note: '구 단위 union을 하지 않고 행정동 경계를 소속 구로 그룹핑한 데이터입니다.',
  },
  bbox: cityBBox.map((value) => Number(value.toFixed(PRECISION))),
  districts,
};

const targetPath = new URL('../src/data/geo/hwaseongDistricts.geo.json', import.meta.url);
writeFileSync(targetPath, `${JSON.stringify(output)}\n`, 'utf8');

console.log(`좌표 수: ${rawPointCount} → ${keptPointCount}`);
console.log(
  districts.map((d) => `${d.name}: 행정동 ${d.areas.length}개`).join(', '),
);
console.log('행정동 경계 중심점 (거점 좌표 산출용):');
console.log(JSON.stringify(centroids, null, 2));
