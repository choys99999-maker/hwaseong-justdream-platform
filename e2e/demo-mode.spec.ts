import { test, expect } from '@playwright/test';

/**
 * 시연 모드 — 발표자가 주소창을 건드리지 않고 버튼만으로
 * 시민 → 현장 담당자 → 시민 → 시청 관리자를 오갈 수 있는지 검증한다.
 * 저장/제출 관련 검증은 `help_requests`/`site_quick_status` 마이그레이션이
 * 적용된 뒤에만 성공 문구가 뜨므로, citizen-flow.spec.ts와 같은
 * "성공 또는 실패 메시지 둘 다 허용" 패턴을 그대로 따른다.
 */

const BASE = 'http://localhost:5173';

test.describe('시연 모드 — 일반 접근에서는 노출되지 않는다', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('시민 홈에는 작은 진입 버튼만 있고, 역할 전환 UI는 기본적으로 숨어 있다', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('button', { name: '시연 모드' })).toBeVisible();
    await expect(page.getByText('시연 중')).toHaveCount(0);
  });

  test('demoMode 없이 /admin에 직접 들어가도 전환바는 뜨지 않는다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: '핵심 운영 지표', exact: false })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText('시연 중')).toHaveCount(0);
  });
});

test.describe('시연 모드 — 390×844 전체 흐름', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('시민 → 현장 담당자 → 시민 → 도움 요청 → 시청 관리자 → 종료, 버튼만으로 전체 흐름', async ({ page }) => {
    await page.goto(BASE);

    // 1) 시연 모드 진입 → 역할 선택 UI
    await page.getByRole('button', { name: '시연 모드' }).click();
    await expect(page.getByRole('heading', { name: '모아드림 시연하기' })).toBeVisible();

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
    await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을/ })).toBeVisible();
    await expect(page.getByText('시연 중')).toBeVisible();

    // 5) 도움 요청 — demoMode가 /help에서도 유지된다
    await page.getByRole('link', { name: '도움 요청하기' }).click();
    await expect(page).toHaveURL(/\/help/);
    await expect(page.getByText('시연 중')).toBeVisible();

    await page.getByLabel('연락 가능한 번호').fill('010-1234-5678');
    await page.getByLabel('사는 읍면동').selectOption({ index: 1 });
    await page.getByRole('button', { name: '식품' }).click();
    await page.getByRole('button', { name: '요청 보내기' }).click();

    const requestSuccess = page.getByRole('heading', { name: '요청이 접수되었습니다.' });
    const requestFailed = page.getByText('요청 접수에 실패했습니다', { exact: false });
    await expect(requestSuccess.or(requestFailed)).toBeVisible({ timeout: 10000 });

    // 6) 시청 관리자로 전환 — "오늘 확인할 요청"에서 확인 가능해야 한다
    await page.getByRole('button', { name: '역할 변경' }).click();
    await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: '핵심 운영 지표', exact: false })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('heading', { name: '오늘 확인할 요청' })).toBeVisible();

    // 7) 새로고침 후에도 시연 모드가 유지된다
    await page.reload();
    await expect(page.getByText('시연 중')).toBeVisible({ timeout: 10000 });

    // 8) 시연 종료 — 역할 전환 UI가 사라지고 시민 홈으로 이동한다
    await page.getByRole('button', { name: '종료' }).click();
    await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을/ })).toBeVisible();
    await expect(page.getByText('시연 중')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '시연 모드' })).toBeVisible();
  });

  test('/easy 로 이동해도 시연 모드와 전환바가 유지된다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '시연 모드' }).click();
    await page.getByRole('button', { name: /시민으로 보기/ }).click();
    await expect(page.getByText('시연 중')).toBeVisible();

    await page.getByRole('link', { name: '간편하게 이용하기' }).click();
    await expect(page).toHaveURL(/\/easy/);
    await expect(page.getByRole('heading', { name: '간편하게 이용하기' })).toBeVisible();
    await expect(page.getByText('시연 중')).toBeVisible();
  });

  test('뒤로가기 후에도 demoMode가 유지된다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '시연 모드' }).click();
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
    await page.getByRole('button', { name: '시연 모드' }).click();
    await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole('button', { name: '시민', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '현장 담당자', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '시청 관리자', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '현장 담당자', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/quick-status/);
  });
});
