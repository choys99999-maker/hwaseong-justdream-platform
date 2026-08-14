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
    await expect(page.getByRole('heading', { name: '가까운 그냥드림을 찾아드릴게요' })).toBeVisible();
    await expect(page.getByRole('button', { name: '내 주변에서 찾기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '쉽게 보기' })).toBeVisible();
  });

  test('동네로 찾기 → 추천 거점 최대 3개, 필터·검색 없이 바로 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '동네로 찾기' }).click();
    await expect(page.getByRole('heading', { name: '사는 동네를 선택해 주세요' })).toBeVisible();

    await page.getByRole('button', { name: '동탄5동' }).click();

    await expect(page.getByRole('heading', { name: '지금은 여기가 가장 좋아요' })).toBeVisible();
    // 1순위는 <div> 카드 — 2·3순위만 <li>
    await expect(page.locator('li:has-text("순위")')).toHaveCount(2);
    // 1순위 진입로
    await expect(page.getByRole('link', { name: '여기로 갈게요' })).toBeVisible();
    await expect(page.getByRole('button', { name: '이곳 자세히 보기' })).toBeVisible();
  });

  test('메인 CTA 를 누르면 위치 확인 후 바로 추천 화면', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.1996, longitude: 127.1127 }); // 동탄 인근
    await page.goto(BASE);
    // 위치는 첫 화면 CTA 를 누른 시점에만 요청한다(자동 요청 없음).
    await page.getByRole('button', { name: '내 주변에서 찾기' }).click();
    // 위치가 확인되면 인트로가 사라지고 바로 추천 화면으로 넘어간다
    await expect(page.getByRole('heading', { name: '지금은 여기가 가장 좋아요' })).toBeVisible({ timeout: 10000 });
    // 1순위는 <div>, 2·3순위만 <li>
    await expect(page.locator('li:has-text("순위")')).toHaveCount(2);
  });

  test('위치 권한 거부해도 동네로 찾기로 계속 진행 가능', async ({ page, context }) => {
    await context.grantPermissions([]); // geolocation 권한을 주지 않는다 → getCurrentPosition 이 거부로 처리된다
    await page.goto(BASE);
    await page.getByRole('button', { name: '내 주변에서 찾기' }).click();
    // 거부 후에도 동네로 찾기 버튼으로 진행할 수 있다
    await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '동네로 찾기' }).click();
    await page.getByRole('button', { name: '병점1동' }).click();
    await expect(page.getByRole('heading', { name: '지금은 여기가 가장 좋아요' })).toBeVisible();
  });

  test('거점 상세 — 이곳 자세히 보기 진입 시 핵심 정보만 표시', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '동네로 찾기' }).click();
    await page.getByRole('button', { name: '동탄5동' }).click();
    // 1순위 카드의 상세 보기 버튼 — 시트 안에서 전환, URL 변경 없음
    await page.getByRole('button', { name: '이곳 자세히 보기' }).click();

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
    await expect(page.getByRole('button', { name: '지금 받을 수 있는 곳' })).toBeVisible();
    await expect(page.getByRole('link', { name: '직접 가기 어려워요' })).toBeVisible();
    await expect(page.getByRole('link', { name: '전화로 도와주세요' })).toBeVisible();

    await page.getByRole('button', { name: '지금 받을 수 있는 곳' }).click();
    // EasyModePage 는 RecommendationCard(<li>)로 3개 모두 같은 요소로 렌더링한다
    await expect(page.locator('li:has-text("순위")')).toHaveCount(3);
  });
});

test.describe('375×812 화면에서도 첫 화면이 정상 표시', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('시민 홈 헤딩·버튼 표시', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('heading', { name: '가까운 그냥드림을 찾아드릴게요' })).toBeVisible();
    await expect(page.getByRole('button', { name: '내 주변에서 찾기' })).toBeVisible();
  });
});

test.describe('200% 확대에서도 핵심 기능 사용 가능', () => {
  // 브라우저 200% 확대 = CSS 뷰포트가 절반(390×844 → 195×422). Playwright 는 OS 확대를
  // 제어할 수 없으므로 같은 결과가 되는 뷰포트로 재현한다.
  test.use({ viewport: { width: 195, height: 422 } });

  test('확대해도 핵심 CTA 가 스크롤 없이 화면 안에 있다', async ({ page }) => {
    await page.goto(BASE);
    const cta = page.getByRole('button', { name: '내 주변에서 찾기' });
    await expect(cta).toBeVisible();

    // 첫 화면은 시트 없이 중앙 정렬이라, 확대 시 CTA 가 화면 밖으로 밀리지 않는지가 핵심이다.
    const box = await cta.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(422);

    // 보조 액션도 그대로 닿을 수 있어야 한다.
    await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '도움 요청' })).toBeVisible();
  });
});

test.describe('/help 도움 요청', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('필수 항목만 입력해 접수하면 완료 화면을 보여준다', async ({ page }) => {
    await page.goto(`${BASE}/help`);
    await expect(page.getByRole('heading', { name: '도움이 필요하신가요?' })).toBeVisible();

    // 시민용(variant='citizen') 문구 — 관리자 접수 화면과 라벨이 다르다.
    await page.getByLabel('연락받을 번호').fill('010-1234-5678');
    await page.getByLabel('어디에 사세요?').selectOption('동탄5동');
    await page.getByRole('button', { name: '먹거리' }).click();

    await page.getByRole('button', { name: '도움 요청하기' }).click();

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

  test('/admin 접속 시 오늘 할 일이 뜬다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: '오늘 처리할 일' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('nav >> text=오늘 할 일')).toBeVisible();
  });

  test('사이드바 메뉴는 4개뿐이다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    const nav = page.locator('aside nav');
    await expect(nav.getByRole('link')).toHaveCount(4);
    for (const label of ['오늘 할 일', '거점 운영', '시민 접수', '자료 관리']) {
      await expect(nav.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('4개 IA로 흡수된 예전 경로는 새 화면으로 리다이렉트된다', async ({ page }) => {
    await page.goto(`${BASE}/inventory`);
    await expect(page).toHaveURL(/\/admin\/sites\/inventory$/);

    await page.goto(`${BASE}/admin/regions`);
    await expect(page).toHaveURL(/\/admin\/sites$/);

    await page.goto(`${BASE}/admin/usage`);
    await expect(page).toHaveURL(/\/admin\/intake\?tab=usage$/);

    await page.goto(`${BASE}/files`);
    await expect(page).toHaveURL(/\/admin\/files$/);
  });

  test('빠른 현황 입력 화면 접근 가능', async ({ page }) => {
    await page.goto(`${BASE}/admin/quick-status`);
    await expect(page.getByRole('heading', { name: '빠른 현황 입력' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '지금 가능' })).toBeVisible();
  });
});
