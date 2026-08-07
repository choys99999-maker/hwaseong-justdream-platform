/**
 * 화성형 그냥드림 25개소 좌표 검증 (개발 시점 실행용).
 *
 *   node scripts/verify-justdream-coordinates.mjs
 *
 * 검증 항목
 *  1. 정확히 25건인가
 *  2. 모두 화성특례시 행정구역(4개 구 폴리곤) 내부인가
 *  3. 각 지역사회보장협의체가 해당 읍면동 폴리곤 내부인가
 *  4. 소속 구가 좌표에서 유도한 값과 일치하는가
 *  5. 좌표가 중복(동일 지점)인 거점이 있는가 — 지도에서 겹쳐 보이므로 보고 대상
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const geo = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/geo/hwaseongDistricts.geo.json'), 'utf8'));

/** 링(외곽 + 구멍) 기준 point-in-polygon. ray casting. */
function inRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** polygons = [ [outerRing, ...holes], ... ] */
function inPolygons(lng, lat, polygons) {
  return polygons.some((rings) => inRing(lng, lat, rings[0]) && !rings.slice(1).some((h) => inRing(lng, lat, h)));
}

/** 좌표가 속한 { district, area } 를 찾는다. 없으면 null. */
export function locate(lng, lat) {
  for (const d of geo.districts) {
    for (const a of d.areas) {
      if (inPolygons(lng, lat, a.polygons)) return { districtId: d.id, districtName: d.name, areaName: a.name };
    }
  }
  return null;
}

/** 폴리곤 경계까지의 최단 거리(m). 경계 근처 오차 판단용. */
function metersToNearestVertex(lng, lat, polygons) {
  let best = Infinity;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [x, y] of ring) {
        const dx = (x - lng) * 88800; // 위도 37도 부근 경도 1도 ≈ 88.8km
        const dy = (y - lat) * 111000;
        best = Math.min(best, Math.hypot(dx, dy));
      }
    }
  }
  return best;
}

export function verify(sites) {
  const problems = [];

  if (sites.length !== 25) problems.push(`[개수] 25건이어야 하는데 ${sites.length}건입니다.`);

  for (const s of sites) {
    if (typeof s.lat !== 'number' || typeof s.lng !== 'number') {
      problems.push(`[좌표없음] ${s.name}`);
      continue;
    }
    const hit = locate(s.lng, s.lat);
    if (!hit) {
      problems.push(`[구역밖] ${s.name} (${s.lat}, ${s.lng}) — 화성시 행정구역 폴리곤 밖입니다.`);
      continue;
    }
    if (s.district && s.district !== hit.districtId) {
      problems.push(`[구불일치] ${s.name} — 데이터 ${s.district} / 좌표 ${hit.districtId}`);
    }
    // 협의체는 이름의 읍면동과 좌표의 읍면동이 같아야 한다.
    if (s.name.includes('지역사회보장협의체')) {
      const town = s.name.replace('지역사회보장협의체', '');
      if (hit.areaName !== town) {
        problems.push(`[읍면동불일치] ${s.name} — 좌표는 ${hit.districtName} ${hit.areaName} 안에 있습니다.`);
      }
    }
  }

  // 좌표 중복(같은 건물) 확인
  const byKey = new Map();
  for (const s of sites) {
    if (typeof s.lat !== 'number') continue;
    const key = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
    byKey.set(key, [...(byKey.get(key) ?? []), s.name]);
  }
  const dupes = [...byKey.entries()].filter(([, names]) => names.length > 1);

  return { problems, dupes, metersToNearestVertex };
}

// 직접 실행 시: 정적 데이터 파일을 읽어 검증한다.
if (process.argv[1] && process.argv[1].endsWith('verify-justdream-coordinates.mjs')) {
  const file = process.argv[2] ?? path.join(ROOT, 'justdream-resolved.json');
  const sites = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { problems, dupes } = verify(sites);

  console.log(`검증 대상 ${sites.length}건\n`);
  for (const s of sites) {
    const hit = typeof s.lat === 'number' ? locate(s.lng, s.lat) : null;
    console.log(
      `${(hit ? 'OK  ' : 'FAIL')} ${s.id} ${s.name.padEnd(18)} ${hit ? `${hit.districtName} ${hit.areaName}`.padEnd(14) : '(구역밖)'.padEnd(14)} ${s.lat}, ${s.lng}`,
    );
  }
  if (dupes.length) {
    console.log('\n좌표 중복(동일 건물 추정):');
    dupes.forEach(([key, names]) => console.log(`  ${key} → ${names.join(' / ')}`));
  }
  console.log(problems.length ? `\n문제 ${problems.length}건:\n  ${problems.join('\n  ')}` : '\n문제 없음.');
  process.exitCode = problems.length ? 1 : 0;
}
