# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: demo-mode.spec.ts >> 시연 모드 — 390×844 전체 흐름 >> /easy 로 이동해도 시연 모드와 전환바가 유지된다
- Location: e2e/demo-mode.spec.ts:91:3

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: '시연 모드' })

```

# Page snapshot

```yaml
- main [ref=e5]:
  - generic [ref=e6]:
    - generic [ref=e8]:
      - generic [ref=e9]:
        - generic:
          - generic:
            - generic [ref=e24]:
              - button
            - generic [ref=e25]:
              - button
            - generic [ref=e26]:
              - button
            - generic [ref=e27]:
              - button
            - generic [ref=e28]:
              - button
            - generic [ref=e29]:
              - button
            - generic [ref=e30]:
              - button
            - generic [ref=e31]:
              - button
            - generic [ref=e32]:
              - button
            - generic [ref=e33]:
              - button
            - generic [ref=e34]:
              - button
            - generic [ref=e35]:
              - button
            - generic [ref=e36]:
              - button
            - generic [ref=e37]:
              - button
            - generic [ref=e38]:
              - button
            - generic [ref=e39]:
              - button
            - generic [ref=e40]:
              - button
            - generic [ref=e41]:
              - button
            - generic [ref=e42]:
              - button
            - generic [ref=e43]:
              - button
            - generic [ref=e44]:
              - button
            - generic [ref=e45]:
              - button
            - generic [ref=e46]:
              - button
            - generic [ref=e47]:
              - button
            - generic [ref=e48]:
              - button
      - generic [ref=e49]:
        - generic [ref=e50]: 8km
        - link [ref=e54] [cursor=pointer]:
          - /url: http://map.kakao.com/
          - img "Kakao 맵으로 이동(새창열림)" [ref=e55]
    - generic:
      - button "전체 메뉴 열기" [ref=e56]
      - link "쉽게 보기" [ref=e58] [cursor=pointer]:
        - /url: /easy
    - generic:
      - navigation:
        - generic:
          - generic: 모아드림
          - button
        - list:
          - listitem:
            - link:
              - /url: /help
              - text: 도움 요청
          - listitem:
            - link:
              - /url: /donate
              - text: 물품 기부
          - listitem:
            - link:
              - /url: /info
              - text: 도움 정보
          - listitem:
            - link:
              - /url: /feedback
              - text: 말 남기기
          - listitem:
            - link:
              - /url: /guide
              - text: 이용 안내
    - generic [ref=e64]:
      - generic [ref=e65]: 화성 모아드림
      - generic [ref=e66]:
        - heading "가까운 그냥드림을 찾아드릴게요" [level=1] [ref=e67]
        - button "내 주변에서 찾기" [ref=e69]
        - generic [ref=e74]:
          - button "동네로 찾기" [ref=e75]
          - button "도움 요청" [ref=e76]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * 시연 모드 — 발표자가 주소창을 건드리지 않고 버튼만으로
  5   |  * 시민 → 현장 담당자 → 시민 → 시청 관리자를 오갈 수 있는지 검증한다.
  6   |  * 저장/제출 관련 검증은 `help_requests`/`site_quick_status` 마이그레이션이
  7   |  * 적용된 뒤에만 성공 문구가 뜨므로, citizen-flow.spec.ts와 같은
  8   |  * "성공 또는 실패 메시지 둘 다 허용" 패턴을 그대로 따른다.
  9   |  */
  10  | 
  11  | const BASE = 'http://localhost:5173';
  12  | 
  13  | test.describe('시연 모드 — 일반 접근에서는 노출되지 않는다', () => {
  14  |   test.use({ viewport: { width: 390, height: 844 } });
  15  | 
  16  |   test('시민 홈에는 작은 진입 버튼만 있고, 역할 전환 UI는 기본적으로 숨어 있다', async ({ page }) => {
  17  |     await page.goto(BASE);
  18  |     await expect(page.getByRole('button', { name: '시연 모드' })).toBeVisible();
  19  |     await expect(page.getByText('시연 중')).toHaveCount(0);
  20  |   });
  21  | 
  22  |   test('demoMode 없이 /admin에 직접 들어가도 전환바는 뜨지 않는다', async ({ page }) => {
  23  |     await page.goto(`${BASE}/admin`);
  24  |     await expect(page.getByRole('heading', { name: '오늘 처리할 일' })).toBeVisible({ timeout: 10000 });
  25  |     await expect(page.getByText('시연 중')).toHaveCount(0);
  26  |   });
  27  | });
  28  | 
  29  | test.describe('시연 모드 — 390×844 전체 흐름', () => {
  30  |   test.use({ viewport: { width: 390, height: 844 } });
  31  | 
  32  |   test('시민 → 현장 담당자 → 시민 → 도움 요청 → 시청 관리자 → 종료, 버튼만으로 전체 흐름', async ({ page }) => {
  33  |     await page.goto(BASE);
  34  | 
  35  |     // 1) 시연 모드 진입 → 역할 선택 UI
  36  |     await page.getByRole('button', { name: '시연 모드' }).click();
  37  |     await expect(page.getByRole('heading', { name: '모아드림 시연하기' })).toBeVisible();
  38  | 
  39  |     // 2) 현장 담당자로 전환
  40  |     await page.getByRole('button', { name: /현장 담당자로 보기/ }).click();
  41  |     await expect(page).toHaveURL(/\/admin$/);
  42  |     await expect(page.getByText('시연 중')).toBeVisible();
  43  | 
  44  |     // 3) 담당 거점을 고르면 첫 화면에서 바로 빠른 현황 입력을 할 수 있다
  45  |     await page.getByLabel('우리 거점').selectOption({ index: 1 });
  46  |     await expect(page.getByRole('heading', { name: '빠른 현황 입력' })).toBeVisible();
  47  |     await page.getByRole('button', { name: '지금 가능' }).click();
  48  |     await page.getByRole('button', { name: /^저장$/ }).click();
  49  |     const saved = page.getByText('저장 완료');
  50  |     const saveFailed = page.getByText('저장에 실패했습니다', { exact: false });
  51  |     await expect(saved.or(saveFailed)).toBeVisible({ timeout: 10000 });
  52  | 
  53  |     // 4) 모바일 축약 전환바("역할 변경")로 시민 전환
  54  |     await page.getByRole('button', { name: '역할 변경' }).click();
  55  |     await page.getByRole('button', { name: /시민으로 보기/ }).click();
  56  |     await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을/ })).toBeVisible();
  57  |     await expect(page.getByText('시연 중')).toBeVisible();
  58  | 
  59  |     // 5) 도움 요청 — demoMode가 /help에서도 유지된다
  60  |     await page.getByRole('link', { name: '도움 요청하기' }).click();
  61  |     await expect(page).toHaveURL(/\/help/);
  62  |     await expect(page.getByText('시연 중')).toBeVisible();
  63  | 
  64  |     await page.getByLabel('연락 가능한 번호').fill('010-1234-5678');
  65  |     await page.getByLabel('사는 읍면동').selectOption({ index: 1 });
  66  |     await page.getByRole('button', { name: '식품' }).click();
  67  |     await page.getByRole('button', { name: '요청 보내기' }).click();
  68  | 
  69  |     const requestSuccess = page.getByRole('heading', { name: '요청이 접수되었습니다.' });
  70  |     const requestFailed = page.getByText('요청 접수에 실패했습니다', { exact: false });
  71  |     await expect(requestSuccess.or(requestFailed)).toBeVisible({ timeout: 10000 });
  72  | 
  73  |     // 6) 시청 관리자로 전환 — "오늘 확인할 요청"에서 확인 가능해야 한다
  74  |     await page.getByRole('button', { name: '역할 변경' }).click();
  75  |     await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
  76  |     await expect(page).toHaveURL(/\/admin$/);
  77  |     await expect(page.getByRole('heading', { name: '오늘 처리할 일' })).toBeVisible({ timeout: 10000 });
  78  |     await expect(page.getByRole('button', { name: /^미처리 도움 요청/ })).toBeVisible();
  79  | 
  80  |     // 7) 새로고침 후에도 시연 모드가 유지된다
  81  |     await page.reload();
  82  |     await expect(page.getByText('시연 중')).toBeVisible({ timeout: 10000 });
  83  | 
  84  |     // 8) 시연 종료 — 역할 전환 UI가 사라지고 시민 홈으로 이동한다
  85  |     await page.getByRole('button', { name: '종료' }).click();
  86  |     await expect(page.getByRole('heading', { name: /지금 받을 수 있는 곳을/ })).toBeVisible();
  87  |     await expect(page.getByText('시연 중')).toHaveCount(0);
  88  |     await expect(page.getByRole('button', { name: '시연 모드' })).toBeVisible();
  89  |   });
  90  | 
  91  |   test('/easy 로 이동해도 시연 모드와 전환바가 유지된다', async ({ page }) => {
  92  |     await page.goto(BASE);
> 93  |     await page.getByRole('button', { name: '시연 모드' }).click();
      |                                                       ^ Error: locator.click: Test timeout of 60000ms exceeded.
  94  |     await page.getByRole('button', { name: /시민으로 보기/ }).click();
  95  |     await expect(page.getByText('시연 중')).toBeVisible();
  96  | 
  97  |     await page.getByRole('link', { name: '간편하게 이용하기' }).click();
  98  |     await expect(page).toHaveURL(/\/easy/);
  99  |     await expect(page.getByRole('heading', { name: '간편하게 이용하기' })).toBeVisible();
  100 |     await expect(page.getByText('시연 중')).toBeVisible();
  101 |   });
  102 | 
  103 |   test('뒤로가기 후에도 demoMode가 유지된다', async ({ page }) => {
  104 |     await page.goto(BASE);
  105 |     await page.getByRole('button', { name: '시연 모드' }).click();
  106 |     await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
  107 |     await expect(page).toHaveURL(/\/admin$/);
  108 | 
  109 |     await page.goBack();
  110 |     await expect(page.getByText('시연 중')).toBeVisible({ timeout: 10000 });
  111 |   });
  112 | });
  113 | 
  114 | test.describe('시연 모드 — 데스크톱 관리자 전환바', () => {
  115 |   test.use({ viewport: { width: 1600, height: 1100 } });
  116 | 
  117 |   test('데스크톱에서는 역할 3개가 각각 버튼으로 노출되고 클릭만으로 전환된다', async ({ page }) => {
  118 |     await page.goto(BASE);
  119 |     await page.getByRole('button', { name: '시연 모드' }).click();
  120 |     await page.getByRole('button', { name: /시청 관리자로 보기/ }).click();
  121 |     await expect(page).toHaveURL(/\/admin$/);
  122 | 
  123 |     await expect(page.getByRole('button', { name: '시민', exact: true })).toBeVisible();
  124 |     await expect(page.getByRole('button', { name: '현장 담당자', exact: true })).toBeVisible();
  125 |     await expect(page.getByRole('button', { name: '시청 관리자', exact: true })).toBeVisible();
  126 | 
  127 |     await page.getByRole('button', { name: '현장 담당자', exact: true }).click();
  128 |     await expect(page).toHaveURL(/\/admin$/);
  129 |     // 같은 경로에서 첫 화면만 현장 담당자용으로 바뀐다.
  130 |     await expect(page.getByRole('heading', { name: /담당 거점을 선택해 주세요|빠른 현황 입력/ })).toBeVisible();
  131 |   });
  132 | });
  133 | 
```