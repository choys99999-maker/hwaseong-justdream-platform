import { test, expect } from '@playwright/test';

/**
 * 화성시 거점 운영 지도 검증
 *
 * 기대값의 근거는 `src/data/justdream_sites_25.ts` (기관명 source of truth, 25건) 다.
 * 지도 마커·필터 카운터는 모두 이 시드에서 파생되므로 시드가 바뀌면 아래 숫자도 함께 고쳐야 한다.
 *   - 전체 25곳 = 복지기관 9 + 지역사회보장협의체 16
 *   - 시설유형: 행정복지센터 16 · 복지관 9 · 푸드뱅크·기타 0
 *
 * 검증 항목
 * 1. 초기 필터 카운터 "전체 25곳" 표시
 * 2. 시설 유형·운영 상태 필터 적용 시 "25곳 중 N곳" 으로 변경
 * 3. 카카오 지도 로드 후 .gj-marker 요소 25개 생성 (동일 좌표 기관도 마커는 각각)
 * 4. 필터 적용 시 마커 수가 카운터와 함께 줄어듦
 * 5. 마커 클릭 → 거점 상세 패널(주요 품목·읍면동 이동 버튼) 표시
 * 6. 읍면동 대시보드 링크 href 가 /regions/:districtId 형식과 일치
 * 7. /regions/:districtId 라우팅 실제 동작
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/**
 * 개별 거점 마커는 지도 레벨이 CLUSTER_ZOOM_THRESHOLD(10) 미만일 때만 그려진다.
 * 그 이상으로 축소되면 구 단위 요약 원(.gj-cluster)만 남는 것이 의도된 동작이다.
 * 기본 뷰포트(1280x720)에서는 지도 영역이 좁아(635x600) 화성시 전체를 담을 때 레벨이 10 이상이 되어
 * .gj-marker 가 하나도 없다. 실제 사용 환경(데스크톱 관제 화면)에 맞춰 넓은 뷰포트로 고정한다.
 */
test.use({ viewport: { width: 1600, height: 1100 } });

/** 확정 시드 기준 전체 거점 수 */
const TOTAL_SITES = 25;
/** 시설유형 = 행정복지센터 (지역사회보장협의체 16곳의 운영 위치) */
const ADMIN_CENTER_SITES = 16;
/** 시설유형 = 복지관 (복지기관 9곳) */
const WELFARE_CENTER_SITES = 9;

/**
 * 필터 바의 거점 수 카운터.
 * 지도 로딩 오버레이(KakaoDistrictMap)에도 aria-live="polite" 가 붙어 있어서
 * 문서 전체에서 찾으면 로딩 중 두 개가 잡힌다(strict mode 위반). 필터 바 안으로 한정한다.
 */
function counterOf(page: import('@playwright/test').Page) {
  return page.locator('[aria-label="지도 필터"] [aria-live="polite"]');
}

/**
 * 지도가 결판날 때까지(마커가 그려지거나, SDK 로드 실패로 로딩 오버레이가 걷힐 때까지)
 * 기다린 뒤 마커 수를 돌려준다. 0 이면 카카오 SDK 를 못 불러온 것이다.
 *
 * `polling: 1000` 이 중요하다. 기본값인 rAF 폴링은 SDK script 가 응답을 기다리며
 * 메인 스레드를 붙잡고 있는 동안 돌지 못해서, 지정한 timeout 보다 훨씬 늦게(관측상 15s → 34s)
 * 풀린다. 그 사이 테스트 전체 타임아웃이 먼저 터져 skip 대신 fail 로 끝난다.
 */
async function settledMarkerCount(page: import('@playwright/test').Page): Promise<number> {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll('.gj-marker').length > 0 ||
        !document.body.innerText.includes('지도를 불러오는 중입니다'),
      undefined,
      { timeout: 45000, polling: 1000 },
    )
    .catch(() => {
      /* 결판이 안 나면 아래에서 0 으로 읽혀 skip 된다 */
    });
  return page.locator('.gj-marker').count();
}

test.describe(`운영 거점 지도 — ${TOTAL_SITES}곳 마커 및 필터`, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    // 대시보드가 렌더링될 때까지 대기
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });
  });

  test(`초기 필터 카운터에 전체 ${TOTAL_SITES}곳 표시`, async ({ page }) => {
    const counter = counterOf(page);
    await expect(counter).toHaveText(`전체 ${TOTAL_SITES}곳`);
  });

  test('사업 유형 필터 — 화성형 선택 시 전체 유지', async ({ page }) => {
    await page.selectOption('[aria-label="사업 유형 필터"]', 'HWASEONG');
    const counter = counterOf(page);
    // 확정 시드 25곳은 전부 화성형이라 걸러지는 거점이 없다.
    await expect(counter).toHaveText(`전체 ${TOTAL_SITES}곳`);
  });

  test(`시설 유형 필터 — 행정복지센터 ${ADMIN_CENTER_SITES}곳`, async ({ page }) => {
    await page.selectOption('[aria-label="시설 유형 필터"]', '행정복지센터');
    const counter = counterOf(page);
    await expect(counter).toHaveText(`${TOTAL_SITES}곳 중 ${ADMIN_CENTER_SITES}곳`);
  });

  test(`시설 유형 필터 — 복지관 ${WELFARE_CENTER_SITES}곳`, async ({ page }) => {
    await page.selectOption('[aria-label="시설 유형 필터"]', '복지관');
    const counter = counterOf(page);
    await expect(counter).toHaveText(`${TOTAL_SITES}곳 중 ${WELFARE_CENTER_SITES}곳`);
  });

  test('운영 상태 필터 — 부족 선택', async ({ page }) => {
    await page.selectOption('[aria-label="운영 상태 필터"]', 'shortage');
    const counter = counterOf(page);
    const text = await counter.textContent();
    expect(text).toMatch(new RegExp(`^${TOTAL_SITES}곳 중 \\d+곳$`));
    // shortage 사이트가 최소 1개는 있어야 함
    const match = text?.match(new RegExp(`${TOTAL_SITES}곳 중 (\\d+)곳`));
    expect(Number(match?.[1])).toBeGreaterThan(0);
  });

  test(`필터 초기화 — 전체로 돌아가면 ${TOTAL_SITES}곳 복원`, async ({ page }) => {
    await page.selectOption('[aria-label="시설 유형 필터"]', '복지관');
    await page.selectOption('[aria-label="시설 유형 필터"]', 'ALL');
    const counter = counterOf(page);
    await expect(counter).toHaveText(`전체 ${TOTAL_SITES}곳`);
  });
});

test.describe('카카오 지도 마커 렌더링', () => {
  test(`지도 로드 후 .gj-marker ${TOTAL_SITES}개 생성 및 중복 없음`, async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    const markerCount = await settledMarkerCount(page);
    // SDK 로드 실패(네트워크 제한 등)는 스킵
    test.skip(markerCount === 0, '카카오 SDK 미로드 — 마커 검증 스킵');

    expect(markerCount).toBe(TOTAL_SITES);
  });

  test(`시설유형=복지관 필터 적용 후 마커 ${WELFARE_CENTER_SITES}개만 표시`, async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    // 마커가 로드될 때까지 대기
    test.skip((await settledMarkerCount(page)) === 0, '카카오 SDK 미로드 — 마커 검증 스킵');

    await page.selectOption('[aria-label="시설 유형 필터"]', '복지관');
    // 가시성 변경이 반영될 때까지 잠시 대기
    await page.waitForTimeout(500);

    // CustomOverlay는 setMap(null)로 DOM에서 제거됨 — 남은 것이 표시 중인 마커
    const totalMarkers = await page.locator('.gj-marker').count();
    expect(totalMarkers).toBe(WELFARE_CENTER_SITES);
  });
});

test.describe('거점 상세 패널 — 마커 클릭', () => {
  test('마커 클릭 시 상세 패널에 필수 정보 표시', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    test.skip((await settledMarkerCount(page)) === 0, '카카오 SDK 미로드 — 마커 클릭 검증 스킵');

    // 첫 번째 마커 클릭
    const firstMarker = page.locator('.gj-marker').first();
    await firstMarker.click();

    // 상세 패널에 주요 품목 행 표시 확인
    await expect(page.locator('text=주요 품목')).toBeVisible({ timeout: 5000 });

    // 거점 상세로 가는 CTA 확인 — 지도에서 고른 거점을 실제로 처리하는 화면이다
    const detailLink = page.locator('a:has-text("거점 상세 열기")');
    await expect(detailLink).toBeVisible();
    expect(await detailLink.getAttribute('href')).toMatch(/\/admin\/sites\/justdream-\d+$/);

    // 소속 구 현황 링크도 함께 남아 있다
    const regionLink = page.locator('a:has-text("소속 구 현황 보기")');
    const href = await regionLink.getAttribute('href');
    expect(href).toMatch(/\/admin\/regions\/(manse|hyohaeng|byeongjeom|dongtan)/);
  });

  test('거점 상세 열기 링크가 실제 라우트로 이동', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });

    test.skip((await settledMarkerCount(page)) === 0, '카카오 SDK 미로드 — 네비게이션 검증 스킵');

    await page.locator('.gj-marker').first().click();
    const detailLink = page.locator('a:has-text("거점 상세 열기")');
    await expect(detailLink).toBeVisible({ timeout: 5000 });
    await detailLink.click();

    await expect(page).toHaveURL(/\/admin\/sites\/justdream-\d+/, { timeout: 5000 });
    await expect(page.getByRole('tab', { name: '빠른 입력' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('/admin/regions/:districtId 라우팅 직접 검증', () => {
  const districts = ['manse', 'hyohaeng', 'byeongjeom', 'dongtan'] as const;

  for (const district of districts) {
    test(`/admin/regions/${district} 페이지 접근 가능`, async ({ page }) => {
      await page.goto(`${BASE}/admin/regions/${district}`);
      // 404 또는 리다이렉트 없이 페이지 로드 확인
      await expect(page).not.toHaveURL('/');
      // 지역 정보가 포함된 헤딩 또는 콘텐츠 확인
      await page.waitForLoadState('domcontentloaded');
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toContain('페이지를 찾을 수 없습니다');
    });

    test(`예전 경로 /regions/${district} 는 /admin/regions/${district} 로 리다이렉트`, async ({ page }) => {
      await page.goto(`${BASE}/regions/${district}`);
      await expect(page).toHaveURL(new RegExp(`/admin/regions/${district}$`));
    });
  }
});
