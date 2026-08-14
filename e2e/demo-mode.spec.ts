import { test, expect, type Page } from '@playwright/test';

/**
 * 시연 모드 — 발표자가 주소창을 건드리지 않고 버튼만으로
 * 시민 → 현장 담당자 → 시민 → 시청 관리자를 오갈 수 있는지 검증한다.
 *
 * 개편 후 진입로가 바뀌었다. 홈은 지도와 "가까운 곳 찾기" 하나만 남겨야 해서,
 * 시연 진입 버튼을 홈 화면에서 Drawer 맨 아래로 내렸다 — 시민이 쓸 기능이 아니기 때문이다.
 *
 * 저장/제출 검증은 `help_requests`/`site_quick_status` 마이그레이션이 적용된 뒤에만
 * 성공 문구가 뜨므로 "성공 또는 실패 메시지 둘 다 허용" 패턴을 따른다.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

const HOME_HEADING = '가까운 그냥드림을 찾아드릴게요';

async function openDemoSheet(page: Page) {
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
  await page.getByRole('button', { name: '시연 모드' }).click();
  await expect(page.getByRole('heading', { name: '그냥드림 시연하기' })).toBeVisible();
}

test.describe('시연 모드 — 일반 접근에서는 노출되지 않는다', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('시민 홈 자체에는 시연 흔적이 없고, 진입로는 Drawer 안에만 있다', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('button', { name: '시연 모드' })).toHaveCount(0);
    await expect(page.getByText('시연 중')).toHaveCount(0);

    await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
    await expect(page.getByRole('button', { name: '시연 모드' })).toBeVisible();
  });

  test('demoMode 없이 /admin 에 직접 들어가도 전환바는 뜨지 않는다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: '핵심 운영 지표', exact: false })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('시연 중')).toHaveCount(0);
  });
});

test.describe('시연 모드 — 390×844 전체 흐름', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('시민 → 현장 담당자 → 시민 → 도움 요청 → 시청 관리자 → 종료', async ({ page }) => {
    await page.goto(BASE);

    // 1) 시연 모드 진입 → 역할 선택
    await openDemoSheet(page);

    // 2) 현장 담당자로 전환
    await page.getByRole('button', { name: /현장 담당자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin\/quick-status/);
    await expect(page.getByText('시연 중')).toBeVisible();

    // 3) 빠른 상태 저장
    await page.waitForSelector('#qs-site');
    await page.getByRole('button', { name: '지금 가능' }).click();
    await page.getByRole('button', { name: /저장/ }).click();
    const saved = page.getByText('저장 완료');
    const saveFailed = page.getByText('저장에 실패했습니다', { exact: false });
    await expect(saved.or(saveFailed)).toBeVisible({ timeout: 10000 });

    // 4) 모바일 축약 전환바("역할 변경")로 시민 전환
    await page.getByRole('button', { name: '역할 변경' }).click();
    await page.getByRole('button', { name: /시민으로 보기/ }).click();
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible();
    await expect(page.getByText('시연 중')).toBeVisible();

    // 5) 도움 요청 — demoMode 가 /help 에서도 유지된다
    await page.getByRole('button', { name: /도움 요청/ }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByText('시연 중')).toBeVisible();

    await page.getByRole('button', { name: '먹거리' }).click();
    await page.getByLabel('사는 동네').selectOption({ index: 1 });
    await page.getByLabel('연락받을 번호').fill('010-1234-5678');
    await page.getByRole('button', { name: '직접 갈 수 있어요' }).click();
    await page.getByRole('button', { name: '도움 요청 보내기' }).click();

    const requestOk = page.getByRole('heading', { name: '요청을 보냈어요' });
    const requestFailed = page.getByText('요청을 보내지 못했어요', { exact: false });
    await expect(requestOk.or(requestFailed)).toBeVisible({ timeout: 10000 });

    // 6) 시청 관리자로 전환
    await page.getByRole('button', { name: '역할 변경' }).click();
    await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: '핵심 운영 지표', exact: false })).toBeVisible({
      timeout: 10000,
    });
    // "오늘 확인할 요청" 큐는 중앙 저장소가 연결됐을 때만 렌더된다(연결 전에는 그 구역만 조용히 숨긴다).
    // 이 테스트가 검증하는 건 역할 전환이므로 백엔드 유무에 좌우되지 않게 둔다.

    // 7) 새로고침 후에도 유지
    await page.reload();
    await expect(page.getByText('시연 중')).toBeVisible({ timeout: 10000 });

    // 8) 종료 → 시민 홈으로, 전환바 사라짐
    await page.getByRole('button', { name: '종료' }).click();
    await expect(page.getByRole('heading', { name: HOME_HEADING })).toBeVisible();
    await expect(page.getByText('시연 중')).toHaveCount(0);
  });

  test('다른 시민 화면으로 이동해도 시연 모드와 전환바가 유지된다', async ({ page }) => {
    await page.goto(BASE);
    await openDemoSheet(page);
    await page.getByRole('button', { name: /시민으로 보기/ }).click();
    await expect(page.getByText('시연 중')).toBeVisible();

    await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
    await page.getByRole('button', { name: /이용 안내/ }).click();
    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByText('시연 중')).toBeVisible();
  });

  test('뒤로가기 후에도 demoMode 가 유지된다', async ({ page }) => {
    await page.goto(BASE);
    await openDemoSheet(page);
    await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goBack();
    await expect(page.getByText('시연 중')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('시연 모드 — 데스크톱 관리자 전환바', () => {
  test.use({ viewport: { width: 1600, height: 1100 } });

  test('데스크톱에서는 역할 3개가 각각 버튼으로 노출되고 클릭만으로 전환된다', async ({ page }) => {
    await page.goto(BASE);
    await openDemoSheet(page);
    await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole('button', { name: '시민', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '현장 담당자', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '시청 관리자', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '현장 담당자', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/quick-status/);
  });
});
