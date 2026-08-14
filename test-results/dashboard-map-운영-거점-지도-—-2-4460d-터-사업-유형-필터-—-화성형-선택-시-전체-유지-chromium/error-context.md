# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard-map.spec.ts >> 운영 거점 지도 — 25곳 마커 및 필터 >> 사업 유형 필터 — 화성형 선택 시 전체 유지
- Location: e2e/dashboard-map.spec.ts:82:3

# Error details

```
TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('[aria-label="지도 필터"]') to be visible

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - link "오늘 할 일 홈으로 이동" [ref=e6] [cursor=pointer]:
        - /url: /admin
        - img "화성특례시" [ref=e7]
        - paragraph [ref=e8]: 화성형 그냥드림 통합 운영 플랫폼
      - button "사이드바 접기" [expanded] [ref=e9]
    - navigation [ref=e12]:
      - link "오늘 할 일" [ref=e14] [cursor=pointer]:
        - /url: /admin
      - link "거점 운영" [ref=e20] [cursor=pointer]:
        - /url: /admin/sites
      - link "시민 접수" [ref=e26] [cursor=pointer]:
        - /url: /admin/intake
      - link "자료 관리" [ref=e31] [cursor=pointer]:
        - /url: /admin/files
    - generic [ref=e34]: AI 화성 챌린지 시제품
  - generic [ref=e35]:
    - banner [ref=e36]:
      - heading "오늘 할 일" [level=1] [ref=e37]
      - generic [ref=e38]:
        - group "역할 선택" [ref=e39]:
          - button "시청 관리자" [pressed] [ref=e40]
          - button "현장 담당자" [ref=e41]
        - generic [ref=e42]: 시청 관리자
    - main [ref=e48]:
      - generic [ref=e49]:
        - generic [ref=e51]:
          - heading "오늘 할 일" [level=2] [ref=e52]
          - paragraph [ref=e53]: 지금 확인하고 조치해야 할 건을 먼저 보여 드립니다. 통계는 화면 맨 아래에 있습니다.
        - generic [ref=e54]:
          - region "오늘 처리할 일" [ref=e55]:
            - generic [ref=e56]:
              - generic [ref=e57]:
                - heading "오늘 처리할 일" [level=2] [ref=e58]
                - generic [ref=e59]: 48건
              - link "전화로 받은 요청 대신 입력" [ref=e60] [cursor=pointer]:
                - /url: /admin/help-requests/new
            - group "조치 종류 필터" [ref=e67]:
              - button "전체 48" [pressed] [ref=e68]
              - button "미처리 도움 요청 13" [ref=e69]
              - button "오늘 들어온 기부 2" [ref=e70]
              - button "정보 갱신 필요 23" [ref=e71]
              - button "부족·확인 필요 10" [ref=e72]
            - generic [ref=e73]:
              - list [ref=e74]:
                - listitem [ref=e75]:
                  - generic [ref=e77]:
                    - generic [ref=e78]:
                      - generic [ref=e79]: 미처리 도움 요청
                      - generic [ref=e80]: 봉담읍
                      - generic [ref=e81]: ·
                      - generic [ref=e82]: 식품 도움 요청
                      - generic [ref=e83]: ·
                      - generic [ref=e84]: 23:57 접수
                    - link "확인" [ref=e85] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=aeb007bd-b54e-47c3-8e21-2d6e1dd19751
                - listitem [ref=e88]:
                  - generic [ref=e90]:
                    - generic [ref=e91]:
                      - generic [ref=e92]: 미처리 도움 요청
                      - generic [ref=e93]: 봉담읍
                      - generic [ref=e94]: ·
                      - generic [ref=e95]: 식품 도움 요청
                      - generic [ref=e96]: ·
                      - generic [ref=e97]: 23:55 접수
                    - link "확인" [ref=e98] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=810721f8-5597-409f-8b7b-f4bcb59160b5
                - listitem [ref=e101]:
                  - generic [ref=e103]:
                    - generic [ref=e104]:
                      - generic [ref=e105]: 미처리 도움 요청
                      - generic [ref=e106]: 봉담읍
                      - generic [ref=e107]: ·
                      - generic [ref=e108]: 식품 도움 요청
                      - generic [ref=e109]: ·
                      - generic [ref=e110]: 23:52 접수
                    - link "확인" [ref=e111] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=7bcbd2a0-db80-472f-9be4-689144a79720
                - listitem [ref=e114]:
                  - generic [ref=e116]:
                    - generic [ref=e117]:
                      - generic [ref=e118]: 미처리 도움 요청
                      - generic [ref=e119]: 봉담읍
                      - generic [ref=e120]: ·
                      - generic [ref=e121]: 식품 도움 요청
                      - generic [ref=e122]: ·
                      - generic [ref=e123]: 23:50 접수
                    - link "확인" [ref=e124] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=d33c437a-4fef-49c0-9a59-1fed6ffbf556
                - listitem [ref=e127]:
                  - generic [ref=e129]:
                    - generic [ref=e130]:
                      - generic [ref=e131]: 미처리 도움 요청
                      - generic [ref=e132]: 봉담읍
                      - generic [ref=e133]: ·
                      - generic [ref=e134]: 식품 도움 요청
                      - generic [ref=e135]: ·
                      - generic [ref=e136]: 23:49 접수
                    - link "확인" [ref=e137] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=1d850b82-aadc-4bad-a2de-c99fc4d9d80c
                - listitem [ref=e140]:
                  - generic [ref=e142]:
                    - generic [ref=e143]:
                      - generic [ref=e144]: 미처리 도움 요청
                      - generic [ref=e145]: 동탄5동
                      - generic [ref=e146]: ·
                      - generic [ref=e147]: 식품 도움 요청
                      - generic [ref=e148]: ·
                      - generic [ref=e149]: 23:17 접수
                    - link "확인" [ref=e150] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=e80e15a3-5740-40fd-a84e-cafe5dc9351c
                - listitem [ref=e153]:
                  - generic [ref=e155]:
                    - generic [ref=e156]:
                      - generic [ref=e157]: 미처리 도움 요청
                      - generic [ref=e158]: 동탄5동
                      - generic [ref=e159]: ·
                      - generic [ref=e160]: 식품 도움 요청
                      - generic [ref=e161]: ·
                      - generic [ref=e162]: 23:15 접수
                    - link "확인" [ref=e163] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=c5f4d0a0-9c7a-43d9-9911-0a4f29e57403
                - listitem [ref=e166]:
                  - generic [ref=e168]:
                    - generic [ref=e169]:
                      - generic [ref=e170]: 미처리 도움 요청
                      - generic [ref=e171]: 병점1동
                      - generic [ref=e172]: ·
                      - generic [ref=e173]: 식품 도움 요청
                      - generic [ref=e174]: ·
                      - generic [ref=e175]: 21:43 접수
                    - link "확인" [ref=e176] [cursor=pointer]:
                      - /url: /admin/intake?tab=help&id=5bf7c0f4-370c-4e8f-b2b1-3b6858ee1f00
              - paragraph [ref=e179]: 외 40건
            - paragraph [ref=e180]: 도움 요청·기부·거점 갱신은 실제 접수 자료 기준입니다. 부족·유통기한 임박은 아직 거점 시연 수치입니다.
          - region "화성시 거점 현황" [ref=e181]:
            - generic [ref=e182]:
              - generic [ref=e183]: 화성시 거점 25곳
              - generic [ref=e184]:
                - text: 정상
                - strong [ref=e186]: "15"
              - generic [ref=e187]:
                - text: 부족
                - strong [ref=e189]: "6"
              - generic [ref=e190]:
                - text: 확인 필요
                - strong [ref=e192]: "4"
              - generic [ref=e193]: 최근 현장 갱신 오늘 13:43
            - generic [ref=e194]:
              - generic [ref=e195]:
                - generic [ref=e196]:
                  - heading "화성시 거점 운영 지도" [level=3] [ref=e197]
                  - button "지도 크게 보기" [ref=e198]: 전체화면
                - group "지도 검색 및 필터" [ref=e208]:
                  - combobox "지도 거점 검색" [ref=e214]
                  - group "구역 필터" [ref=e216]:
                    - button "전체" [pressed] [ref=e217]
                    - button "만세구 운영 상태 유통기한 임박" [ref=e218]:
                      - text: 만세구
                      - generic [ref=e220]: 운영 상태 유통기한 임박
                    - button "효행구 운영 상태 정상 운영" [ref=e221]:
                      - text: 효행구
                      - generic [ref=e223]: 운영 상태 정상 운영
                    - button "병점구 운영 상태 정상 운영" [ref=e224]:
                      - text: 병점구
                      - generic [ref=e226]: 운영 상태 정상 운영
                    - button "동탄구 운영 상태 유통기한 임박" [ref=e227]:
                      - text: 동탄구
                      - generic [ref=e229]: 운영 상태 유통기한 임박
                  - combobox "사업 유형 필터" [ref=e230] [cursor=pointer]:
                    - option "사업유형 전체" [selected]
                    - option "국가형"
                    - option "화성형"
                  - button "필터" [ref=e232]
                  - generic [ref=e234]: 지도 위치 25
                - generic [ref=e236]:
                  - region "화성특례시 4개 구 거점 운영 지도" [ref=e237]:
                    - generic [ref=e238]:
                      - generic:
                        - generic:
                          - button "화성시동탄치동천종합사회복지관 · 정상 운영" [ref=e292] [cursor=pointer]:
                            - generic "화성시동탄치동천종합사회복지관": 동탄치동천종합사회복지관
                          - button "화성시동탄어울림종합사회복지관 · 정상 운영" [ref=e294] [cursor=pointer]:
                            - generic "화성시동탄어울림종합사회복지관": 동탄어울림종합사회복지관
                          - button "화성시서부종합사회복지관 · 정상 운영" [ref=e296] [cursor=pointer]:
                            - generic "화성시서부종합사회복지관": 서부종합사회복지관
                          - button "화성시아르딤복지관 · 유통기한 임박" [ref=e298] [cursor=pointer]:
                            - generic "화성시아르딤복지관": 아르딤복지관
                          - button "화성시동탄아르딤복지관 · 물품 부족" [ref=e300] [cursor=pointer]:
                            - generic "화성시동탄아르딤복지관": 동탄아르딤복지관
                          - button "화성시남부노인복지관 · 정상 운영" [ref=e302] [cursor=pointer]:
                            - generic "화성시남부노인복지관": 남부노인복지관
                          - button "화성시서부노인복지관 · 물품 부족" [ref=e304] [cursor=pointer]:
                            - generic "화성시서부노인복지관": 서부노인복지관
                          - button "화성시동탄노인복지관 · 정상 운영" [ref=e306] [cursor=pointer]:
                            - generic "화성시동탄노인복지관": 동탄노인복지관
                          - button "화성시정조효노인복지관 · 정상 운영" [ref=e308] [cursor=pointer]:
                            - generic "화성시정조효노인복지관": 정조효노인복지관
                          - button "우정읍지역사회보장협의체 · 정상 운영" [ref=e310] [cursor=pointer]:
                            - generic "우정읍지역사회보장협의체": 우정읍 협의체
                          - button "향남읍지역사회보장협의체 · 유통기한 임박" [ref=e312] [cursor=pointer]:
                            - generic "향남읍지역사회보장협의체": 향남읍 협의체
                          - button "남양읍지역사회보장협의체 · 물품 부족" [ref=e314] [cursor=pointer]:
                            - generic "남양읍지역사회보장협의체": 남양읍 협의체
                          - button "봉담읍지역사회보장협의체 · 물품 부족" [ref=e316] [cursor=pointer]:
                            - generic "봉담읍지역사회보장협의체": 봉담읍 협의체
                          - button "서신면지역사회보장협의체 · 정상 운영" [ref=e318] [cursor=pointer]:
                            - generic "서신면지역사회보장협의체": 서신면 협의체
                          - button "양감면지역사회보장협의체 · 정상 운영" [ref=e320] [cursor=pointer]:
                            - generic "양감면지역사회보장협의체": 양감면 협의체
                          - button "비봉면지역사회보장협의체 · 정상 운영" [ref=e322] [cursor=pointer]:
                            - generic "비봉면지역사회보장협의체": 비봉면 협의체
                          - button "새솔동지역사회보장협의체 · 유통기한 임박" [ref=e324] [cursor=pointer]:
                            - generic "새솔동지역사회보장협의체": 새솔동 협의체
                          - button "기배동지역사회보장협의체 · 정상 운영" [ref=e326] [cursor=pointer]:
                            - generic "기배동지역사회보장협의체": 기배동 협의체
                          - button "병점1동지역사회보장협의체 · 정상 운영" [ref=e328] [cursor=pointer]:
                            - generic "병점1동지역사회보장협의체": 병점1동 협의체
                          - button "병점2동지역사회보장협의체 · 물품 부족" [ref=e330] [cursor=pointer]:
                            - generic "병점2동지역사회보장협의체": 병점2동 협의체
                          - button "동탄4동지역사회보장협의체 · 정상 운영" [ref=e332] [cursor=pointer]:
                            - generic "동탄4동지역사회보장협의체": 동탄4동 협의체
                          - button "동탄6동지역사회보장협의체 · 정상 운영" [ref=e334] [cursor=pointer]:
                            - generic "동탄6동지역사회보장협의체": 동탄6동 협의체
                          - button "동탄7동지역사회보장협의체 · 정상 운영" [ref=e336] [cursor=pointer]:
                            - generic "동탄7동지역사회보장협의체": 동탄7동 협의체
                          - button "동탄8동지역사회보장협의체 · 물품 부족" [ref=e338] [cursor=pointer]:
                            - generic "동탄8동지역사회보장협의체": 동탄8동 협의체
                          - button "동탄9동지역사회보장협의체 · 유통기한 임박" [ref=e340] [cursor=pointer]:
                            - generic "동탄9동지역사회보장협의체": 동탄9동 협의체
                    - generic [ref=e341]:
                      - generic [ref=e342]: 4km
                      - link [ref=e346] [cursor=pointer]:
                        - /url: http://map.kakao.com/
                        - img "Kakao 맵으로 이동(새창열림)" [ref=e347]
                    - generic [ref=e348]:
                      - button "확대" [ref=e349] [cursor=pointer]
                      - generic [ref=e351] [cursor=pointer]
                      - button "축소" [ref=e357] [cursor=pointer]
                  - button "전체 보기" [ref=e358]
                - generic [ref=e359]:
                  - list [ref=e360]:
                    - listitem [ref=e361]: 정상 운영
                    - listitem [ref=e363]: 물품 부족
                    - listitem [ref=e365]: 유통기한 임박
                    - listitem [ref=e367]: 자료 확인 필요
                  - paragraph [ref=e369]: 전체 사업 프로그램 43개 · 지도 위치 확인 25개 (거점 명단 중 위치 확인 중 16개)
                  - paragraph [ref=e370]: "위치·주소는 공식 데이터, 재고·수요는 데모 수치입니다. · 경계: 통계청 SGIS(공공누리 제1유형)"
              - generic [ref=e371]:
                - button "운영 패널 접기" [expanded] [ref=e372]
                - generic [ref=e375]:
                  - heading "선택 지역·기관 요약" [level=3] [ref=e376]
                  - generic [ref=e378]:
                    - heading "화성시 전체" [level=4] [ref=e379]
                    - paragraph [ref=e380]:
                      - text: 운영 거점
                      - generic [ref=e381]: 25곳
                      - text: · 거점 마커를 선택하면 운영 현황을 확인할 수 있습니다.
                    - paragraph [ref=e382]:
                      - text: 운영 지표
                      - generic [ref=e383]: 시연 데이터
                    - generic [ref=e384]:
                      - generic [ref=e385]:
                        - term [ref=e386]: 물품 부족 거점
                        - definition [ref=e387]: 6개소
                      - generic [ref=e388]:
                        - term [ref=e389]: 유통기한 임박 수량
                        - definition [ref=e390]: 155개
                      - generic [ref=e391]:
                        - term [ref=e392]: 자료 확인 필요
                        - definition [ref=e393]: 0개소
                    - generic [ref=e395]:
                      - heading "오늘 확인이 필요한 사항" [level=4] [ref=e396]
                      - list [ref=e397]:
                        - listitem [ref=e398]:
                          - generic [ref=e399]:
                            - paragraph [ref=e400]: 동탄아르딤복지관분유 800g · 20개 부족
                            - generic [ref=e401]: 부족
                          - paragraph [ref=e402]: 발주 또는 신규 확보 검토
                          - paragraph [ref=e405]: 동탄구
                        - listitem [ref=e406]:
                          - generic [ref=e407]:
                            - paragraph [ref=e408]: 서부노인복지관즉석밥 세트 · 20개 부족
                            - generic [ref=e409]: 부족
                          - paragraph [ref=e410]: 발주 또는 신규 확보 검토
                          - paragraph [ref=e413]: 만세구
                        - listitem [ref=e414]:
                          - generic [ref=e415]:
                            - paragraph [ref=e416]: 남양읍 협의체생필품 꾸러미 · 20개 부족
                            - generic [ref=e417]: 부족
                          - paragraph [ref=e418]: 발주 또는 신규 확보 검토
                          - paragraph [ref=e421]: 만세구
                        - listitem [ref=e422]:
                          - generic [ref=e423]:
                            - paragraph [ref=e424]: 봉담읍 협의체위생용품 세트 · 20개 부족
                            - generic [ref=e425]: 부족
                          - paragraph [ref=e426]: 발주 또는 신규 확보 검토
                          - paragraph [ref=e429]: 효행구
                        - listitem [ref=e430]:
                          - generic [ref=e431]:
                            - paragraph [ref=e432]: 동탄8동 협의체즉석밥 세트 · 10개 부족
                            - generic [ref=e433]: 부족
                          - paragraph [ref=e434]: 발주 또는 신규 확보 검토
                          - paragraph [ref=e437]: 동탄구
          - region "보조 통계" [ref=e438]:
            - heading "보조 통계" [level=2] [ref=e439]
            - generic [ref=e440]:
              - generic [ref=e441]:
                - term [ref=e442]: 자료 제출
                - definition [ref=e443]: 3 / 29곳
              - generic [ref=e444]:
                - term [ref=e445]: 누적 이용자
                - definition [ref=e446]: 226명
              - generic [ref=e447]:
                - term [ref=e448]: 중앙 집계 재고
                - definition [ref=e449]: 105개
              - link [ref=e450] [cursor=pointer]:
                - /url: /admin/files
                - term [ref=e451]: 자료 오류
                - definition [ref=e452]: 0건
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | 
  3   | /**
  4   |  * 화성시 거점 운영 지도 검증
  5   |  *
  6   |  * 기대값의 근거는 `src/data/justdream_sites_25.ts` (기관명 source of truth, 25건) 다.
  7   |  * 지도 마커·필터 카운터는 모두 이 시드에서 파생되므로 시드가 바뀌면 아래 숫자도 함께 고쳐야 한다.
  8   |  *   - 전체 25곳 = 복지기관 9 + 지역사회보장협의체 16
  9   |  *   - 시설유형: 행정복지센터 16 · 복지관 9 · 푸드뱅크·기타 0
  10  |  *
  11  |  * 검증 항목
  12  |  * 1. 초기 필터 카운터 "전체 25곳" 표시
  13  |  * 2. 시설 유형·운영 상태 필터 적용 시 "25곳 중 N곳" 으로 변경
  14  |  * 3. 카카오 지도 로드 후 .gj-marker 요소 25개 생성 (동일 좌표 기관도 마커는 각각)
  15  |  * 4. 필터 적용 시 마커 수가 카운터와 함께 줄어듦
  16  |  * 5. 마커 클릭 → 거점 상세 패널(주요 품목·읍면동 이동 버튼) 표시
  17  |  * 6. 읍면동 대시보드 링크 href 가 /regions/:districtId 형식과 일치
  18  |  * 7. /regions/:districtId 라우팅 실제 동작
  19  |  */
  20  | 
  21  | const BASE = 'http://localhost:5173';
  22  | 
  23  | /**
  24  |  * 개별 거점 마커는 지도 레벨이 CLUSTER_ZOOM_THRESHOLD(10) 미만일 때만 그려진다.
  25  |  * 그 이상으로 축소되면 구 단위 요약 원(.gj-cluster)만 남는 것이 의도된 동작이다.
  26  |  * 기본 뷰포트(1280x720)에서는 지도 영역이 좁아(635x600) 화성시 전체를 담을 때 레벨이 10 이상이 되어
  27  |  * .gj-marker 가 하나도 없다. 실제 사용 환경(데스크톱 관제 화면)에 맞춰 넓은 뷰포트로 고정한다.
  28  |  */
  29  | test.use({ viewport: { width: 1600, height: 1100 } });
  30  | 
  31  | /** 확정 시드 기준 전체 거점 수 */
  32  | const TOTAL_SITES = 25;
  33  | /** 시설유형 = 행정복지센터 (지역사회보장협의체 16곳의 운영 위치) */
  34  | const ADMIN_CENTER_SITES = 16;
  35  | /** 시설유형 = 복지관 (복지기관 9곳) */
  36  | const WELFARE_CENTER_SITES = 9;
  37  | 
  38  | /**
  39  |  * 필터 바의 거점 수 카운터.
  40  |  * 지도 로딩 오버레이(KakaoDistrictMap)에도 aria-live="polite" 가 붙어 있어서
  41  |  * 문서 전체에서 찾으면 로딩 중 두 개가 잡힌다(strict mode 위반). 필터 바 안으로 한정한다.
  42  |  */
  43  | function counterOf(page: import('@playwright/test').Page) {
  44  |   return page.locator('[aria-label="지도 필터"] [aria-live="polite"]');
  45  | }
  46  | 
  47  | /**
  48  |  * 지도가 결판날 때까지(마커가 그려지거나, SDK 로드 실패로 로딩 오버레이가 걷힐 때까지)
  49  |  * 기다린 뒤 마커 수를 돌려준다. 0 이면 카카오 SDK 를 못 불러온 것이다.
  50  |  *
  51  |  * `polling: 1000` 이 중요하다. 기본값인 rAF 폴링은 SDK script 가 응답을 기다리며
  52  |  * 메인 스레드를 붙잡고 있는 동안 돌지 못해서, 지정한 timeout 보다 훨씬 늦게(관측상 15s → 34s)
  53  |  * 풀린다. 그 사이 테스트 전체 타임아웃이 먼저 터져 skip 대신 fail 로 끝난다.
  54  |  */
  55  | async function settledMarkerCount(page: import('@playwright/test').Page): Promise<number> {
  56  |   await page
  57  |     .waitForFunction(
  58  |       () =>
  59  |         document.querySelectorAll('.gj-marker').length > 0 ||
  60  |         !document.body.innerText.includes('지도를 불러오는 중입니다'),
  61  |       undefined,
  62  |       { timeout: 45000, polling: 1000 },
  63  |     )
  64  |     .catch(() => {
  65  |       /* 결판이 안 나면 아래에서 0 으로 읽혀 skip 된다 */
  66  |     });
  67  |   return page.locator('.gj-marker').count();
  68  | }
  69  | 
  70  | test.describe(`운영 거점 지도 — ${TOTAL_SITES}곳 마커 및 필터`, () => {
  71  |   test.beforeEach(async ({ page }) => {
  72  |     await page.goto(`${BASE}/admin`);
  73  |     // 대시보드가 렌더링될 때까지 대기
> 74  |     await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });
      |                ^ TimeoutError: page.waitForSelector: Timeout 10000ms exceeded.
  75  |   });
  76  | 
  77  |   test(`초기 필터 카운터에 전체 ${TOTAL_SITES}곳 표시`, async ({ page }) => {
  78  |     const counter = counterOf(page);
  79  |     await expect(counter).toHaveText(`전체 ${TOTAL_SITES}곳`);
  80  |   });
  81  | 
  82  |   test('사업 유형 필터 — 화성형 선택 시 전체 유지', async ({ page }) => {
  83  |     await page.selectOption('[aria-label="사업 유형 필터"]', 'HWASEONG');
  84  |     const counter = counterOf(page);
  85  |     // 확정 시드 25곳은 전부 화성형이라 걸러지는 거점이 없다.
  86  |     await expect(counter).toHaveText(`전체 ${TOTAL_SITES}곳`);
  87  |   });
  88  | 
  89  |   test(`시설 유형 필터 — 행정복지센터 ${ADMIN_CENTER_SITES}곳`, async ({ page }) => {
  90  |     await page.selectOption('[aria-label="시설 유형 필터"]', '행정복지센터');
  91  |     const counter = counterOf(page);
  92  |     await expect(counter).toHaveText(`${TOTAL_SITES}곳 중 ${ADMIN_CENTER_SITES}곳`);
  93  |   });
  94  | 
  95  |   test(`시설 유형 필터 — 복지관 ${WELFARE_CENTER_SITES}곳`, async ({ page }) => {
  96  |     await page.selectOption('[aria-label="시설 유형 필터"]', '복지관');
  97  |     const counter = counterOf(page);
  98  |     await expect(counter).toHaveText(`${TOTAL_SITES}곳 중 ${WELFARE_CENTER_SITES}곳`);
  99  |   });
  100 | 
  101 |   test('운영 상태 필터 — 부족 선택', async ({ page }) => {
  102 |     await page.selectOption('[aria-label="운영 상태 필터"]', 'shortage');
  103 |     const counter = counterOf(page);
  104 |     const text = await counter.textContent();
  105 |     expect(text).toMatch(new RegExp(`^${TOTAL_SITES}곳 중 \\d+곳$`));
  106 |     // shortage 사이트가 최소 1개는 있어야 함
  107 |     const match = text?.match(new RegExp(`${TOTAL_SITES}곳 중 (\\d+)곳`));
  108 |     expect(Number(match?.[1])).toBeGreaterThan(0);
  109 |   });
  110 | 
  111 |   test(`필터 초기화 — 전체로 돌아가면 ${TOTAL_SITES}곳 복원`, async ({ page }) => {
  112 |     await page.selectOption('[aria-label="시설 유형 필터"]', '복지관');
  113 |     await page.selectOption('[aria-label="시설 유형 필터"]', 'ALL');
  114 |     const counter = counterOf(page);
  115 |     await expect(counter).toHaveText(`전체 ${TOTAL_SITES}곳`);
  116 |   });
  117 | });
  118 | 
  119 | test.describe('카카오 지도 마커 렌더링', () => {
  120 |   test(`지도 로드 후 .gj-marker ${TOTAL_SITES}개 생성 및 중복 없음`, async ({ page }) => {
  121 |     await page.goto(`${BASE}/admin`);
  122 |     await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });
  123 | 
  124 |     const markerCount = await settledMarkerCount(page);
  125 |     // SDK 로드 실패(네트워크 제한 등)는 스킵
  126 |     test.skip(markerCount === 0, '카카오 SDK 미로드 — 마커 검증 스킵');
  127 | 
  128 |     expect(markerCount).toBe(TOTAL_SITES);
  129 |   });
  130 | 
  131 |   test(`시설유형=복지관 필터 적용 후 마커 ${WELFARE_CENTER_SITES}개만 표시`, async ({ page }) => {
  132 |     await page.goto(`${BASE}/admin`);
  133 |     await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });
  134 | 
  135 |     // 마커가 로드될 때까지 대기
  136 |     test.skip((await settledMarkerCount(page)) === 0, '카카오 SDK 미로드 — 마커 검증 스킵');
  137 | 
  138 |     await page.selectOption('[aria-label="시설 유형 필터"]', '복지관');
  139 |     // 가시성 변경이 반영될 때까지 잠시 대기
  140 |     await page.waitForTimeout(500);
  141 | 
  142 |     // CustomOverlay는 setMap(null)로 DOM에서 제거됨 — 남은 것이 표시 중인 마커
  143 |     const totalMarkers = await page.locator('.gj-marker').count();
  144 |     expect(totalMarkers).toBe(WELFARE_CENTER_SITES);
  145 |   });
  146 | });
  147 | 
  148 | test.describe('거점 상세 패널 — 마커 클릭', () => {
  149 |   test('마커 클릭 시 상세 패널에 필수 정보 표시', async ({ page }) => {
  150 |     await page.goto(`${BASE}/admin`);
  151 |     await page.waitForSelector('[aria-label="지도 필터"]', { timeout: 10000 });
  152 | 
  153 |     test.skip((await settledMarkerCount(page)) === 0, '카카오 SDK 미로드 — 마커 클릭 검증 스킵');
  154 | 
  155 |     // 첫 번째 마커 클릭
  156 |     const firstMarker = page.locator('.gj-marker').first();
  157 |     await firstMarker.click();
  158 | 
  159 |     // 상세 패널에 주요 품목 행 표시 확인
  160 |     await expect(page.locator('text=주요 품목')).toBeVisible({ timeout: 5000 });
  161 | 
  162 |     // 거점 상세로 가는 CTA 확인 — 지도에서 고른 거점을 실제로 처리하는 화면이다
  163 |     const detailLink = page.locator('a:has-text("거점 상세 열기")');
  164 |     await expect(detailLink).toBeVisible();
  165 |     expect(await detailLink.getAttribute('href')).toMatch(/\/admin\/sites\/justdream-\d+$/);
  166 | 
  167 |     // 소속 구 현황 링크도 함께 남아 있다
  168 |     const regionLink = page.locator('a:has-text("소속 구 현황 보기")');
  169 |     const href = await regionLink.getAttribute('href');
  170 |     expect(href).toMatch(/\/admin\/regions\/(manse|hyohaeng|byeongjeom|dongtan)/);
  171 |   });
  172 | 
  173 |   test('거점 상세 열기 링크가 실제 라우트로 이동', async ({ page }) => {
  174 |     await page.goto(`${BASE}/admin`);
```