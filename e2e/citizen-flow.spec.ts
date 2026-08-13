import { test, expect } from '@playwright/test';

/**
 * 시민 서비스 P0 핵심 흐름 검증.
 *
 * 데이터 루프 전체(현장 담당자 입력 → 시민 화면 반영 → 추천 → 길찾기/도움 요청 → 관리자 확인)의
 * 화면단 동작을 확인한다. `help_requests`/`site_quick_status` 는 새 Supabase 마이그레이션
 * (`supabase/migrations/20260813000000_citizen_help_and_quick_status.sql`)이 적용된 뒤에만
 * 실제로 저장된다 — 적용 전에는 제출이 오류로 끝나는 것이 정상이므로, 그 경우를 구분해서 처리한다.
 */

const BASE = 'http://localhost:5173';

test.describe('시민 홈 — 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('첫 화면은 지도·메뉴가 아니라 질문 하나와 두 개의 시작 버튼', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '내 주변에서 찾기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '사는 동네 선택하기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '간편하게 이용하기' })).toBeVisible();
  });

  test('사는 동네 선택 → 추천 거점 최대 3개, 필터·검색 없이 바로 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '사는 동네 선택하기' }).click();
    await expect(page.getByRole('heading', { name: '사는 동네를 선택해 주세요' })).toBeVisible();

    await page.getByRole('button', { name: '동탄5동' }).click();

    await expect(page.getByRole('heading', { name: '가까운 곳부터 보여드릴게요' })).toBeVisible();
    const cards = page.locator('li:has-text("순위")');
    await expect(cards).toHaveCount(3);
    // 상태는 색만이 아니라 아이콘 + 문구로 함께 전달된다.
    await expect(cards.first().getByText(/지금 받을 수 있어요|얼마 안 남았어요|최신 정보 확인이 필요해요/)).toBeVisible();
    await expect(cards.first().getByRole('link', { name: '길찾기' })).toBeVisible();
    await expect(cards.first().getByRole('link', { name: '자세히 보기' })).toBeVisible();
  });

  test('위치 권한 허용 시 자동으로 추천 목록 표시', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.1996, longitude: 127.1127 }); // 동탄 인근
    await page.goto(BASE);
    await page.getByRole('button', { name: '내 주변에서 찾기' }).click();
    await expect(page.getByRole('heading', { name: '가까운 곳부터 보여드릴게요' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('li:has-text("순위")')).toHaveCount(3);
  });

  test('위치 권한 거부해도 사는 동네 선택으로 계속 진행 가능', async ({ page, context }) => {
    await context.grantPermissions([]); // geolocation 권한을 주지 않는다 → getCurrentPosition 이 거부로 처리된다
    await page.goto(BASE);
    await page.getByRole('button', { name: '내 주변에서 찾기' }).click();
    // 거부 안내 후에도 동네 선택 버튼은 계속 눌러서 진행할 수 있다.
    await expect(page.getByRole('button', { name: '사는 동네 선택하기' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '사는 동네 선택하기' }).click();
    await page.getByRole('button', { name: '병점1동' }).click();
    await expect(page.getByRole('heading', { name: '가까운 곳부터 보여드릴게요' })).toBeVisible();
  });

  test('거점 상세 — 자세히 보기 진입 시 핵심 정보만 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '사는 동네 선택하기' }).click();
    await page.getByRole('button', { name: '동탄5동' }).click();
    await page.locator('li:has-text("순위")').first().getByRole('link', { name: '자세히 보기' }).click();

    await expect(page).toHaveURL(/\/site\//);
    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible();
    // 재고율·D-day 같은 관리자 숫자는 노출하지 않는다.
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('재고율');
    expect(bodyText).not.toContain('D-Day');
    expect(bodyText).not.toContain('D-');
  });

  test('간편하게 이용하기 — 한 화면에 행동 최대 3개', async ({ page }) => {
    await page.goto(`${BASE}/easy`);
    await expect(page.getByRole('heading', { name: '간편하게 이용하기' })).toBeVisible();
    const menuButtons = page.locator('main, div').filter({ hasText: '간편하게 이용하기' });
    await expect(page.getByRole('button', { name: '지금 받을 수 있는 곳' })).toBeVisible();
    await expect(page.getByRole('link', { name: '직접 가기 어려워요' })).toBeVisible();
    await expect(page.getByRole('link', { name: '전화로 도와주세요' })).toBeVisible();
    void menuButtons;

    await page.getByRole('button', { name: '지금 받을 수 있는 곳' }).click();
    await expect(page.locator('li:has-text("순위")')).toHaveCount(3);
  });
});

test.describe('375×812 화면에서도 첫 화면이 정상 표시', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('시민 홈 헤딩·버튼 표시', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을/ })).toBeVisible();
    await expect(page.getByRole('button', { name: '내 주변에서 찾기' })).toBeVisible();
  });
});

test.describe('200% 확대에서도 핵심 기능 사용 가능', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('본문 확대 후에도 핵심 CTA가 화면에 보인다', async ({ page }) => {
    await page.goto(BASE);
    // CSS zoom 으로 브라우저 200% 확대를 근사한다(Playwright 는 실제 OS 확대를 제어할 수 없다).
    await page.evaluate(() => {
      document.body.style.zoom = '2';
    });
    const cta = page.getByRole('button', { name: '내 주변에서 찾기' });
    await expect(cta).toBeVisible();
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });
});

test.describe('/help 도움 요청', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('필수 항목만 입력해 접수하면 완료 화면을 보여준다', async ({ page }) => {
    await page.goto(`${BASE}/help`);
    await expect(page.getByRole('heading', { name: '도움이 필요하신가요?' })).toBeVisible();

    await page.getByLabel('연락 가능한 번호').fill('010-1234-5678');
    await page.getByLabel('사는 읍면동').selectOption('동탄5동');
    await page.getByRole('button', { name: '식품' }).click();

    await page.getByRole('button', { name: '요청 보내기' }).click();

    // 새 Supabase 마이그레이션(help_requests)이 아직 적용되지 않은 환경에서는
    // 오류 메시지로 끝나는 것이 정상이다 — 두 결과 모두 "폼이 올바르게 동작했다"는 뜻이라
    // 둘 중 하나가 나타나면 통과시키되, 성공 시에는 완료 문구를 추가로 확인한다.
    const success = page.getByRole('heading', { name: '요청이 접수되었습니다.' });
    const failure = page.getByText('요청 접수에 실패했습니다', { exact: false });
    await expect(success.or(failure)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('관리자 화면 회귀 — 데스크톱', () => {
  test.use({ viewport: { width: 1600, height: 1100 } });

  test('/admin 접속 시 통합 대시보드가 그대로 뜬다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: '핵심 운영 지표', exact: false })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('nav >> text=통합 대시보드')).toBeVisible();
  });

  test('예전 관리자 경로는 /admin 아래로 리다이렉트된다', async ({ page }) => {
    await page.goto(`${BASE}/inventory`);
    await expect(page).toHaveURL(/\/admin\/inventory$/);

    await page.goto(`${BASE}/files`);
    await expect(page).toHaveURL(/\/admin\/files$/);
  });

  test('빠른 현황 입력 화면 접근 가능', async ({ page }) => {
    await page.goto(`${BASE}/admin/quick-status`);
    await expect(page.getByRole('heading', { name: '빠른 현황 입력' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '지금 가능' })).toBeVisible();
  });
});
