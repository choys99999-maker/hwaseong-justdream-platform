/**
 * 시민 화면 실기기 크기 캡처.
 *
 *   node scripts/capture-citizen.mjs [baseUrl] [outDir]
 *
 * 기본은 390×844(primary target)이고, 홈은 375×812 · 430×932 에서도 함께 찍는다.
 * 카카오맵 SDK 는 API 키(VITE_KAKAO_MAP_JAVASCRIPT_KEY)가 있어야 타일이 뜬다 —
 * 키가 없으면 지도 자리에 대체 안내가 찍히며, 그 상태도 실제 화면이므로 그대로 남긴다.
 */
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const BASE = process.argv[2] ?? 'http://localhost:5173';
const OUT = process.argv[3] ?? 'screenshots';

const PRIMARY = { width: 390, height: 844 };
const SIZES = [
  { width: 375, height: 812, tag: '375x812' },
  { width: 390, height: 844, tag: '390x844' },
  { width: 430, height: 932, tag: '430x932' },
];

async function shoot(page, name) {
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('  ✓', name);
}

const browser = await chromium.launch();

try {
  await mkdir(OUT, { recursive: true });

  // ── 홈은 세 가지 크기 모두 ──────────────────────────────────────────────
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await shoot(page, `home-${size.tag}`);
    await ctx.close();
  }

  // ── 나머지는 primary(390×844) 기준 ────────────────────────────────────
  const ctx = await browser.newContext({ viewport: PRIMARY, deviceScaleFactor: 2 });
  const page = await ctx.newPage();

  // 전체 메뉴
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
  await shoot(page, 'drawer');
  await page.keyboard.press('Escape');

  // 동네 고르기 → 거점 시트 → 다른 곳 목록
  await page.getByRole('button', { name: '동네로 찾기' }).click();
  await shoot(page, 'dong-picker');
  await page.getByRole('button', { name: '동탄5동', exact: true }).click();
  await shoot(page, 'place-sheet');
  await page.getByRole('button', { name: '가까운 다른 곳 보기' }).click();
  await shoot(page, 'nearby-list');

  // 거점 상세 페이지
  await page.goto(`${BASE}/site/justdream-10`, { waitUntil: 'networkidle' });
  await shoot(page, 'place-detail');

  // 도움 요청 — 빈 상태와 다 채운 상태
  await page.goto(`${BASE}/help`, { waitUntil: 'networkidle' });
  await shoot(page, 'help-empty');
  await page.getByRole('button', { name: '먹거리' }).click();
  await page.getByLabel('사는 동네').selectOption('동탄5동');
  await page.getByLabel('연락받을 번호').fill('010-1234-5678');
  await page.getByRole('button', { name: '직접 갈 수 있어요' }).click();
  await shoot(page, 'help-filled');

  // 물품 기부
  await page.goto(`${BASE}/donate`, { waitUntil: 'networkidle' });
  await shoot(page, 'donate');

  // 물품 찾기 — 빈 화면과 결과
  await page.goto(`${BASE}/items`, { waitUntil: 'networkidle' });
  await shoot(page, 'items-empty');
  await page.getByLabel('찾는 물품').fill('라면');
  await shoot(page, 'items-results');

  // 도움 정보
  await page.goto(`${BASE}/info`, { waitUntil: 'networkidle' });
  await shoot(page, 'info-categories');
  await page.getByRole('button', { name: '금융', exact: true }).click();
  await shoot(page, 'info-detail');

  // 말 남기기 · 이용 안내 · 찾아가서드림
  await page.goto(`${BASE}/feedback`, { waitUntil: 'networkidle' });
  await shoot(page, 'feedback');
  await page.goto(`${BASE}/guide`, { waitUntil: 'networkidle' });
  await shoot(page, 'guide');
  await page.goto(`${BASE}/delivery`, { waitUntil: 'networkidle' });
  await shoot(page, 'delivery');

  await ctx.close();
} finally {
  await browser.close();
}

console.log(`\n캡처 완료 → ${OUT}/`);
