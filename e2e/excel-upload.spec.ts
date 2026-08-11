import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import * as XLSX from 'xlsx';

/**
 * 엑셀 해석 엔진 v2 — 실제 브라우저 업로드 검증.
 *
 * 엔진 자체의 정확도는 `npm run test:excel`(합성 파일 19종)이 본다.
 * 여기서는 그 결과가 화면에 제대로 드러나는지만 본다.
 *   1. 표준 양식 → "업로드할 수 있습니다"
 *   2. 제목 3행 + 다른 표현 + 미인식 열 → "N개 열 중 M개 인식 / K개 확인 필요"를 반드시 보여주고
 *      확인 전에는 저장 버튼을 열어주지 않는다
 *   3. 열 연결을 직접 고치면 확인 항목이 사라지고 저장할 수 있게 된다
 */

const workDir = mkdtempSync(join(tmpdir(), 'jd-excel-'));

function writeWorkbook(fileName: string, sheets: Array<{ name: string; aoa: unknown[][] }>): string {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet.aoa), sheet.name);
  }
  const path = join(workDir, fileName);
  XLSX.writeFile(wb, path);
  return path;
}

const STANDARD_FILE = writeWorkbook('표준양식.xlsx', [
  {
    name: '물품현황',
    aoa: [
      ['품목명', '입고수량', '출고수량', '현재재고', '유통기한'],
      ['쌀', 100, 30, 70, '2026-12-31'],
      ['라면', 50, 20, 30, '2026-09-30'],
    ],
  },
]);

// 8개 열 중 6개만 알아볼 수 있는 파일. 제목 3줄과 다른 표현(물품/입고량/배부량/소비기한)을 섞었다.
const MESSY_FILE = writeWorkbook('봉담읍_8월.xlsx', [
  {
    name: '8월 최종본',
    aoa: [
      ['2026년 8월 그냥드림 물품 현황'],
      ['봉담읍'],
      [],
      ['지역', '물품', '입고량', '배부량', '재고', '소비기한', '특수관리코드', '보관위치'],
      ['봉담읍', '쌀', '1,000', 300, 700, '2026.12.31', 'A-102', '창고1'],
      ['봉담읍', '라면', 50, 20, 30, '2026년 9월 30일', 'B-201', '창고2'],
      ['합계', '', 1050, 320, 730, '', '', ''],
    ],
  },
]);

/**
 * 업로드 화면까지는 URL 을 직접 치지 않고 화면 안의 링크를 눌러서 간다.
 * 라우터 방식(Browser/Hash)이나 배포 base 경로가 바뀌어도 테스트가 따라 깨지지 않는다.
 */
async function upload(page: import('@playwright/test').Page, filePath: string) {
  await page.goto('/');
  await page.getByRole('link', { name: '자료·데이터 관리', exact: true }).first().click();
  await page.getByRole('link', { name: '자료 올리기' }).click();
  await expect(page.getByRole('heading', { name: '자료 올리기' })).toBeVisible();
  await page.setInputFiles('input[type="file"]', filePath);
}

test('표준 양식 — 바로 업로드할 수 있다고 알린다', async ({ page }) => {
  await upload(page, STANDARD_FILE);

  await expect(page.getByRole('heading', { name: '자료를 확인했어요' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('업로드할 수 있습니다')).toBeVisible();
  await expect(page.getByText('5개 열 중 5개 인식')).toBeVisible();

  // 저장될 내용에 정규화된 값이 그대로 보인다.
  const table = page.getByRole('table').first();
  await expect(table.getByText('쌀')).toBeVisible();
  await expect(table.getByText('2026-12-31')).toBeVisible();

  await expect(page.getByRole('button', { name: '자료 저장' })).toBeEnabled();
});

test('미인식 열이 있으면 통과시키지 않고 무엇을 확인해야 하는지 알린다', async ({ page }) => {
  await upload(page, MESSY_FILE);

  await expect(page.getByRole('heading', { name: '저장 전에 확인해 주세요' })).toBeVisible({
    timeout: 15_000,
  });

  // 인식/미인식 개수를 숫자로 보여준다.
  await expect(page.getByText('8개 열 중 6개 인식')).toBeVisible();
  await expect(page.getByText('2개 확인 필요')).toBeVisible();

  // 어떤 열인지 이름으로 알려준다.
  await expect(page.getByText('연결되지 않은 열 2개', { exact: false })).toBeVisible();
  await expect(page.getByText('특수관리코드').first()).toBeVisible();
  await expect(page.getByText('보관위치').first()).toBeVisible();

  // 확인하기 전에는 저장 버튼이 열리지 않는다.
  const save = page.getByRole('button', { name: '자료 저장' });
  await expect(save).toBeDisabled();

  // 제목에서 찾은 지역, 다른 표현으로 쓴 열, 정규화된 값이 모두 결과에 드러난다.
  await expect(page.getByText('품목명', { exact: false }).first()).toBeVisible();
  const table = page.getByRole('table').first();
  await expect(table.getByText('1000')).toBeVisible();
  await expect(table.getByText('2026-12-31')).toBeVisible();
  await expect(table.getByText('2026-09-30')).toBeVisible();

  // 합계 행은 저장 대상에서 빠진다. (표에 1050 이 나오면 안 된다)
  await expect(table.getByText('1050')).toHaveCount(0);

  // 확인했다고 표시하면 저장할 수 있다.
  await page.getByRole('checkbox').check();
  await expect(save).toBeEnabled();
});

test('열 연결을 직접 고치면 확인 항목이 사라진다', async ({ page }) => {
  await upload(page, MESSY_FILE);
  await expect(page.getByRole('heading', { name: '저장 전에 확인해 주세요' })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: '열 연결 확인·수정' }).click();

  // 미인식 열도 반드시 표에 한 줄씩 나온다.
  await expect(page.getByLabel('특수관리코드 열을 연결할 플랫폼 항목')).toBeVisible();
  await expect(page.getByLabel('보관위치 열을 연결할 플랫폼 항목')).toBeVisible();

  // 쓰지 않기로 정하는 것도 사용자의 결정이다 — 여기서는 기관명으로 연결해 본다.
  await page.getByLabel('특수관리코드 열을 연결할 플랫폼 항목').selectOption('organization');
  await expect(page.getByText('7개 인식')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('연결되지 않은 열 1개', { exact: false })).toBeVisible();
});
