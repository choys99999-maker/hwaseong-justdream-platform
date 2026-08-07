import { test, expect } from '@playwright/test';

/**
 * 화성시 거점 운영 지도 — Task 2 검증
 *
 * 검증 항목
 * 1. 초기 필터 카운터 "전체 39곳" 표시
 * 2. 사업 유형 필터 적용 시 "39곳 중 N곳 표시"로 변경
 * 3. 시설 유형·운영 상태 필터 조합 동작
 * 4. 카카오 지도 로드 후 .gj-marker 요소 39개 생성
 * 5. 마커 클릭 → 거점 상세 패널(이름·시설유형·주요품목·읍면동 이동 버튼) 표시
 * 6. 읍면동 대시보드 링크 href 가 /regions/:districtId 형식과 일치
 * 7. 동시 운영 장소(우정읍 등 4곳) 마커 중복 없음 (총 39개 유지)
 * 8. /regions/:districtId 라우팅 실제 동작
 */

const BASE = 'http://localhost:5173';

test.describe('운영 거점 지도 — 39곳 마커 및 필터', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    // 대시보드가 렌더링될 때까지 대기
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });
  });

  test('초기 필터 카운터에 전체 39곳 표시', async ({ page }) => {
    const counter = page.locator('[aria-live="polite"]');
    await expect(counter).toHaveText('전체 39곳');
  });

  test('사업 유형 필터 — 화성형 선택 시 카운터 변경', async ({ page }) => {
    await page.selectOption('[aria-label="사업 유형 필터"]', 'HWASEONG');
    const counter = page.locator('[aria-live="polite"]');
    // 화성형 사이트 = 38개 (national-only 푸드뱅크 1곳 제외)
    await expect(counter).toHaveText('39곳 중 38곳 표시');
  });

  test('사업 유형 필터 — 국가형 선택 시 5곳 표시', async ({ page }) => {
    await page.selectOption('[aria-label="사업 유형 필터"]', 'NATIONAL');
    const counter = page.locator('[aria-live="polite"]');
    // 국가형: 동시운영 4곳 + 푸드뱅크 1곳 = 5곳
    await expect(counter).toHaveText('39곳 중 5곳 표시');
  });

  test('사업 유형 필터 — 동시 운영 선택 시 4곳 표시', async ({ page }) => {
    await page.selectOption('[aria-label="사업 유형 필터"]', 'BOTH');
    const counter = page.locator('[aria-live="polite"]');
    await expect(counter).toHaveText('39곳 중 4곳 표시');
  });

  test('시설 유형 필터 — 행정복지센터 선택', async ({ page }) => {
    await page.selectOption('[aria-label="시설 유형 필터"]', '행정복지센터');
    const counter = page.locator('[aria-live="polite"]');
    // 행정복지센터 = 만세9 + 효행4 + 병점8 + 동탄8 = 29곳
    await expect(counter).toHaveText('39곳 중 29곳 표시');
  });

  test('운영 상태 필터 — 부족 선택', async ({ page }) => {
    await page.selectOption('[aria-label="운영 상태 필터"]', 'shortage');
    const counter = page.locator('[aria-live="polite"]');
    const text = await counter.textContent();
    expect(text).toMatch(/^39곳 중 \d+곳 표시$/);
    // shortage 사이트가 최소 1개는 있어야 함
    const match = text?.match(/39곳 중 (\d+)곳 표시/);
    expect(Number(match?.[1])).toBeGreaterThan(0);
  });

  test('필터 초기화 — 전체로 돌아가면 39곳 복원', async ({ page }) => {
    await page.selectOption('[aria-label="사업 유형 필터"]', 'NATIONAL');
    await page.selectOption('[aria-label="사업 유형 필터"]', 'ALL');
    const counter = page.locator('[aria-live="polite"]');
    await expect(counter).toHaveText('전체 39곳');
  });
});

test.describe('카카오 지도 마커 렌더링', () => {
  test('지도 로드 후 .gj-marker 39개 생성 및 중복 없음', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    // 카카오 SDK가 로드되고 마커가 생성될 때까지 대기 (최대 15초)
    let markerCount = 0;
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('.gj-marker').length === 39,
        { timeout: 15000 },
      );
      markerCount = await page.locator('.gj-marker').count();
    } catch {
      // SDK 로드 실패(네트워크 제한 등)는 스킵
      markerCount = await page.locator('.gj-marker').count();
      test.skip(markerCount === 0, '카카오 SDK 미로드 — 마커 검증 스킵');
    }

    expect(markerCount).toBe(39);
  });

  test('사업 유형=동시운영 필터 적용 후 마커 4개만 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    // 마커가 로드될 때까지 대기
    const hasMarkers = await page
      .waitForFunction(() => document.querySelectorAll('.gj-marker').length > 0, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!hasMarkers, '카카오 SDK 미로드 — 마커 검증 스킵');

    await page.selectOption('[aria-label="사업 유형 필터"]', 'BOTH');
    // 가시성 변경이 반영될 때까지 잠시 대기
    await page.waitForTimeout(500);

    // CustomOverlay는 setMap(null)로 DOM에서 제거됨 — 남은 것이 표시 중인 마커
    const totalMarkers = await page.locator('.gj-marker').count();
    expect(totalMarkers).toBe(4);
  });
});

test.describe('거점 상세 패널 — 마커 클릭', () => {
  test('마커 클릭 시 상세 패널에 필수 정보 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    const hasMarkers = await page
      .waitForFunction(() => document.querySelectorAll('.gj-marker').length > 0, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!hasMarkers, '카카오 SDK 미로드 — 마커 클릭 검증 스킵');

    // 첫 번째 마커 클릭
    const firstMarker = page.locator('.gj-marker').first();
    await firstMarker.click();

    // 상세 패널에 주요 품목 행 표시 확인
    await expect(page.locator('text=주요 품목')).toBeVisible({ timeout: 5000 });

    // 읍면동 현황 보기 링크 존재 확인
    const regionLink = page.locator('a:has-text("현황 보기")');
    await expect(regionLink).toBeVisible();

    // href가 /regions/로 시작하는지 확인
    const href = await regionLink.getAttribute('href');
    expect(href).toMatch(/^\/regions\/(manse|hyohaeng|byeongjeom|dongtan)$/);
  });

  test('읍면동 현황 보기 링크가 실제 라우트로 이동', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    const hasMarkers = await page
      .waitForFunction(() => document.querySelectorAll('.gj-marker').length > 0, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!hasMarkers, '카카오 SDK 미로드 — 네비게이션 검증 스킵');

    await page.locator('.gj-marker').first().click();
    const regionLink = page.locator('a:has-text("현황 보기")');
    await expect(regionLink).toBeVisible({ timeout: 5000 });
    await regionLink.click();

    // /regions/:regionId 경로로 이동했는지 확인
    await expect(page).toHaveURL(/\/regions\/(manse|hyohaeng|byeongjeom|dongtan)/, { timeout: 5000 });
  });
});

test.describe('/regions/:districtId 라우팅 직접 검증', () => {
  const districts = ['manse', 'hyohaeng', 'byeongjeom', 'dongtan'] as const;

  for (const district of districts) {
    test(`/regions/${district} 페이지 접근 가능`, async ({ page }) => {
      await page.goto(`${BASE}/regions/${district}`);
      // 404 또는 리다이렉트 없이 페이지 로드 확인
      await expect(page).not.toHaveURL('/');
      // 지역 정보가 포함된 헤딩 또는 콘텐츠 확인
      await page.waitForLoadState('domcontentloaded');
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('페이지를 찾을 수 없습니다');
    });
  }
});
