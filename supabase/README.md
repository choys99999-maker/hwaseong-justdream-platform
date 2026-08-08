# Supabase 중앙 저장소

Excel 업로드 자료를 브라우저가 아니라 Supabase 중앙 DB에 저장하고,
**모든 화면이 같은 중앙 DB를 읽는다.** 별도의 "취합" 동작 없이
읍면동들이 올린 자료가 통합 대시보드에 자동으로 합산된다.

## 테이블

| 테이블 | 역할 |
| --- | --- |
| `organizations` | 읍면동 목록 (업로드 시 명시적으로 선택) |
| `submissions` | Excel 한 파일 = 1건. `status`로 유효/대체 구분 |
| `submission_files` | 원본 Excel의 Storage 경로 추적 |
| `submission_sheets` | 시트별 추적 (유형·건수·오류수·`is_cumulative`) |
| `performance_records` | 주간 실적 (숫자 컬럼은 integer) |
| `referral_records` | 복지 연계 (날짜 컬럼은 date) |
| `inventory_records` | 물품·재고 |

- 모든 업무 레코드는 `submission_id` + `organization_id`를 가진다.
- 저장은 `create_submission()` RPC 한 번 = 단일 트랜잭션. 부분 성공이 없다.
- worker(`excelWorker.ts`)가 만든 camelCase 정규화 레코드(jsonb)를 그대로 받아
  타입 컬럼에 캐스팅해 넣는다. 한글 label Map으로 되돌리지 않는다.

## 중복 집계를 막는 두 가지 장치

여러 기관이 여러 번 자료를 올리는 구조라서, 단순 합산은 두 방향으로 틀린다.

1. **누계 시트** — 한 파일에 "주별 실적"과 "누계 실적"이 같이 오면 같은 값을 두 번 센다.
   → `submission_sheets.is_cumulative`(시트 이름에 `누계` 포함 시 true)로 표시하고
   집계 view에서 제외한다.
2. **재제출본** — 같은 기관이 같은 기간 자료를 다시 올리면 예전 제출본까지 더해진다.
   → `create_submission()`이 같은 기관의 이전 제출본 중
   **기간이 완전히 같거나 파일 이름이 같은 것**을 `status='superseded'`로 내린다.
   다른 주차 자료는 그대로 유효하다.

두 규칙은 helper view(`v_active_submissions`, `v_performance_rows`,
`v_referral_rows`, `v_inventory_rows`)에 한 번만 적어 두고,
화면용 view는 반드시 이 helper를 거친다.

## 화면용 VIEW

materialized view나 별도 집계 서버 없이 일반 VIEW만 쓴다. (현재 규모에서 충분)

| view | 쓰는 화면 |
| --- | --- |
| `v_city_overview` | 통합 대시보드 KPI (전체 이용자·상담·연계·기간) |
| `v_region_usage` | 지역별 현황 카드, 지역 상세, 대시보드 지역 차트, 실적·복지연계 |
| `v_inventory_status` | 물품·재고 관리 |
| `v_welfare_linkage` | 실적·복지연계 (개인정보 컬럼 없음) |
| `v_submission_status` | 대시보드 "최근 제출 자료" |
| `v_monthly_activity` | 월별 차트 (대시보드·지역 상세) |

`v_inventory_status` 주의: 입고·출고는 기간 누적이라 **합계**를 쓰고,
현재재고·유통기한은 스냅샷이라 **가장 최근 제출본의 값**을 쓴다.
재고를 더하면 실제보다 부풀려진다.
유통기한 임박(`is_expiring_soon`, 30일 이내) 판단도 이 view에서만 한다.
화면마다 따로 계산하지 않는다.

## 새 Supabase 프로젝트에 적용하는 방법

1. https://supabase.com/dashboard 에서 프로젝트 생성
2. SQL Editor에서 `migrations/` 아래 파일을 순서대로 실행
   - `20260808000000_phase1_central_store.sql` (스키마 + RPC + RLS + 읍면동 시드)
   - `20260808000100_phase1_storage.sql` (`submissions` 버킷 + Storage 정책)
   - `20260808010000_phase2_aggregation.sql` (재제출/누계 구조 + 집계 view)
   - 또는 CLI: `supabase link --project-ref <ref>` 후 `supabase db push`
3. `.env.local`에 환경변수 설정 (`.env.example` 참고)
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon public key>
   ```
4. dev 서버 재시작.

환경변수가 없으면 화면은 "중앙 저장소가 설정되지 않았습니다" 안내를 띄운다.
(예전의 IndexedDB 폴백은 없다 — 중앙 DB가 유일한 source of truth다)

## ⚠️ 데모 한정 임시 권한 정책 (운영 사용 금지)

로그인이 없는 단계라 다음이 모두 열려 있다:

- anon 키만 있으면 **모든 테이블·view 전체 읽기** 가능.
  `referral_records`에는 이름·생년월일·주소가 들어 있고, 화면은 마스킹하지만
  REST API로 직접 조회하면 원문이 그대로 보인다.
- anon 키만 있으면 `create_submission` / `delete_submission` RPC 호출 가능
  → 아무나 자료 등록·삭제 가능. 기관 검증도 없다.
- anon 키만 있으면 `submissions` 버킷 업로드/다운로드 가능.

anon 키는 프론트 번들에 그대로 들어가므로 위 권한은 사실상 전체 공개다.
**합성데이터 데모에서만 허용된다. 실데이터를 넣지 말 것.**

집계 view는 `security_invoker = true`로 만들어 두었다. Auth를 붙여
base table에 제대로 된 RLS를 걸면 view도 자동으로 그 정책을 따른다.

Auth 도입 시 해야 할 일:
1. `demo_anon_*` 정책 전부 삭제
2. `to anon` grant를 `to authenticated` + organization 매칭 조건으로 교체
3. `create_submission` 안에서 `auth.uid()` 기준으로 호출자의 organization 검증
4. `referral_records` 원문 접근을 소속 기관으로 제한하고, 타 지역에는
   집계 view(`v_welfare_linkage`)만 노출
5. Storage 정책을 organization 폴더 단위로 제한
