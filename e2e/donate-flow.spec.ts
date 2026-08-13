/**
 * 물품 기부 AI 인식 flow E2E 테스트.
 *
 * Gemini API 호출은 실제 네트워크를 타지 않는다.
 * Supabase Storage 업로드와 Edge Function 응답을 page.route()로 mock한다.
 * RPC(create_donation)도 mock — 실제 DB 없이 흐름만 검증.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

const PROXY = process.env.JUPYTERHUB_SERVICE_PREFIX
  ? `${process.env.JUPYTERHUB_SERVICE_PREFIX}proxy/absolute/5173`
  : '';
const BASE = `http://localhost:5173${PROXY}`;
const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function mockStorage(route: Route) {
  return route.fulfill({ status: 200, body: JSON.stringify({ Key: 'donation-photos/2026-01-01/test.jpg' }) });
}
function mockRpc(route: Route) {
  return route.fulfill({ status: 200, body: JSON.stringify('fake-donation-id') });
}

async function setupCommonMocks(page: Page) {
  await page.route('**/storage/v1/object/donation-photos/**', mockStorage);
  await page.route('**/rest/v1/rpc/create_donation', mockRpc);
}

async function pickFile(page: Page) {
  const input = page.locator('input[type=file]').first();
  await expect(input).toBeAttached({ timeout: 5000 });
  await input.setInputFiles(
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: FAKE_PNG },
    { force: true },
  );
}

test.describe('물품 기부 AI flow — 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('AI 성공 — 단일 품목 확인 후 기부 완료', async ({ page }) => {
    await setupCommonMocks(page);
    await page.route('**/functions/v1/analyze-donation-image', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ name: '라면', category: '식품', quantity: 5 }], needs_review: false, message: null }),
      }),
    );

    await page.goto(`${BASE}/donate`);
    await expect(page.getByRole('heading', { name: '무엇을 나눌까요?' })).toBeVisible();

    await pickFile(page);

    await expect(page.getByText('라면 5개로 보여요')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('사진에서 자동으로 확인했어요')).toBeVisible();

    await page.getByRole('button', { name: '맞아요' }).click();
    await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();

    await page.getByRole('combobox').selectOption('동탄5동');
    await page.getByRole('button', { name: '직접 가져갈게요' }).click();
    await page.getByRole('button', { name: '기부 요청 보내기' }).click();
    await expect(page.getByRole('heading', { name: '기부 요청을 보냈어요.' })).toBeVisible({ timeout: 10000 });
  });

  test('AI 수량 null — 사용자가 수량 스테퍼로 입력', async ({ page }) => {
    await setupCommonMocks(page);
    await page.route('**/functions/v1/analyze-donation-image', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ name: '라면', category: '식품', quantity: null }], needs_review: false, message: null }),
      }),
    );

    await page.goto(`${BASE}/donate`);
    await pickFile(page);

    await expect(page.getByText('라면으로 보여요')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('몇 개인가요?')).toBeVisible();

    await page.getByRole('button', { name: '수량 늘리기' }).click();
    await page.getByRole('button', { name: '수량 늘리기' }).click();
    await expect(page.getByText('3')).toBeVisible();

    await page.getByRole('button', { name: '맞아요' }).click();
    await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();
  });

  test('AI 복수 품목 — 각 항목 표시·수정·완료', async ({ page }) => {
    await setupCommonMocks(page);
    await page.route('**/functions/v1/analyze-donation-image', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            { name: '라면', category: '식품', quantity: 5 },
            { name: '생수', category: '식품', quantity: 6 },
            { name: '휴지', category: '생활용품', quantity: 2 },
          ],
          needs_review: false,
          message: null,
        }),
      }),
    );

    await page.goto(`${BASE}/donate`);
    await pickFile(page);

    await expect(page.getByText('사진에서 자동으로 확인했어요')).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('1번째 품목명')).toHaveValue('라면');
    await expect(page.getByLabel('2번째 품목명')).toHaveValue('생수');
    await expect(page.getByLabel('3번째 품목명')).toHaveValue('휴지');

    await page.getByRole('button', { name: '맞아요' }).click();
    await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();
  });

  test('needs_review — 수동 입력 fallback', async ({ page }) => {
    await setupCommonMocks(page);
    await page.route('**/functions/v1/analyze-donation-image', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], needs_review: true, message: '물품을 정확히 확인하기 어려워요.' }),
      }),
    );

    await page.goto(`${BASE}/donate`);
    await pickFile(page);

    await expect(page.getByText('물품을 정확히 확인하기 어려워요.')).toBeVisible({ timeout: 15000 });
    await expect(page.getByLabel('품목명')).toBeVisible();

    await page.getByLabel('품목명').fill('쌀');
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();
  });

  test('Gemini API 실패 — 수동 입력 fallback, 기부 가능', async ({ page }) => {
    await setupCommonMocks(page);
    await page.route('**/functions/v1/analyze-donation-image', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'Gemini timeout' }) }),
    );

    await page.goto(`${BASE}/donate`);
    await pickFile(page);

    await expect(page.getByText('자동으로 확인하지 못했어요. 품목만 직접 알려주세요.')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('품목명').fill('기저귀');
    await page.getByRole('button', { name: '다음' }).click();
    await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();

    await page.getByRole('combobox').selectOption('동탄5동');
    await page.getByRole('button', { name: '수거가 필요해요' }).click();
    await page.getByLabel('연락받을 번호').fill('010-0000-0000');
    await page.getByRole('button', { name: '기부 요청 보내기' }).click();
    await expect(page.getByRole('heading', { name: '기부 요청을 보냈어요.' })).toBeVisible({ timeout: 10000 });
  });

  test('사용자 수정 — AI 라면 → 컵라면으로 수정 후 저장', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null;
    await page.route('**/storage/v1/object/donation-photos/**', mockStorage);
    await page.route('**/rest/v1/rpc/create_donation', async (route) => {
      capturedBody = route.request().postDataJSON() as Record<string, unknown>;
      return mockRpc(route);
    });
    await page.route('**/functions/v1/analyze-donation-image', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [{ name: '라면', category: '식품', quantity: 3 }], needs_review: false, message: null }),
      }),
    );

    await page.goto(`${BASE}/donate`);
    await pickFile(page);
    await expect(page.getByText('라면 3개로 보여요')).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: '수정하기' }).click();
    await expect(page.getByLabel('품목명')).toHaveValue('라면');
    await page.getByLabel('품목명').fill('컵라면');
    await page.getByRole('button', { name: '다음' }).click();

    await page.getByRole('combobox').selectOption('동탄5동');
    await page.getByRole('button', { name: '직접 가져갈게요' }).click();
    await page.getByRole('button', { name: '기부 요청 보내기' }).click();
    await expect(page.getByRole('heading', { name: '기부 요청을 보냈어요.' })).toBeVisible({ timeout: 10000 });

    expect(capturedBody?.p_item_name).toBe('컵라면');
  });
});
