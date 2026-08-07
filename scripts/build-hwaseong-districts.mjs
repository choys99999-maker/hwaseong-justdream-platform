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

/** 단순화 허용 오차(도). 위도 37도 기준 약 8~9m. */
const TOLERANCE = 0.0001;
/** 이 값보다 대각선이 짧은 링은 제외한다(도). 약 400m. */
const MIN_RING_SPAN = 0.004;
const PRECISION = 5;
/**
 * focusBBox 에 포함할 폴리곤 면적 비율. 나머지(제부도 등 서해 도서)는 화면 범위에서만 빠지고
 * 폴리곤 데이터에는 그대로 남는다. 0.985 는 만세구 본토(송산면 서쪽 끝)까지 포함하는 값이다.
 */
const FOCUS_AREA_RATIO = 0.985;

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

/** 부호 없는 링 면적(제곱도). 크기 비교용이라 위경도 왜곡은 보정하지 않는다. */
function ringArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) / 2;
}

function pointInRing(ring, [x, y]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** polygons = [[외곽링, 구멍링...], ...] 중 한 곳이라도 점을 품으면 true. */
function pointInPolygons(polygons, point) {
  return polygons.some(
    (rings) => pointInRing(rings[0], point) && !rings.slice(1).some((hole) => pointInRing(hole, point)),
  );
}

/**
 * 구 경계선(union outline).
 *
 * 원본 SGIS 행정동 경계는 인접 행정동끼리 정점을 공유하므로, 같은 구에 속한 모든 링의
 * 무향 간선을 세면 내부 경계는 정확히 2번, 구 외곽은 1번 나타난다. 1번만 나온 간선을
 * 이어 붙이면 폴리곤 클리핑 없이 구 외곽선을 얻는다.
 * 단순화 전 원본 좌표에서 계산해야 정점 공유가 깨지지 않는다.
 */
function dissolveOutline(rings) {
  const edges = new Map();
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i += 1) {
      const a = ring[i];
      const b = ring[i + 1];
      const ka = `${a[0]},${a[1]}`;
      const kb = `${b[0]},${b[1]}`;
      if (ka === kb) continue;
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const entry = edges.get(key);
      if (entry) entry.count += 1;
      else edges.set(key, { a, b, count: 1 });
    }
  }

  const border = [...edges.values()].filter((edge) => edge.count === 1);
  const adjacency = new Map();
  border.forEach((edge, index) => {
    const ka = `${edge.a[0]},${edge.a[1]}`;
    const kb = `${edge.b[0]},${edge.b[1]}`;
    if (!adjacency.has(ka)) adjacency.set(ka, []);
    if (!adjacency.has(kb)) adjacency.set(kb, []);
    adjacency.get(ka).push({ index, to: edge.b });
    adjacency.get(kb).push({ index, to: edge.a });
  });

  const used = new Set();
  const outline = [];
  for (let i = 0; i < border.length; i += 1) {
    if (used.has(i)) continue;
    used.add(i);
    const start = border[i].a;
    const startKey = `${start[0]},${start[1]}`;
    const ring = [start, border[i].b];
    let current = border[i].b;
    while (`${current[0]},${current[1]}` !== startKey) {
      const next = (adjacency.get(`${current[0]},${current[1]}`) ?? []).find(
        (candidate) => !used.has(candidate.index),
      );
      if (!next) break;
      used.add(next.index);
      ring.push(next.to);
      current = next.to;
    }
    if (`${current[0]},${current[1]}` !== startKey) {
      throw new Error('구 외곽선을 닫힌 링으로 잇지 못했습니다. 원본 위상이 깨졌을 수 있습니다.');
    }
    outline.push(ring);
  }
  return outline;
}

/** 여러 링의 면적 가중 중심점. 링 하나의 ringCentroid 를 면적으로 가중 평균한다. */
function areaWeightedCentroid(rings) {
  let weight = 0;
  let cx = 0;
  let cy = 0;
  for (const ring of rings) {
    const area = ringArea(ring);
    const [x, y] = ringCentroid(ring);
    weight += area;
    cx += x * area;
    cy += y * area;
  }
  if (weight === 0) return ringCentroid(rings[0]);
  return [Number((cx / weight).toFixed(6)), Number((cy / weight).toFixed(6))];
}

/**
 * 폴리곤 내부에서 경계로부터 가장 먼 점. 오목한 폴리곤이라 centroid 가 밖으로 나갈 때 쓴다.
 * bbox 격자를 훑어 내부 점 중 경계 최단거리가 최대인 지점을 고른다.
 */
function interiorPoint(rings) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity];
  extendBBox(bbox, rings[0]);
  const steps = 120;
  let best = null;
  let bestDistance = -1;
  for (let i = 0; i < steps; i += 1) {
    for (let j = 0; j < steps; j += 1) {
      const point = [
        bbox[0] + ((bbox[2] - bbox[0]) * (i + 0.5)) / steps,
        bbox[1] + ((bbox[3] - bbox[1]) * (j + 0.5)) / steps,
      ];
      if (!pointInPolygons([rings], point)) continue;
      let distance = Infinity;
      for (const ring of rings) {
        for (let k = 0; k < ring.length - 1; k += 1) {
          distance = Math.min(distance, perpendicularDistance(point, ring[k], ring[k + 1]));
        }
      }
      if (distance > bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
  }
  if (!best) throw new Error('폴리곤 내부점을 찾지 못했습니다.');
  return [Number(best[0].toFixed(6)), Number(best[1].toFixed(6))];
}

const sourcePath = process.argv[2];
if (!sourcePath) {
  console.error('사용법: node scripts/build-hwaseong-districts.mjs <원본 HangJeongDong geojson 경로>');
  process.exit(1);
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const cityBBox = [Infinity, Infinity, -Infinity, -Infinity];
const cityFocusBBox = [Infinity, Infinity, -Infinity, -Infinity];
const centroids = [];
const centerReport = [];
const focusReport = [];
let rawPointCount = 0;
let keptPointCount = 0;
let outlinePointCount = 0;

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

  // 구 외곽선: 단순화 전 원본 링에서 dissolve 한 뒤 같은 기준으로 단순화한다.
  const rawRings = features.flatMap((feature) => toPolygons(feature.geometry).flat());
  const outline = [];
  for (const ring of dissolveOutline(rawRings)) {
    const simplified = roundRing(simplify(ring, TOLERANCE));
    if (simplified.length < 4) continue;
    if (ringSpan(simplified) < MIN_RING_SPAN) continue;
    if (
      simplified[0][0] !== simplified[simplified.length - 1][0] ||
      simplified[0][1] !== simplified[simplified.length - 1][1]
    ) {
      simplified.push(simplified[0]);
    }
    outlinePointCount += simplified.length;
    outline.push(simplified);
  }

  const allPolygons = areas.flatMap((area) => area.polygons);

  // 클러스터 대표점: 구 전체의 면적 가중 중심점. 구 밖으로 나오면 최대 폴리곤의 내부점으로 대체한다.
  let center = areaWeightedCentroid(allPolygons.map((rings) => rings[0]));
  let centerSource = '면적 가중 centroid';
  if (!pointInPolygons(allPolygons, center)) {
    const largest = [...allPolygons].sort((a, b) => ringArea(b[0]) - ringArea(a[0]))[0];
    center = interiorPoint(largest);
    centerSource = '최대 폴리곤 내부점';
  }
  if (!pointInPolygons(allPolygons, center)) {
    throw new Error(`${district.name} 대표점이 구 폴리곤 밖입니다.`);
  }
  centerReport.push({ id: district.id, name: district.name, center, source: centerSource });

  // 확대용 bbox: 면적 기준 상위 폴리곤만으로 만든다. 도서는 데이터에 남기고 화면 범위에서만 뺀다.
  const focusBBox = [Infinity, Infinity, -Infinity, -Infinity];
  const sortedByArea = [...allPolygons].sort((a, b) => ringArea(b[0]) - ringArea(a[0]));
  const totalArea = sortedByArea.reduce((sum, rings) => sum + ringArea(rings[0]), 0);
  let covered = 0;
  let focusCount = 0;
  for (const rings of sortedByArea) {
    if (covered >= totalArea * FOCUS_AREA_RATIO) break;
    covered += ringArea(rings[0]);
    focusCount += 1;
    extendBBox(focusBBox, rings[0]);
  }
  extendBBox(cityFocusBBox, [
    [focusBBox[0], focusBBox[1]],
    [focusBBox[2], focusBBox[3]],
  ]);
  focusReport.push({
    name: district.name,
    kept: focusCount,
    total: allPolygons.length,
    bbox: focusBBox.map((value) => Number(value.toFixed(PRECISION))),
  });

  return {
    id: district.id,
    name: district.name,
    sggnm: district.sggnm,
    bbox: districtBBox.map((value) => Number(value.toFixed(PRECISION))),
    focusBBox: focusBBox.map((value) => Number(value.toFixed(PRECISION))),
    center,
    outline,
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
    note: '행정동 경계를 소속 구로 그룹핑하고, 구 외곽선(outline)은 원본 좌표에서 dissolve 해 별도로 담았습니다.',
  },
  bbox: cityBBox.map((value) => Number(value.toFixed(PRECISION))),
  focusBBox: cityFocusBBox.map((value) => Number(value.toFixed(PRECISION))),
  districts,
};

const targetPath = new URL('../src/data/geo/hwaseongDistricts.geo.json', import.meta.url);
writeFileSync(targetPath, `${JSON.stringify(output)}\n`, 'utf8');

console.log(`좌표 수: ${rawPointCount} → ${keptPointCount} (구 외곽선 ${outlinePointCount} 별도)`);
console.log(
  districts.map((d) => `${d.name}: 행정동 ${d.areas.length}개, 외곽선 링 ${d.outline.length}개`).join(', '),
);
console.log('구 클러스터 대표점 (모두 구 폴리곤 내부 검증됨):');
for (const item of centerReport) {
  console.log(`  ${item.name}: ${item.center[0]}, ${item.center[1]} (${item.source})`);
}
console.log('구 확대용 focusBBox (도서 제외, 데이터에는 도서 유지):');
for (const item of focusReport) {
  console.log(`  ${item.name}: 폴리곤 ${item.kept}/${item.total} 사용 → [${item.bbox.join(', ')}]`);
}
console.log('행정동 경계 중심점 (거점 좌표 산출용):');
console.log(JSON.stringify(centroids, null, 2));
