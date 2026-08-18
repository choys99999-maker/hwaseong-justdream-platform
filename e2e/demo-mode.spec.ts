import { test, expect } from '@playwright/test';

/**
 * 역할 전환 UI.
 *
 * 예전에는 상단에 "시민·현장 담당자·시청 관리자" pill 버튼이 항상 떠 있었다.
 * 지금은 관리자 화면 우측 상단 프로필 버튼 하나만 있고, 눌러야 역할 전환
 * 팝오버(넓은 화면)·시트(좁은 화면)가 나온다. 시민 쪽은 손대지 않았다 — 기존처럼
 * 지도 하단 Drawer의 "시연 모드" 버튼으로 들어간다.
 */

const BASE = 'http://localhost:5173';

test.describe('시민 홈 — 상단에 역할 전환 pill 바가 없다', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('지도 첫 화면에 역할 pill 버튼이 보이지 않는다', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을|그냥드림 찾기/ })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: '시청 관리자', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '현장 담당자', exact: true })).toHaveCount(0);
  });

  test('Drawer의 "시연 모드" 버튼으로는 그대로 역할을 고를 수 있다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
    await page.getByRole('button', { name: '시연 모드' }).click();
    await expect(page.getByRole('heading', { name: '그냥드림 시연하기' })).toBeVisible();
    await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });
});

test.describe('관리자 화면 — 프로필 버튼으로 역할을 전환한다', () => {
  test.use({ viewport: { width: 1600, height: 1100 } });

  test('우측 상단에 현재 역할이 프로필 버튼 하나로만 보인다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: '운영 현황' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('DEMO · 공모전 시연용')).toBeVisible();
    await expect(page.getByRole('button', { name: /현재 역할 시청 관리자/ })).toBeVisible();
  });

  test('프로필 버튼을 누르면 역할 3개와 현재 역할 배지가 뜬다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.getByRole('button', { name: /현재 역할/ }).click();
    await expect(page.getByRole('heading', { name: '시연 역할 전환' })).toBeVisible();
    await expect(page.getByText('현재')).toBeVisible();
    await expect(page.getByRole('button', { name: /시민/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /현장 담당자/ })).toBeVisible();
  });

  test('다른 역할을 고르면 같은 경로에서 첫 화면 내용만 바뀐다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.getByRole('button', { name: /현재 역할/ }).click();
    await page.getByRole('button', { name: /현장 담당자/ }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: /담당 거점을 선택해 주세요|빠른 현황 입력/ })).toBeVisible();
  });
});

test.describe('관리자 화면 — 좁은 화면에서는 Bottom Sheet로 전환한다', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('프로필 버튼을 누르면 시민 화면과 같은 역할 선택 시트가 뜬다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await page.getByRole('button', { name: /현재 역할/ }).click();
    await expect(page.getByRole('heading', { name: '그냥드림 시연하기' })).toBeVisible();
    await page.getByRole('button', { name: /시민으로 보기/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
