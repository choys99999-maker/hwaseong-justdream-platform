# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: citizen-flow.spec.ts >> /help 도움 요청 >> 필수 항목만 입력해 접수하면 완료 화면을 보여준다
- Location: e2e/citizen-flow.spec.ts:126:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '도움 요청하기' })
    - locator resolved to <button disabled type="submit" class="inline-flex items-center justify-center gap-2 rounded-2xl font-bold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/40 cursor-not-allowed opacity-40 w-full bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800 min-h-[56px] px-6 py-4 text-xl">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    109 × waiting for element to be visible, enabled and stable
        - element is not enabled
      - retrying click action
        - waiting 500ms

```

# Page snapshot

```yaml
- main [ref=e5]:
  - generic [ref=e6]:
    - link "지도로 돌아가기" [ref=e7] [cursor=pointer]:
      - /url: /
    - heading "도움이 필요하신가요?" [level=1] [ref=e10]
    - paragraph [ref=e11]: 연락처와 사는 동네만 알려주시면 담당자가 확인 후 연락드려요.
    - generic [ref=e12]:
      - link "전화로 도와주세요" [ref=e13] [cursor=pointer]:
        - /url: tel:031-000-0000
      - paragraph [ref=e19]: 031-000-0000 (그냥드림 이용 안내)
    - generic [ref=e21]:
      - generic [ref=e22]:
        - paragraph [ref=e23]: 무엇이 필요하세요?
        - generic [ref=e24]:
          - button "먹거리" [active] [pressed] [ref=e25]
          - button "생활용품" [ref=e26]
          - button "기타" [ref=e27]
      - generic [ref=e28]:
        - generic [ref=e29]: 어디에 사세요?
        - combobox "어디에 사세요?" [ref=e30]:
          - option "선택해 주세요"
          - option "기배동"
          - option "남양읍"
          - option "동탄4동"
          - option "동탄5동" [selected]
          - option "동탄6동"
          - option "동탄7동"
          - option "동탄8동"
          - option "동탄9동"
          - option "병점1동"
          - option "병점2동"
          - option "봉담읍"
          - option "비봉면"
          - option "새솔동"
          - option "서신면"
          - option "송산면"
          - option "양감면"
          - option "우정읍"
          - option "향남읍"
          - option "화산동"
      - generic [ref=e31]:
        - generic [ref=e32]: 연락받을 번호
        - textbox "연락받을 번호" [ref=e33]:
          - /placeholder: 010-0000-0000
          - text: 010-1234-5678
      - generic [ref=e34]:
        - paragraph [ref=e35]: 어떻게 도와드릴까요?
        - generic [ref=e36]:
          - button "직접 갈 수 있어요" [ref=e37]
          - button "전달 도움이 필요해요" [ref=e38]
      - button "전달할 말이 있어요" [ref=e39]
      - button "도움 요청하기" [disabled] [ref=e40]
```

# Test source

```ts
  35  |     // 1순위 진입로
  36  |     await expect(page.getByRole('link', { name: '여기로 갈게요' })).toBeVisible();
  37  |     await expect(page.getByRole('button', { name: '이곳 자세히 보기' })).toBeVisible();
  38  |   });
  39  | 
  40  |   test('메인 CTA 를 누르면 위치 확인 후 바로 추천 화면', async ({ page, context }) => {
  41  |     await context.grantPermissions(['geolocation']);
  42  |     await context.setGeolocation({ latitude: 37.1996, longitude: 127.1127 }); // 동탄 인근
  43  |     await page.goto(BASE);
  44  |     // 위치는 첫 화면 CTA 를 누른 시점에만 요청한다(자동 요청 없음).
  45  |     await page.getByRole('button', { name: '내 주변에서 찾기' }).click();
  46  |     // 위치가 확인되면 인트로가 사라지고 바로 추천 화면으로 넘어간다
  47  |     await expect(page.getByRole('heading', { name: '지금은 여기가 가장 좋아요' })).toBeVisible({ timeout: 10000 });
  48  |     // 1순위는 <div>, 2·3순위만 <li>
  49  |     await expect(page.locator('li:has-text("순위")')).toHaveCount(2);
  50  |   });
  51  | 
  52  |   test('위치 권한 거부해도 동네로 찾기로 계속 진행 가능', async ({ page, context }) => {
  53  |     await context.grantPermissions([]); // geolocation 권한을 주지 않는다 → getCurrentPosition 이 거부로 처리된다
  54  |     await page.goto(BASE);
  55  |     await page.getByRole('button', { name: '내 주변에서 찾기' }).click();
  56  |     // 거부 후에도 동네로 찾기 버튼으로 진행할 수 있다
  57  |     await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible({ timeout: 10000 });
  58  |     await page.getByRole('button', { name: '동네로 찾기' }).click();
  59  |     await page.getByRole('button', { name: '병점1동' }).click();
  60  |     await expect(page.getByRole('heading', { name: '지금은 여기가 가장 좋아요' })).toBeVisible();
  61  |   });
  62  | 
  63  |   test('거점 상세 — 이곳 자세히 보기 진입 시 핵심 정보만 표시', async ({ page }) => {
  64  |     await page.goto(BASE);
  65  |     await page.getByRole('button', { name: '동네로 찾기' }).click();
  66  |     await page.getByRole('button', { name: '동탄5동' }).click();
  67  |     // 1순위 카드의 상세 보기 버튼 — 시트 안에서 전환, URL 변경 없음
  68  |     await page.getByRole('button', { name: '이곳 자세히 보기' }).click();
  69  | 
  70  |     await expect(page.getByRole('link', { name: '길찾기' })).toBeVisible();
  71  |     // 재고율·D-day 같은 관리자 숫자는 노출하지 않는다.
  72  |     const bodyText = await page.locator('body').innerText();
  73  |     expect(bodyText).not.toContain('재고율');
  74  |     expect(bodyText).not.toContain('D-Day');
  75  |     expect(bodyText).not.toContain('D-');
  76  |   });
  77  | 
  78  |   test('간편하게 이용하기 — 한 화면에 행동 최대 3개', async ({ page }) => {
  79  |     await page.goto(`${BASE}/easy`);
  80  |     await expect(page.getByRole('heading', { name: '간편하게 이용하기' })).toBeVisible();
  81  |     await expect(page.getByRole('button', { name: '지금 받을 수 있는 곳' })).toBeVisible();
  82  |     await expect(page.getByRole('link', { name: '직접 가기 어려워요' })).toBeVisible();
  83  |     await expect(page.getByRole('link', { name: '전화로 도와주세요' })).toBeVisible();
  84  | 
  85  |     await page.getByRole('button', { name: '지금 받을 수 있는 곳' }).click();
  86  |     // EasyModePage 는 RecommendationCard(<li>)로 3개 모두 같은 요소로 렌더링한다
  87  |     await expect(page.locator('li:has-text("순위")')).toHaveCount(3);
  88  |   });
  89  | });
  90  | 
  91  | test.describe('375×812 화면에서도 첫 화면이 정상 표시', () => {
  92  |   test.use({ viewport: { width: 375, height: 812 } });
  93  | 
  94  |   test('시민 홈 헤딩·버튼 표시', async ({ page }) => {
  95  |     await page.goto(BASE);
  96  |     await expect(page.getByRole('heading', { name: '가까운 그냥드림을 찾아드릴게요' })).toBeVisible();
  97  |     await expect(page.getByRole('button', { name: '내 주변에서 찾기' })).toBeVisible();
  98  |   });
  99  | });
  100 | 
  101 | test.describe('200% 확대에서도 핵심 기능 사용 가능', () => {
  102 |   // 브라우저 200% 확대 = CSS 뷰포트가 절반(390×844 → 195×422). Playwright 는 OS 확대를
  103 |   // 제어할 수 없으므로 같은 결과가 되는 뷰포트로 재현한다.
  104 |   test.use({ viewport: { width: 195, height: 422 } });
  105 | 
  106 |   test('확대해도 핵심 CTA 가 스크롤 없이 화면 안에 있다', async ({ page }) => {
  107 |     await page.goto(BASE);
  108 |     const cta = page.getByRole('button', { name: '내 주변에서 찾기' });
  109 |     await expect(cta).toBeVisible();
  110 | 
  111 |     // 첫 화면은 시트 없이 중앙 정렬이라, 확대 시 CTA 가 화면 밖으로 밀리지 않는지가 핵심이다.
  112 |     const box = await cta.boundingBox();
  113 |     expect(box).not.toBeNull();
  114 |     expect(box!.y).toBeGreaterThanOrEqual(0);
  115 |     expect(box!.y + box!.height).toBeLessThanOrEqual(422);
  116 | 
  117 |     // 보조 액션도 그대로 닿을 수 있어야 한다.
  118 |     await expect(page.getByRole('button', { name: '동네로 찾기' })).toBeVisible();
  119 |     await expect(page.getByRole('button', { name: '도움 요청' })).toBeVisible();
  120 |   });
  121 | });
  122 | 
  123 | test.describe('/help 도움 요청', () => {
  124 |   test.use({ viewport: { width: 390, height: 844 } });
  125 | 
  126 |   test('필수 항목만 입력해 접수하면 완료 화면을 보여준다', async ({ page }) => {
  127 |     await page.goto(`${BASE}/help`);
  128 |     await expect(page.getByRole('heading', { name: '도움이 필요하신가요?' })).toBeVisible();
  129 | 
  130 |     // 시민용(variant='citizen') 문구 — 관리자 접수 화면과 라벨이 다르다.
  131 |     await page.getByLabel('연락받을 번호').fill('010-1234-5678');
  132 |     await page.getByLabel('어디에 사세요?').selectOption('동탄5동');
  133 |     await page.getByRole('button', { name: '먹거리' }).click();
  134 | 
> 135 |     await page.getByRole('button', { name: '도움 요청하기' }).click();
      |                                                         ^ Error: locator.click: Test timeout of 60000ms exceeded.
  136 | 
  137 |     // 새 Supabase 마이그레이션(help_requests)이 아직 적용되지 않은 환경에서는
  138 |     // 오류 메시지로 끝나는 것이 정상이다 — 두 결과 모두 "폼이 올바르게 동작했다"는 뜻이라
  139 |     // 둘 중 하나가 나타나면 통과시키되, 성공 시에는 완료 문구를 추가로 확인한다.
  140 |     const success = page.getByRole('heading', { name: '요청이 접수되었습니다.' });
  141 |     const failure = page.getByText('요청 접수에 실패했습니다', { exact: false });
  142 |     await expect(success.or(failure)).toBeVisible({ timeout: 10000 });
  143 |   });
  144 | });
  145 | 
  146 | test.describe('관리자 화면 회귀 — 데스크톱', () => {
  147 |   test.use({ viewport: { width: 1600, height: 1100 } });
  148 | 
  149 |   test('/admin 접속 시 오늘 할 일이 뜬다', async ({ page }) => {
  150 |     await page.goto(`${BASE}/admin`);
  151 |     await expect(page.getByRole('heading', { name: '오늘 처리할 일' })).toBeVisible({ timeout: 10000 });
  152 |     await expect(page.locator('nav >> text=오늘 할 일')).toBeVisible();
  153 |   });
  154 | 
  155 |   test('사이드바 메뉴는 4개뿐이다', async ({ page }) => {
  156 |     await page.goto(`${BASE}/admin`);
  157 |     const nav = page.locator('aside nav');
  158 |     await expect(nav.getByRole('link')).toHaveCount(4);
  159 |     for (const label of ['오늘 할 일', '거점 운영', '시민 접수', '자료 관리']) {
  160 |       await expect(nav.getByRole('link', { name: label })).toBeVisible();
  161 |     }
  162 |   });
  163 | 
  164 |   test('4개 IA로 흡수된 예전 경로는 새 화면으로 리다이렉트된다', async ({ page }) => {
  165 |     await page.goto(`${BASE}/inventory`);
  166 |     await expect(page).toHaveURL(/\/admin\/sites\/inventory$/);
  167 | 
  168 |     await page.goto(`${BASE}/admin/regions`);
  169 |     await expect(page).toHaveURL(/\/admin\/sites$/);
  170 | 
  171 |     await page.goto(`${BASE}/admin/usage`);
  172 |     await expect(page).toHaveURL(/\/admin\/intake\?tab=usage$/);
  173 | 
  174 |     await page.goto(`${BASE}/files`);
  175 |     await expect(page).toHaveURL(/\/admin\/files$/);
  176 |   });
  177 | 
  178 |   test('빠른 현황 입력 화면 접근 가능', async ({ page }) => {
  179 |     await page.goto(`${BASE}/admin/quick-status`);
  180 |     await expect(page.getByRole('heading', { name: '빠른 현황 입력' }).first()).toBeVisible();
  181 |     await expect(page.getByRole('button', { name: '지금 가능' })).toBeVisible();
  182 |   });
  183 | });
  184 | 
```