-- Phase 1: 중앙 데이터 저장
-- Excel 한 파일 = submissions 1건, 시트별 추적 = submission_sheets,
-- 업무 레코드는 worker가 정규화한 타입 그대로 (숫자/날짜) 저장한다.
--
-- ⚠️ 보안: 로그인 없는 데모 단계라서 anon 키만으로 읽기/쓰기(RPC)가 모두 가능하다.
--    실제 운영에서는 절대 이대로 쓰면 안 된다. Auth 도입 시 이 정책들을 걷어내고
--    organization 단위 RBAC 정책으로 교체해야 한다. (supabase/README.md 참고)

-- gen_random_uuid()는 PostgreSQL 13+ 코어 함수라 별도 확장이 필요 없다.
-- (pgcrypto를 public 스키마에 새로 만들면 Supabase의 extensions 스키마 관례와 어긋난다)

-- ── 조직 (읍면동) ─────────────────────────────────────────
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,          -- 예: 동탄1동
  region_id   text not null,                 -- regionMeta.ts 의 권역 id (seobu 등)
  region_name text not null,                 -- 예: 동탄권역
  created_at  timestamptz not null default now()
);

-- ── 제출 자료 (Excel 파일 1개 = 1건) ──────────────────────
create table public.submissions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  file_name       text not null,
  issue_count     integer not null default 0,   -- 저장 시 검증이 잡은 값 오류 건수
  record_count    integer not null default 0,   -- 전체 시트 레코드 합 (RPC가 채운다)
  period_start    date,
  period_end      date,
  uploaded_at     timestamptz not null default now()
);

-- ── 원본 Excel 파일 (Storage 오브젝트 추적) ────────────────
create table public.submission_files (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  bucket_id     text not null default 'submissions',
  storage_path  text not null,
  file_size     bigint,
  content_type  text,
  created_at    timestamptz not null default now()
);

-- ── 시트 ──────────────────────────────────────────────────
create table public.submission_sheets (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  sheet_name    text not null,
  sheet_type    text not null check (sheet_type in ('performance', 'referral', 'generic')),
  position      integer not null default 0,
  record_count  integer not null default 0,
  error_count   integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ── 업무 레코드 3종 ───────────────────────────────────────
-- row_seq: 시트 안에서의 순서 (원본 행 순서 보존용)

create table public.performance_records (
  id                 bigint generated always as identity primary key,
  submission_id      uuid not null references public.submissions(id) on delete cascade,
  sheet_id           uuid not null references public.submission_sheets(id) on delete cascade,
  organization_id    uuid not null references public.organizations(id),
  row_seq            integer not null,
  institution        text,
  user_count         integer,
  basic_consultation integer,
  referral_total     integer,
  linkage_completed  integer,
  basic_livelihood   integer,
  near_poverty       integer,
  emergency_welfare  integer,
  other_linkage      integer,
  under_review       integer,
  no_linkage_needed  integer
);

create table public.referral_records (
  id                bigint generated always as identity primary key,
  submission_id     uuid not null references public.submissions(id) on delete cascade,
  sheet_id          uuid not null references public.submission_sheets(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id),
  row_seq           integer not null,
  serial_no         integer,
  institution       text,
  visit_type        text,
  client_name       text,
  birth_date        date,
  address           text,
  consult_date      date,
  referral_target   text,
  consultation_done text,
  linkage_type      text,
  service_details   text,
  under_review      text,
  no_linkage_needed text
);

create table public.inventory_records (
  id                bigint generated always as identity primary key,
  submission_id     uuid not null references public.submissions(id) on delete cascade,
  sheet_id          uuid not null references public.submission_sheets(id) on delete cascade,
  organization_id   uuid not null references public.organizations(id),
  row_seq           integer not null,
  region            text,
  organization_name text,
  item_name         text,
  inbound_quantity  numeric,
  outbound_quantity numeric,
  stock             numeric,
  inbound_date      date,
  expiration_date   date
);

create index submissions_org_idx on public.submissions (organization_id, uploaded_at desc);
create index sheets_submission_idx on public.submission_sheets (submission_id, position);
create index files_submission_idx on public.submission_files (submission_id);
create index performance_submission_idx on public.performance_records (submission_id, row_seq);
create index referral_submission_idx on public.referral_records (submission_id, row_seq);
create index inventory_submission_idx on public.inventory_records (submission_id, row_seq);
create index performance_org_idx on public.performance_records (organization_id);
create index referral_org_idx on public.referral_records (organization_id);
create index inventory_org_idx on public.inventory_records (organization_id);

-- ── RPC: 제출 저장 (단일 트랜잭션 → 부분 성공 없음) ────────
-- p_sheets 예시:
-- [{ "sheetName": "주별 실적", "sheetType": "performance", "errorCount": 0,
--    "records": [{ "institution": "…", "userCount": 12, … }] }]
-- records 의 키는 worker(excelWorker.ts)가 만드는 camelCase 정규화 키 그대로다.
create or replace function public.create_submission(
  p_organization_id uuid,
  p_file_name       text,
  p_storage_path    text,
  p_file_size       bigint,
  p_content_type    text,
  p_issue_count     integer,
  p_period_start    date,
  p_period_end      date,
  p_sheets          jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission_id uuid;
  v_sheet         jsonb;
  v_sheet_id      uuid;
  v_sheet_type    text;
  v_pos           integer := 0;
  v_count         integer;
  v_total         integer := 0;
begin
  if not exists (select 1 from organizations where id = p_organization_id) then
    raise exception '등록되지 않은 기관입니다: %', p_organization_id;
  end if;

  insert into submissions (organization_id, file_name, issue_count, period_start, period_end)
  values (p_organization_id, p_file_name, coalesce(p_issue_count, 0), p_period_start, p_period_end)
  returning id into v_submission_id;

  insert into submission_files (submission_id, storage_path, file_size, content_type)
  values (v_submission_id, p_storage_path, p_file_size, p_content_type);

  for v_sheet in select value from jsonb_array_elements(coalesce(p_sheets, '[]'::jsonb))
  loop
    v_sheet_type := v_sheet ->> 'sheetType';

    insert into submission_sheets (submission_id, sheet_name, sheet_type, position, error_count)
    values (
      v_submission_id,
      coalesce(v_sheet ->> 'sheetName', '자료'),
      v_sheet_type,
      v_pos,
      coalesce((v_sheet ->> 'errorCount')::integer, 0)
    )
    returning id into v_sheet_id;

    if v_sheet_type = 'performance' then
      insert into performance_records (
        submission_id, sheet_id, organization_id, row_seq,
        institution, user_count, basic_consultation, referral_total, linkage_completed,
        basic_livelihood, near_poverty, emergency_welfare, other_linkage,
        under_review, no_linkage_needed
      )
      select
        v_submission_id, v_sheet_id, p_organization_id, t.ord,
        t.rec ->> 'institution',
        (t.rec ->> 'userCount')::integer,
        (t.rec ->> 'basicConsultation')::integer,
        (t.rec ->> 'referralTotal')::integer,
        (t.rec ->> 'linkageCompleted')::integer,
        (t.rec ->> 'basicLivelihood')::integer,
        (t.rec ->> 'nearPoverty')::integer,
        (t.rec ->> 'emergencyWelfare')::integer,
        (t.rec ->> 'otherLinkage')::integer,
        (t.rec ->> 'underReview')::integer,
        (t.rec ->> 'noLinkageNeeded')::integer
      from jsonb_array_elements(coalesce(v_sheet -> 'records', '[]'::jsonb))
        with ordinality as t(rec, ord);

    elsif v_sheet_type = 'referral' then
      insert into referral_records (
        submission_id, sheet_id, organization_id, row_seq,
        serial_no, institution, visit_type, client_name, birth_date, address,
        consult_date, referral_target, consultation_done, linkage_type,
        service_details, under_review, no_linkage_needed
      )
      select
        v_submission_id, v_sheet_id, p_organization_id, t.ord,
        (t.rec ->> 'serialNo')::integer,
        t.rec ->> 'institution',
        t.rec ->> 'visitType',
        t.rec ->> 'clientName',
        (t.rec ->> 'birthDate')::date,
        t.rec ->> 'address',
        (t.rec ->> 'consultDate')::date,
        t.rec ->> 'referralTarget',
        t.rec ->> 'consultationDone',
        t.rec ->> 'linkageType',
        t.rec ->> 'serviceDetails',
        t.rec ->> 'underReview',
        t.rec ->> 'noLinkageNeeded'
      from jsonb_array_elements(coalesce(v_sheet -> 'records', '[]'::jsonb))
        with ordinality as t(rec, ord);

    else
      insert into inventory_records (
        submission_id, sheet_id, organization_id, row_seq,
        region, organization_name, item_name,
        inbound_quantity, outbound_quantity, stock, inbound_date, expiration_date
      )
      select
        v_submission_id, v_sheet_id, p_organization_id, t.ord,
        t.rec ->> 'region',
        t.rec ->> 'organization',
        t.rec ->> 'itemName',
        (t.rec ->> 'inboundQuantity')::numeric,
        (t.rec ->> 'outboundQuantity')::numeric,
        (t.rec ->> 'stock')::numeric,
        (t.rec ->> 'inboundDate')::date,
        (t.rec ->> 'expirationDate')::date
      from jsonb_array_elements(coalesce(v_sheet -> 'records', '[]'::jsonb))
        with ordinality as t(rec, ord);
    end if;

    get diagnostics v_count = row_count;
    update submission_sheets set record_count = v_count where id = v_sheet_id;
    v_total := v_total + v_count;
    v_pos := v_pos + 1;
  end loop;

  update submissions set record_count = v_total where id = v_submission_id;
  return v_submission_id;
end;
$$;

-- ── RPC: 제출 삭제 (cascade) ──────────────────────────────
create or replace function public.delete_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from submissions where id = p_submission_id;
end;
$$;

-- ── RLS: 데모 임시 정책 ───────────────────────────────────
-- 읽기: anon 전체 공개 (데모 한정). 쓰기: 테이블 직접 쓰기는 막고 RPC로만 허용.
alter table public.organizations       enable row level security;
alter table public.submissions         enable row level security;
alter table public.submission_files    enable row level security;
alter table public.submission_sheets   enable row level security;
alter table public.performance_records enable row level security;
alter table public.referral_records    enable row level security;
alter table public.inventory_records   enable row level security;

drop policy if exists "demo_anon_read" on public.organizations;
create policy "demo_anon_read" on public.organizations       for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.submissions;
create policy "demo_anon_read" on public.submissions         for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.submission_files;
create policy "demo_anon_read" on public.submission_files    for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.submission_sheets;
create policy "demo_anon_read" on public.submission_sheets   for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.performance_records;
create policy "demo_anon_read" on public.performance_records for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.referral_records;
create policy "demo_anon_read" on public.referral_records    for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.inventory_records;
create policy "demo_anon_read" on public.inventory_records   for select to anon, authenticated using (true);

grant usage on schema public to anon, authenticated;
grant select on all tables in schema public to anon, authenticated;

revoke all on function public.create_submission(uuid, text, text, bigint, text, integer, date, date, jsonb) from public;
revoke all on function public.delete_submission(uuid) from public;
grant execute on function public.create_submission(uuid, text, text, bigint, text, integer, date, date, jsonb) to anon, authenticated;
grant execute on function public.delete_submission(uuid) to anon, authenticated;

-- ── 시드: 화성시 읍면동 (데모용 합성 목록) ─────────────────
insert into public.organizations (name, region_id, region_name) values
  ('남양읍',  'seobu',   '서부권역'),
  ('송산면',  'seobu',   '서부권역'),
  ('서신면',  'seobu',   '서부권역'),
  ('마도면',  'seobu',   '서부권역'),
  ('비봉면',  'seobu',   '서부권역'),
  ('새솔동',  'seobu',   '서부권역'),
  ('봉담읍',  'jungbu',  '중부권역'),
  ('매송면',  'jungbu',  '중부권역'),
  ('팔탄면',  'jungbu',  '중부권역'),
  ('기배동',  'jungbu',  '중부권역'),
  ('화산동',  'jungbu',  '중부권역'),
  ('향남읍',  'nambu',   '남부권역'),
  ('우정읍',  'nambu',   '남부권역'),
  ('장안면',  'nambu',   '남부권역'),
  ('양감면',  'nambu',   '남부권역'),
  ('정남면',  'nambu',   '남부권역'),
  ('진안동',  'dongbu',  '동부권역'),
  ('병점1동', 'dongbu',  '동부권역'),
  ('병점2동', 'dongbu',  '동부권역'),
  ('반월동',  'dongbu',  '동부권역'),
  ('동탄1동', 'dongtan', '동탄권역'),
  ('동탄2동', 'dongtan', '동탄권역'),
  ('동탄3동', 'dongtan', '동탄권역'),
  ('동탄4동', 'dongtan', '동탄권역'),
  ('동탄5동', 'dongtan', '동탄권역'),
  ('동탄6동', 'dongtan', '동탄권역'),
  ('동탄7동', 'dongtan', '동탄권역'),
  ('동탄8동', 'dongtan', '동탄권역'),
  ('동탄9동', 'dongtan', '동탄권역')
on conflict (name) do nothing;
