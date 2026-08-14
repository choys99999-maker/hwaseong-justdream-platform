# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: donate-flow.spec.ts >> 물품 기부 AI flow — 390×844 >> Gemini API 실패 — 수동 입력 fallback, 기부 가능
- Location: e2e/donate-flow.spec.ts:146:3

# Error details

```
Error: expect(locator).toBeAttached() failed

Locator: locator('input[type=file]').first()
Expected: attached
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeAttached" with timeout 5000ms
  - waiting for locator('input[type=file]').first()

```

```yaml
- main:
  - img
  - text: 8km
  - link "Kakao 맵으로 이동(새창열림)":
    - /url: http://map.kakao.com/
    - img "Kakao 맵으로 이동(새창열림)"
  - button "전체 메뉴 열기"
  - link "쉽게 보기":
    - /url: /easy
  - text: 화성 모아드림
  - heading "가까운 그냥드림을 찾아드릴게요" [level=1]
  - button "내 주변에서 찾기"
  - button "동네로 찾기"
  - button "도움 요청"
```

# Test source

```ts
  1   | /**
  2   |  * 물품 기부 AI 인식 flow E2E 테스트.
  3   |  *
  4   |  * Gemini API 호출은 실제 네트워크를 타지 않는다.
  5   |  * Supabase Storage 업로드와 Edge Function 응답을 page.route()로 mock한다.
  6   |  * RPC(create_donation)도 mock — 실제 DB 없이 흐름만 검증.
  7   |  */
  8   | 
  9   | import { test, expect, type Page, type Route } from '@playwright/test';
  10  | 
  11  | const PROXY = process.env.JUPYTERHUB_SERVICE_PREFIX
  12  |   ? `${process.env.JUPYTERHUB_SERVICE_PREFIX}proxy/absolute/5173`
  13  |   : '';
  14  | const BASE = `http://localhost:5173${PROXY}`;
  15  | const FAKE_PNG = Buffer.from(
  16  |   'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  17  |   'base64',
  18  | );
  19  | 
  20  | function mockStorage(route: Route) {
  21  |   return route.fulfill({ status: 200, body: JSON.stringify({ Key: 'donation-photos/2026-01-01/test.jpg' }) });
  22  | }
  23  | function mockRpc(route: Route) {
  24  |   return route.fulfill({ status: 200, body: JSON.stringify('fake-donation-id') });
  25  | }
  26  | 
  27  | async function setupCommonMocks(page: Page) {
  28  |   await page.route('**/storage/v1/object/donation-photos/**', mockStorage);
  29  |   await page.route('**/rest/v1/rpc/create_donation', mockRpc);
  30  | }
  31  | 
  32  | async function pickFile(page: Page) {
  33  |   const input = page.locator('input[type=file]').first();
> 34  |   await expect(input).toBeAttached({ timeout: 5000 });
      |                       ^ Error: expect(locator).toBeAttached() failed
  35  |   await input.setInputFiles(
  36  |     { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: FAKE_PNG },
  37  |     { force: true },
  38  |   );
  39  | }
  40  | 
  41  | test.describe('물품 기부 AI flow — 390×844', () => {
  42  |   test.use({ viewport: { width: 390, height: 844 } });
  43  | 
  44  |   test('AI 성공 — 단일 품목 확인 후 기부 완료', async ({ page }) => {
  45  |     await setupCommonMocks(page);
  46  |     await page.route('**/functions/v1/analyze-donation-image', (route) =>
  47  |       route.fulfill({
  48  |         status: 200,
  49  |         contentType: 'application/json',
  50  |         body: JSON.stringify({ items: [{ name: '라면', category: '식품', quantity: 5 }], needs_review: false, message: null }),
  51  |       }),
  52  |     );
  53  | 
  54  |     await page.goto(`${BASE}/donate`);
  55  |     await expect(page.getByRole('heading', { name: '무엇을 나눌까요?' })).toBeVisible();
  56  | 
  57  |     await pickFile(page);
  58  | 
  59  |     await expect(page.getByText('라면 5개로 보여요')).toBeVisible({ timeout: 15000 });
  60  |     await expect(page.getByText('사진에서 자동으로 확인했어요')).toBeVisible();
  61  | 
  62  |     await page.getByRole('button', { name: '맞아요' }).click();
  63  |     await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();
  64  | 
  65  |     await page.getByRole('combobox').selectOption('동탄5동');
  66  |     await page.getByRole('button', { name: '직접 가져갈게요' }).click();
  67  |     await page.getByRole('button', { name: '기부 요청 보내기' }).click();
  68  |     await expect(page.getByRole('heading', { name: '기부 요청을 보냈어요.' })).toBeVisible({ timeout: 10000 });
  69  |   });
  70  | 
  71  |   test('AI 수량 null — 사용자가 수량 스테퍼로 입력', async ({ page }) => {
  72  |     await setupCommonMocks(page);
  73  |     await page.route('**/functions/v1/analyze-donation-image', (route) =>
  74  |       route.fulfill({
  75  |         status: 200,
  76  |         contentType: 'application/json',
  77  |         body: JSON.stringify({ items: [{ name: '라면', category: '식품', quantity: null }], needs_review: false, message: null }),
  78  |       }),
  79  |     );
  80  | 
  81  |     await page.goto(`${BASE}/donate`);
  82  |     await pickFile(page);
  83  | 
  84  |     await expect(page.getByText('라면으로 보여요')).toBeVisible({ timeout: 15000 });
  85  |     await expect(page.getByText('몇 개인가요?')).toBeVisible();
  86  | 
  87  |     await page.getByRole('button', { name: '수량 늘리기' }).click();
  88  |     await page.getByRole('button', { name: '수량 늘리기' }).click();
  89  |     await expect(page.getByText('3')).toBeVisible();
  90  | 
  91  |     await page.getByRole('button', { name: '맞아요' }).click();
  92  |     await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();
  93  |   });
  94  | 
  95  |   test('AI 복수 품목 — 각 항목 표시·수정·완료', async ({ page }) => {
  96  |     await setupCommonMocks(page);
  97  |     await page.route('**/functions/v1/analyze-donation-image', (route) =>
  98  |       route.fulfill({
  99  |         status: 200,
  100 |         contentType: 'application/json',
  101 |         body: JSON.stringify({
  102 |           items: [
  103 |             { name: '라면', category: '식품', quantity: 5 },
  104 |             { name: '생수', category: '식품', quantity: 6 },
  105 |             { name: '휴지', category: '생활용품', quantity: 2 },
  106 |           ],
  107 |           needs_review: false,
  108 |           message: null,
  109 |         }),
  110 |       }),
  111 |     );
  112 | 
  113 |     await page.goto(`${BASE}/donate`);
  114 |     await pickFile(page);
  115 | 
  116 |     await expect(page.getByText('사진에서 자동으로 확인했어요')).toBeVisible({ timeout: 15000 });
  117 |     await expect(page.getByLabel('1번째 품목명')).toHaveValue('라면');
  118 |     await expect(page.getByLabel('2번째 품목명')).toHaveValue('생수');
  119 |     await expect(page.getByLabel('3번째 품목명')).toHaveValue('휴지');
  120 | 
  121 |     await page.getByRole('button', { name: '맞아요' }).click();
  122 |     await expect(page.getByRole('heading', { name: '어떻게 전달할까요?' })).toBeVisible();
  123 |   });
  124 | 
  125 |   test('needs_review — 수동 입력 fallback', async ({ page }) => {
  126 |     await setupCommonMocks(page);
  127 |     await page.route('**/functions/v1/analyze-donation-image', (route) =>
  128 |       route.fulfill({
  129 |         status: 200,
  130 |         contentType: 'application/json',
  131 |         body: JSON.stringify({ items: [], needs_review: true, message: '물품을 정확히 확인하기 어려워요.' }),
  132 |       }),
  133 |     );
  134 | 
```