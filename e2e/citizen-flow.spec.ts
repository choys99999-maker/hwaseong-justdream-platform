import { test, expect, type Page } from '@playwright/test';

/**
 * 시민 서비스 핵심 흐름 검증 (개편 후).
 *
 * 지도 타일은 카카오맵 SDK(외부 CDN + API 키)가 있어야 뜨므로, 여기서는 지도 위에 얹히는
 * UI — 액션 영역 · 추천 시트 · 서브 페이지 — 만 검증한다. 지도 자체가 없어도 "가까운 곳 찾기"
 * 흐름이 끝까지 돌아가야 한다는 것 자체가 이 앱의 요구사항이라, 그 조건이 곧 테스트가 된다.
 *
 * `help_requests` 등은 Supabase 마이그레이션이 적용된 뒤에만 실제로 저장된다 — 적용 전에는
 * 제출이 오류로 끝나는 것이 정상이므로 "성공 또는 실패 메시지" 둘 다 허용한다.
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

/** 모든 시민 화면 공통 — 가로 스크롤이 생기면 어딘가 폭을 넘긴 요소가 있다는 뜻이다. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openDrawer(page: Page) {
  await page.getByRole('button', { name: '전체 메뉴 열기' }).click();
  await expect(page.getByRole('navigation', { name: '전체 메뉴' })).toBeVisible();
}

test.describe('홈 — 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('첫 화면은 지도 + 행동 하나. Primary 1 · Secondary 1 · Tertiary 1', async ({ page }) => {
    await page.goto(BASE);

    await expect(page.getByRole('heading', { name: '가까운 그냥드림을 찾아드릴게요' })).toBeVisible();
    await expect(page.getByRole('button', { name: '내 주변 그냥드림 찾기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible();
    await expect(page.getByRole('button', { name: /도움 요청/ })).toBeVisible();

    // 홈 화면 자체에는 기능 카드·통계·설명이 없다(Drawer 는 화면 밖에 접혀 있다).
    const visible = await page.locator('main').innerText();
    expect(visible).not.toContain('물품 기부');
    expect(visible).not.toContain('도움 정보');
    expect(visible).not.toContain('말 남기기');

    await expectNoHorizontalOverflow(page);
  });

  test('화성특례시 공식 BI 가 홈 상단에 있다', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.getByRole('img', { name: '화성특례시' })).toBeVisible();
    await expect(page.getByText('그냥드림', { exact: true }).first()).toBeVisible();
  });

  test('핵심 CTA 는 56px 이상, 주요 터치 목표는 48px 이상', async ({ page }) => {
    await page.goto(BASE);
    const cta = page.getByRole('button', { name: '내 주변 그냥드림 찾기' });
    expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(56);

    const secondary = page.getByRole('button', { name: '동네로 찾기' });
    expect((await secondary.boundingBox())!.height).toBeGreaterThanOrEqual(48);

    const menu = page.getByRole('button', { name: '전체 메뉴 열기' });
    const menuBox = (await menu.boundingBox())!;
    expect(Math.min(menuBox.width, menuBox.height)).toBeGreaterThanOrEqual(48);
  });
});

// ── A. 홈 → 내 주변 찾기 → 추천 거점 → 길찾기 ────────────────────────────────

test.describe('A. 내 주변 찾기', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('위치를 허용하면 한 번 더 누르지 않고 바로 추천 거점이 뜬다', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.1996, longitude: 127.1127 }); // 동탄 인근
    await page.goto(BASE);

    await page.getByRole('button', { name: '내 주변 그냥드림 찾기' }).click();

    // 답은 목록이 아니라 한 곳이다 — 바로 그 거점의 상세 시트가 열린다.
    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('내 위치에서')).toBeVisible();
    await expect(page.getByRole('button', { name: '가까운 다른 곳 보기' })).toBeVisible();
  });

  test('다른 곳 보기 → 추천 3곳까지, 순위는 숫자로 읽힌다', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 37.1996, longitude: 127.1127 });
    await page.goto(BASE);

    await page.getByRole('button', { name: '내 주변 그냥드림 찾기' }).click();
    await page.getByRole('button', { name: '가까운 다른 곳 보기' }).click();

    await expect(page.getByRole('heading', { name: '가까운 다른 곳' })).toBeVisible();
    await expect(page.locator('li:has-text("추천")')).toHaveCount(3);

    // 목록에서 다시 한 곳을 고르면 같은 상세 시트로 돌아온다.
    await page.locator('li:has-text("추천")').first().getByRole('button').click();
    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible();
  });

  test('위치를 거부해도 동네로 찾기로 계속 진행할 수 있다', async ({ page, context }) => {
    await context.grantPermissions([]);
    await page.goto(BASE);
    await page.getByRole('button', { name: '내 주변 그냥드림 찾기' }).click();

    await expect(page.getByText('위치를 쓸 수 없어요. 동네로 찾아드릴게요.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible();
  });
});

// ── B. 홈 → 동네로 찾기 → 거점 ───────────────────────────────────────────────

test.describe('B. 동네로 찾기', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('동네를 고르면 그 동네 기준 거점이 바로 뜬다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '동네로 찾기' }).click();

    await expect(page.getByRole('heading', { name: '어느 동네에 계세요?' })).toBeVisible();
    await page.getByRole('button', { name: '동탄5동', exact: true }).click();

    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible();
    await expect(page.getByText('동탄5동에서')).toBeVisible();

    // 관리자 숫자는 시민 화면에 나오지 않는다.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('재고율');
    expect(body).not.toContain('D-Day');
  });

  test('운영이 끝난 곳에 "지금 받을 수 있어요" 가 함께 뜨지 않는다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: '동네로 찾기' }).click();
    await page.getByRole('button', { name: '동탄5동', exact: true }).click();
    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible();

    const body = await page.locator('body').innerText();
    const closed = body.includes('운영이 끝났어요') || body.includes('주말에는 쉬어요') || body.includes('아직 열지 않았어요');
    if (closed) {
      expect(body).not.toContain('지금 이용할 수 있어요');
      expect(body).not.toContain('지금 확인된 물품');
    }
  });
});

// ── 거점 상세 페이지 ─────────────────────────────────────────────────────────

test.describe('거점 상세 페이지', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('지도에서 쓰는 거점 id 로 상세 페이지가 열린다', async ({ page }) => {
    await page.goto(`${BASE}/site/justdream-10`);
    await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible();
    // 병합된 거점은 확인된 전화번호가 있어 전화 버튼이 함께 뜬다.
    await expect(page.getByRole('link', { name: '전화하기' })).toBeVisible();
    await expect(page.getByRole('link', { name: '도움 요청하기' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('없는 거점은 빈 화면 문구로 끝난다', async ({ page }) => {
    await page.goto(`${BASE}/site/does-not-exist`);
    await expect(page.getByRole('heading', { name: '거점 정보' })).toBeVisible();
    await expect(page.getByText('거점 정보를 찾을 수 없어요')).toBeVisible();
  });
});

// ── C. 홈 → 도움 요청 → 제출 ─────────────────────────────────────────────────

test.describe('C. 도움 요청', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('홈에서 도움 요청으로 들어가 필수 입력만으로 보낸다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /도움 요청/ }).click();
    await expect(page).toHaveURL(/\/help$/);
    await expect(page.getByRole('heading', { name: '어떤 도움이 필요하세요?' })).toBeVisible();

    await page.getByRole('button', { name: '먹거리' }).click();
    await page.getByLabel('사는 동네').selectOption('동탄5동');
    await page.getByLabel('연락받을 번호').fill('010-1234-5678');
    await page.getByRole('button', { name: '직접 갈 수 있어요' }).click();

    await page.getByRole('button', { name: '도움 요청 보내기' }).click();

    const ok = page.getByRole('heading', { name: '요청을 보냈어요' });
    const failed = page.getByText('요청을 보내지 못했어요', { exact: false });
    await expect(ok.or(failed)).toBeVisible({ timeout: 10000 });
  });

  test('뒤로가기는 ← 하나로 통일되어 있다', async ({ page }) => {
    await page.goto(BASE);
    await page.getByRole('button', { name: /도움 요청/ }).click();
    await page.getByRole('button', { name: '뒤로 가기' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/?$`));
  });
});

// ── D~G. Drawer 진입 화면들 ──────────────────────────────────────────────────

test.describe('Drawer 진입 화면', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('D. 물품 기부 — 사진부터 시작한다', async ({ page }) => {
    await page.goto(BASE);
    await openDrawer(page);
    await page.getByRole('button', { name: /물품 기부/ }).click();

    await expect(page).toHaveURL(/\/donate$/);
    await expect(page.getByRole('heading', { name: '무엇을 나눌까요?' })).toBeVisible();
    await expect(page.getByRole('button', { name: '사진 찍기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '사진에서 선택' })).toBeVisible();
    // AI 를 홍보하지 않는다.
    const body = await page.locator('body').innerText();
    expect(body).not.toContain('AI');
    expect(body).not.toContain('Gemini');
  });

  test('E. 도움 정보 — 분야 4개, 결과는 전화 걸기 하나', async ({ page }) => {
    await page.goto(BASE);
    await openDrawer(page);
    await page.getByRole('button', { name: /도움 정보/ }).click();

    await expect(page).toHaveURL(/\/info$/);
    await expect(page.getByRole('heading', { name: '어떤 일로 힘드세요?' })).toBeVisible();
    for (const label of ['생활', '주거', '금융', '노동']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: '금융', exact: true }).click();
    await expect(page.getByRole('heading', { name: '금융' })).toBeVisible();
    await expect(page.getByRole('link', { name: /서민금융통합콜센터/ })).toHaveAttribute('href', 'tel:1397');
  });

  test('F. 말 남기기 — 글칸 하나로 끝난다', async ({ page }) => {
    await page.goto(BASE);
    await openDrawer(page);
    await page.getByRole('button', { name: /말 남기기/ }).click();

    await expect(page).toHaveURL(/\/feedback$/);
    await expect(page.getByRole('heading', { name: '말만 남겨도 돼요' })).toBeVisible();
    await expect(page.getByLabel('하고 싶은 말')).toBeVisible();
    await expect(page.getByRole('button', { name: '남기기' })).toBeDisabled();

    await page.getByLabel('하고 싶은 말').fill('감사합니다');
    await expect(page.getByRole('button', { name: '남기기' })).toBeEnabled();
  });

  test('G. 이용 안내 — 3단계, 그리고 지도 복귀', async ({ page }) => {
    await page.goto(BASE);
    await openDrawer(page);
    await page.getByRole('button', { name: /이용 안내/ }).click();

    await expect(page).toHaveURL(/\/guide$/);
    await expect(page.getByRole('heading', { name: '이렇게 이용해요' })).toBeVisible();
    await expect(page.locator('ol > li')).toHaveCount(3);

    await page.getByRole('link', { name: '지도에서 찾아보기' }).click();
    await expect(page).toHaveURL(new RegExp(`${BASE}/?$`));
    await expect(page.getByRole('heading', { name: '가까운 그냥드림을 찾아드릴게요' })).toBeVisible();
  });

  test('물품 찾기 — 빈 화면은 한 문장, 검색하면 거점이 나온다', async ({ page }) => {
    await page.goto(BASE);
    await openDrawer(page);
    await page.getByRole('button', { name: /물품 찾기/ }).click();

    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByText('찾고 싶은 물품을 입력해 주세요')).toBeVisible();

    await page.getByLabel('찾는 물품').fill('라면');
    await expect(page.getByText(/곳에서 확인됐어요/)).toBeVisible();
    await expect(page.locator('ul > li')).not.toHaveCount(0);
  });
});

// ── 화면 크기 회귀 ───────────────────────────────────────────────────────────

for (const size of [
  { width: 375, height: 812, label: 'iPhone SE/8 계열' },
  { width: 390, height: 844, label: 'iPhone 14 (primary)' },
  { width: 430, height: 932, label: 'iPhone 14 Pro Max' },
]) {
  test.describe(`${size.width}×${size.height} — ${size.label}`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });

    test('홈 CTA 가 화면 안에 들어오고 가로 스크롤이 없다', async ({ page }) => {
      await page.goto(BASE);
      const cta = page.getByRole('button', { name: '내 주변 그냥드림 찾기' });
      const box = (await cta.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(size.height);
      await expectNoHorizontalOverflow(page);
    });
  });
}

test.describe('200% 확대에서도 핵심 기능 사용 가능', () => {
  // 브라우저 200% 확대 = CSS 뷰포트가 절반(390×844 → 195×422).
  test.use({ viewport: { width: 195, height: 422 } });

  test('확대해도 핵심 CTA 가 화면 안에 있다', async ({ page }) => {
    await page.goto(BASE);
    const cta = page.getByRole('button', { name: '내 주변 그냥드림 찾기' });
    await expect(cta).toBeVisible();
    const box = (await cta.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(422);
    await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible();
  });
});

// ── 관리자 회귀 ──────────────────────────────────────────────────────────────

test.describe('관리자 화면 회귀 — 데스크톱', () => {
  test.use({ viewport: { width: 1600, height: 1100 } });

  test('/admin 통합 대시보드가 그대로 뜬다', async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.getByRole('heading', { name: '핵심 운영 지표', exact: false })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('nav >> text=통합 대시보드')).toBeVisible();
  });

  test('예전 경로는 그대로 리다이렉트된다', async ({ page }) => {
    await page.goto(`${BASE}/inventory`);
    await expect(page).toHaveURL(/\/admin\/inventory$/);

    await page.goto(`${BASE}/files`);
    await expect(page).toHaveURL(/\/admin\/files$/);

    // 합쳐진 시민 화면들도 홈으로 보낸다.
    await page.goto(`${BASE}/discover`);
    await expect(page).toHaveURL(new RegExp(`${BASE}/?$`));
    await page.goto(`${BASE}/easy`);
    await expect(page).toHaveURL(new RegExp(`${BASE}/?$`));
  });

  test('빠른 현황 입력 화면 접근 가능', async ({ page }) => {
    await page.goto(`${BASE}/admin/quick-status`);
    await expect(page.getByRole('heading', { name: '빠른 현황 입력' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: '지금 가능' })).toBeVisible();
  });
});
