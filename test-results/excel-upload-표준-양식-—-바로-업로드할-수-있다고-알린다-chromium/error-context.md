# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: excel-upload.spec.ts >> 표준 양식 — 바로 업로드할 수 있다고 알린다
- Location: e2e/excel-upload.spec.ts:69:1

# Error details

```
Error: expect(locator).toBeEnabled() failed

Locator:  getByRole('button', { name: '자료 저장' })
Expected: enabled
Received: disabled
Timeout:  5000ms

Call log:
  - Expect "toBeEnabled" with timeout 5000ms
  - waiting for getByRole('button', { name: '자료 저장' })
    14 × locator resolved to <button disabled type="button" class="rounded-lg bg-teal-600 px-7 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">자료 저장</button>
       - unexpected value "disabled"

```

```yaml
- button "자료 저장" [disabled]
```

# Test source

```ts
  1   | import { mkdtempSync } from 'node:fs';
  2   | import { tmpdir } from 'node:os';
  3   | import { join } from 'node:path';
  4   | import { expect, test } from '@playwright/test';
  5   | import * as XLSX from 'xlsx';
  6   | 
  7   | /**
  8   |  * 엑셀 해석 엔진 v2 — 실제 브라우저 업로드 검증.
  9   |  *
  10  |  * 엔진 자체의 정확도는 `npm run test:excel`(합성 파일 19종)이 본다.
  11  |  * 여기서는 그 결과가 화면에 제대로 드러나는지만 본다.
  12  |  *   1. 표준 양식 → "업로드할 수 있습니다"
  13  |  *   2. 제목 3행 + 다른 표현 + 미인식 열 → "N개 열 중 M개 인식 / K개 확인 필요"를 반드시 보여주고
  14  |  *      확인 전에는 저장 버튼을 열어주지 않는다
  15  |  *   3. 열 연결을 직접 고치면 확인 항목이 사라지고 저장할 수 있게 된다
  16  |  */
  17  | 
  18  | const workDir = mkdtempSync(join(tmpdir(), 'jd-excel-'));
  19  | 
  20  | function writeWorkbook(fileName: string, sheets: Array<{ name: string; aoa: unknown[][] }>): string {
  21  |   const wb = XLSX.utils.book_new();
  22  |   for (const sheet of sheets) {
  23  |     XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.aoa), sheet.name);
  24  |   }
  25  |   const path = join(workDir, fileName);
  26  |   XLSX.writeFile(wb, path);
  27  |   return path;
  28  | }
  29  | 
  30  | const STANDARD_FILE = writeWorkbook('표준양식.xlsx', [
  31  |   {
  32  |     name: '물품현황',
  33  |     aoa: [
  34  |       ['품목명', '입고수량', '출고수량', '현재재고', '유통기한'],
  35  |       ['쌀', 100, 30, 70, '2026-12-31'],
  36  |       ['라면', 50, 20, 30, '2026-09-30'],
  37  |     ],
  38  |   },
  39  | ]);
  40  | 
  41  | // 8개 열 중 6개만 알아볼 수 있는 파일. 제목 3줄과 다른 표현(물품/입고량/배부량/소비기한)을 섞었다.
  42  | const MESSY_FILE = writeWorkbook('봉담읍_8월.xlsx', [
  43  |   {
  44  |     name: '8월 최종본',
  45  |     aoa: [
  46  |       ['2026년 8월 그냥드림 물품 현황'],
  47  |       ['봉담읍'],
  48  |       [],
  49  |       ['지역', '물품', '입고량', '배부량', '재고', '소비기한', '특수관리코드', '보관위치'],
  50  |       ['봉담읍', '쌀', '1,000', 300, 700, '2026.12.31', 'A-102', '창고1'],
  51  |       ['봉담읍', '라면', 50, 20, 30, '2026년 9월 30일', 'B-201', '창고2'],
  52  |       ['합계', '', 1050, 320, 730, '', '', ''],
  53  |     ],
  54  |   },
  55  | ]);
  56  | 
  57  | /**
  58  |  * 업로드 화면까지는 URL 을 직접 치지 않고 화면 안의 링크를 눌러서 간다.
  59  |  * 라우터 방식(Browser/Hash)이나 배포 base 경로가 바뀌어도 테스트가 따라 깨지지 않는다.
  60  |  */
  61  | async function upload(page: import('@playwright/test').Page, filePath: string) {
  62  |   await page.goto('/admin');
  63  |   await page.getByRole('link', { name: '자료 관리', exact: true }).first().click();
  64  |   await page.getByRole('link', { name: '자료 올리기' }).click();
  65  |   await expect(page.getByRole('heading', { name: '자료 올리기' })).toBeVisible();
  66  |   await page.setInputFiles('input[type="file"]', filePath);
  67  | }
  68  | 
  69  | test('표준 양식 — 바로 업로드할 수 있다고 알린다', async ({ page }) => {
  70  |   await upload(page, STANDARD_FILE);
  71  | 
  72  |   await expect(page.getByRole('heading', { name: '자료를 확인했어요' })).toBeVisible({ timeout: 15_000 });
  73  |   await expect(page.getByText('업로드할 수 있습니다')).toBeVisible();
  74  |   await expect(page.getByText('5개 열 중 5개 인식')).toBeVisible();
  75  | 
  76  |   // 저장될 내용에 정규화된 값이 그대로 보인다.
  77  |   const table = page.getByRole('table').first();
  78  |   await expect(table.getByText('쌀')).toBeVisible();
  79  |   await expect(table.getByText('2026-12-31')).toBeVisible();
  80  | 
> 81  |   await expect(page.getByRole('button', { name: '자료 저장' })).toBeEnabled();
      |                                                             ^ Error: expect(locator).toBeEnabled() failed
  82  | });
  83  | 
  84  | test('미인식 열이 있으면 통과시키지 않고 무엇을 확인해야 하는지 알린다', async ({ page }) => {
  85  |   await upload(page, MESSY_FILE);
  86  | 
  87  |   await expect(page.getByRole('heading', { name: '저장 전에 확인해 주세요' })).toBeVisible({
  88  |     timeout: 15_000,
  89  |   });
  90  | 
  91  |   // 인식/미인식 개수를 숫자로 보여준다.
  92  |   await expect(page.getByText('8개 열 중 6개 인식')).toBeVisible();
  93  |   await expect(page.getByText('2개 확인 필요')).toBeVisible();
  94  | 
  95  |   // 어떤 열인지 이름으로 알려준다.
  96  |   await expect(page.getByText('연결되지 않은 열 2개', { exact: false })).toBeVisible();
  97  |   await expect(page.getByText('특수관리코드').first()).toBeVisible();
  98  |   await expect(page.getByText('보관위치').first()).toBeVisible();
  99  | 
  100 |   // 확인하기 전에는 저장 버튼이 열리지 않는다.
  101 |   const save = page.getByRole('button', { name: '자료 저장' });
  102 |   await expect(save).toBeDisabled();
  103 | 
  104 |   // 제목에서 찾은 지역, 다른 표현으로 쓴 열, 정규화된 값이 모두 결과에 드러난다.
  105 |   await expect(page.getByText('품목명', { exact: false }).first()).toBeVisible();
  106 |   const table = page.getByRole('table').first();
  107 |   await expect(table.getByText('1000')).toBeVisible();
  108 |   await expect(table.getByText('2026-12-31')).toBeVisible();
  109 |   await expect(table.getByText('2026-09-30')).toBeVisible();
  110 | 
  111 |   // 합계 행은 저장 대상에서 빠진다. (표에 1050 이 나오면 안 된다)
  112 |   await expect(table.getByText('1050')).toHaveCount(0);
  113 | 
  114 |   // 확인했다고 표시하면 저장할 수 있다.
  115 |   await page.getByRole('checkbox').check();
  116 |   await expect(save).toBeEnabled();
  117 | });
  118 | 
  119 | test('열 연결을 직접 고치면 확인 항목이 사라진다', async ({ page }) => {
  120 |   await upload(page, MESSY_FILE);
  121 |   await expect(page.getByRole('heading', { name: '저장 전에 확인해 주세요' })).toBeVisible({
  122 |     timeout: 15_000,
  123 |   });
  124 | 
  125 |   await page.getByRole('button', { name: '열 연결 확인·수정' }).click();
  126 | 
  127 |   // 미인식 열도 반드시 표에 한 줄씩 나온다.
  128 |   await expect(page.getByLabel('특수관리코드 열을 연결할 플랫폼 항목')).toBeVisible();
  129 |   await expect(page.getByLabel('보관위치 열을 연결할 플랫폼 항목')).toBeVisible();
  130 | 
  131 |   // 쓰지 않기로 정하는 것도 사용자의 결정이다 — 여기서는 기관명으로 연결해 본다.
  132 |   await page.getByLabel('특수관리코드 열을 연결할 플랫폼 항목').selectOption('organization');
  133 |   await expect(page.getByText('7개 인식')).toBeVisible({ timeout: 15_000 });
  134 |   await expect(page.getByText('연결되지 않은 열 1개', { exact: false })).toBeVisible();
  135 | });
  136 | 
```