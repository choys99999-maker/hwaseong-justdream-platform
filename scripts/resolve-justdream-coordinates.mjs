/**
 * 화성형 그냥드림 25개소 주소·좌표 확정 스크립트 (개발 시점 1회 실행용).
 *
 *   node scripts/resolve-justdream-coordinates.mjs
 *
 * 왜 브라우저를 쓰나
 * - 이 저장소에는 Kakao JavaScript 앱 키만 있고 REST API 키가 없다.
 *   JS 키는 REST(dapi.kakao.com) 인증에 쓸 수 없으므로, 등록된 도메인(localhost:5173)에서
 *   Kakao Maps SDK 의 `services` 라이브러리를 헤드리스 브라우저로 1회 호출한다.
 * - 결과는 `src/data/justdreamLocations.ts` 에 정적으로 저장하고,
 *   애플리케이션 런타임에서는 어떤 검색 API 도 호출하지 않는다.
 *
 * 출력
 * - 후보를 자동으로 하나 고르지 않는다. 기관마다 상위 후보 전체를 JSON 으로 덤프해
 *   사람이 확인한 뒤 정적 데이터에 옮긴다. (애매하면 추측하지 않고 보고한다)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'http://localhost:5173';
/** JupyterHub 프록시 환경에서는 vite base 가 서비스 프리픽스로 잡힌다. (vite.config.ts 와 동일 규칙) */
const BASE = process.env.JUPYTERHUB_SERVICE_PREFIX ? `${process.env.JUPYTERHUB_SERVICE_PREFIX}proxy/absolute/5173/` : '/';
/** vite 가 public/ 을 루트로 서빙한다. Kakao 플랫폼에 등록된 도메인이라야 SDK 가 뜬다. */
const PAGE_FILE = path.join(ROOT, 'public', '__geocode.html');
const OUT_FILE = process.argv[2] ?? path.join(ROOT, 'justdream-candidates.json');

function readJsKey() {
  for (const file of ['.env.local', '.env']) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/^VITE_KAKAO_MAP_JAVASCRIPT_KEY=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('VITE_KAKAO_MAP_JAVASCRIPT_KEY 를 .env.local 에서 찾지 못했습니다.');
}

/** 시드에서 기관명만 뽑아 온다. (source of truth 파일을 그대로 파싱) */
function readSeeds() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/justdream_sites_25.ts'), 'utf8');
  const seeds = [];
  for (const line of src.split('\n')) {
    const m = line.match(/id: '([^']+)'.*?name: '([^']+)'.*?displayName: '([^']+)'.*?category: '([^']+)'/);
    if (m) seeds.push({ id: m[1], name: m[2], displayName: m[3], category: m[4] });
  }
  return seeds;
}

/**
 * 기관별 검색어 목록. 앞쪽이 우선순위가 높다.
 * 협의체는 운영 위치인 "해당 읍면동 행정복지센터" 를 찾는다.
 */
function queriesFor(seed) {
  if (seed.category === '복지기관') {
    const bare = seed.name.replace(/^화성시/, '');
    return [seed.name, `화성시 ${bare}`, bare];
  }
  const town = seed.name.replace('지역사회보장협의체', '');
  return [
    `화성시 ${town}행정복지센터`,
    `${town}행정복지센터`,
    `화성시 ${town}주민센터`,
    `${town}사무소`,
  ];
}

const PAGE_HTML = (key) => `<!doctype html>
<html><head><meta charset="utf-8"><title>geocode</title>
<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}&libraries=services&autoload=false"></script>
</head><body><script>
  window.__ready = false;
  kakao.maps.load(function () { window.__ready = true; });
  window.__search = function (query) {
    return new Promise(function (resolve) {
      new kakao.maps.services.Places().keywordSearch(query, function (data, status) {
        if (status !== kakao.maps.services.Status.OK) return resolve({ status: String(status), results: [] });
        resolve({ status: 'OK', results: data.slice(0, 8).map(function (d) {
          return { name: d.place_name, category: d.category_name, road: d.road_address_name,
                   jibun: d.address_name, phone: d.phone, id: d.id,
                   lat: Number(d.y), lng: Number(d.x) };
        }) });
      });
    });
  };
</script></body></html>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const key = readJsKey();
const seeds = readSeeds();
if (seeds.length !== 25) throw new Error(`시드 25건이어야 합니다. 실제: ${seeds.length}`);

fs.writeFileSync(PAGE_FILE, PAGE_HTML(key));
console.log(`임시 페이지 생성: ${PAGE_FILE}`);

const browser = await chromium.launch();
const out = [];
try {
  const page = await browser.newPage();
  page.on('console', (m) => m.type() === 'error' && console.log('  [page error]', m.text().slice(0, 160)));
  await page.goto(`${ORIGIN}${BASE}__geocode.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ready === true, { timeout: 20000 });
  console.log('Kakao services SDK 로드 완료\n');

  for (const seed of seeds) {
    const attempts = [];
    for (const query of queriesFor(seed)) {
      const res = await page.evaluate((q) => window.__search(q), query);
      attempts.push({ query, ...res });
      await sleep(250);
      // 화성시 안에서 결과가 나오면 더 넓은 질의는 생략한다.
      if (res.results.some((r) => `${r.road}${r.jibun}`.includes('화성시'))) break;
    }
    out.push({ ...seed, attempts });
    const hits = attempts.flatMap((a) => a.results).filter((r) => `${r.road}${r.jibun}`.includes('화성시'));
    console.log(`${seed.id} ${seed.name} → 화성시 후보 ${hits.length}건${hits[0] ? ` | ${hits[0].name} / ${hits[0].road || hits[0].jibun}` : ''}`);
  }
} finally {
  await browser.close();
  fs.rmSync(PAGE_FILE, { force: true });
  console.log(`\n임시 페이지 삭제: ${PAGE_FILE}`);
}

fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 2));
console.log(`후보 덤프: ${OUT_FILE}`);
