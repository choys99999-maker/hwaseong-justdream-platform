-- Phase 2: 중앙 집계 (모든 소비 화면이 같은 DB를 읽게 한다)
--
-- 이 마이그레이션이 푸는 두 가지 중복 집계 문제:
--   1) 한 파일에 "주별 실적"과 "누계 실적"이 같이 오면 두 번 더해진다
--      → submission_sheets.is_cumulative 로 누계 시트를 집계에서 제외한다.
--   2) 같은 기관이 같은 기간 자료를 다시 올리면 예전 제출본까지 더해진다
--      → submissions.status / superseded_by 로 최신 제출본만 집계한다.
--
-- 집계는 materialized view 없이 일반 VIEW로만 한다. (현재 데이터 규모에서 충분)

-- ── 1. 재제출/버전 구조 ───────────────────────────────────
alter table public.submissions
  add column if not exists status        text not null default 'active'
    check (status in ('active', 'superseded')),
  add column if not exists superseded_by uuid references public.submissions(id),
  add column if not exists superseded_at timestamptz;

create index if not exists submissions_active_idx
  on public.submissions (organization_id, uploaded_at desc)
  where status = 'active';

-- ── 2. 누계 시트 표시 ─────────────────────────────────────
alter table public.submission_sheets
  add column if not exists is_cumulative boolean not null default false;

-- 이미 저장된 자료 보정
update public.submission_sheets
  set is_cumulative = true
  where sheet_name ilike '%누계%';

-- ── 3. RPC 갱신: 누계 판정 + 이전 제출본 supersede ─────────
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
  v_cumulative    boolean;
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
    -- 프론트가 판정해 보내면 그것을 쓰고, 없으면 시트 이름으로 판정한다.
    v_cumulative := coalesce(
      (v_sheet ->> 'isCumulative')::boolean,
      coalesce(v_sheet ->> 'sheetName', '') ilike '%누계%'
    );

    insert into submission_sheets (
      submission_id, sheet_name, sheet_type, position, error_count, is_cumulative
    )
    values (
      v_submission_id,
      coalesce(v_sheet ->> 'sheetName', '자료'),
      v_sheet_type,
      v_pos,
      coalesce((v_sheet ->> 'errorCount')::integer, 0),
      v_cumulative
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

  -- 재제출 처리: 같은 기관의 이전 제출본 중
  --   (a) 기간이 완전히 같거나  (b) 파일 이름이 같은 것
  -- 을 superseded 로 내린다. 다른 주차 자료는 그대로 살아 있다.
  update submissions
  set status = 'superseded', superseded_by = v_submission_id, superseded_at = now()
  where organization_id = p_organization_id
    and id <> v_submission_id
    and status = 'active'
    and (
      (p_period_start is not null
        and period_start is not distinct from p_period_start
        and period_end   is not distinct from p_period_end)
      or file_name = p_file_name
    );

  return v_submission_id;
end;
$$;

revoke all on function public.create_submission(uuid, text, text, bigint, text, integer, date, date, jsonb) from public;
grant execute on function public.create_submission(uuid, text, text, bigint, text, integer, date, date, jsonb) to anon, authenticated;

-- ══ 내부 helper view ══════════════════════════════════════
-- "유효한 제출본 + 누계 시트 제외" 규칙을 한 곳에만 둔다.
-- 화면 view들은 반드시 이 helper를 거쳐 집계한다.

create view public.v_active_submissions
with (security_invoker = true) as
select
  s.id,
  s.organization_id,
  o.name        as organization_name,
  o.region_id,
  o.region_name,
  s.file_name,
  s.record_count,
  s.issue_count,
  s.period_start,
  s.period_end,
  s.uploaded_at
from public.submissions s
join public.organizations o on o.id = s.organization_id
where s.status = 'active';

create view public.v_performance_rows
with (security_invoker = true) as
select p.*, a.organization_name, a.region_id, a.region_name, a.uploaded_at
from public.performance_records p
join public.submission_sheets sh on sh.id = p.sheet_id
join public.v_active_submissions a on a.id = p.submission_id
where sh.is_cumulative = false;

create view public.v_referral_rows
with (security_invoker = true) as
select r.*, a.organization_name, a.region_id, a.region_name, a.uploaded_at
from public.referral_records r
join public.submission_sheets sh on sh.id = r.sheet_id
join public.v_active_submissions a on a.id = r.submission_id
where sh.is_cumulative = false;

create view public.v_inventory_rows
with (security_invoker = true) as
select i.*, a.organization_name as submitted_by, a.region_id, a.region_name, a.uploaded_at
from public.inventory_records i
join public.submission_sheets sh on sh.id = i.sheet_id
join public.v_active_submissions a on a.id = i.submission_id
where sh.is_cumulative = false;

-- ══ 화면용 view ═══════════════════════════════════════════

-- 물품·재고 현황 (물품·재고 관리 화면)
-- 입고/출고는 기간 누적이라 더하고, 현재재고·유통기한은 스냅샷이라
-- 가장 최근 제출본의 값을 쓴다. (재고를 더하면 실제보다 부풀려진다)
create view public.v_inventory_status
with (security_invoker = true) as
with latest as (
  select distinct on (organization_id, item_name)
    organization_id, item_name, stock, expiration_date, inbound_date, uploaded_at
  from public.v_inventory_rows
  where item_name is not null
  order by organization_id, item_name, uploaded_at desc, row_seq desc
),
flows as (
  select
    organization_id,
    item_name,
    sum(coalesce(inbound_quantity, 0))  as inbound_quantity,
    sum(coalesce(outbound_quantity, 0)) as outbound_quantity,
    count(*)                            as record_count
  from public.v_inventory_rows
  where item_name is not null
  group by organization_id, item_name
)
select
  o.id           as organization_id,
  o.name         as organization_name,
  o.region_id,
  o.region_name,
  l.item_name,
  f.inbound_quantity,
  f.outbound_quantity,
  l.stock,
  f.record_count,
  l.inbound_date            as last_inbound_date,
  l.expiration_date,
  l.uploaded_at             as last_reported_at,
  -- 유통기한 임박 판단은 여기서만 한다. (화면마다 따로 계산하지 않는다)
  (l.expiration_date is not null and l.expiration_date < current_date)                        as is_expired,
  (l.expiration_date is not null and l.expiration_date >= current_date
     and l.expiration_date <= current_date + interval '30 days')                              as is_expiring_soon,
  case when l.expiration_date is null then null
       else (l.expiration_date - current_date) end                                            as days_to_expiration
from latest l
join flows f on f.organization_id = l.organization_id and f.item_name = l.item_name
join public.organizations o on o.id = l.organization_id;

-- 읍면동별 실적 (지역별 현황 / 지역 상세 / 대시보드 지역 차트)
create view public.v_region_usage
with (security_invoker = true) as
select
  o.id   as organization_id,
  o.name as organization_name,
  o.region_id,
  o.region_name,
  coalesce(p.user_count, 0)          as user_count,
  coalesce(p.basic_consultation, 0)  as basic_consultation,
  coalesce(p.referral_total, 0)      as referral_total,
  coalesce(p.linkage_completed, 0)   as linkage_completed,
  coalesce(p.under_review, 0)        as under_review,
  coalesce(p.no_linkage_needed, 0)   as no_linkage_needed,
  coalesce(r.referral_count, 0)      as referral_count,
  coalesce(i.item_count, 0)          as item_count,
  coalesce(i.total_stock, 0)         as total_stock,
  s.submission_count,
  s.last_uploaded_at,
  s.period_start,
  s.period_end
from public.organizations o
join (
  select organization_id,
         count(*)          as submission_count,
         max(uploaded_at)  as last_uploaded_at,
         min(period_start) as period_start,
         max(period_end)   as period_end
  from public.v_active_submissions
  group by organization_id
) s on s.organization_id = o.id
left join (
  select organization_id,
         sum(coalesce(user_count, 0))         as user_count,
         sum(coalesce(basic_consultation, 0)) as basic_consultation,
         sum(coalesce(referral_total, 0))     as referral_total,
         sum(coalesce(linkage_completed, 0))  as linkage_completed,
         sum(coalesce(under_review, 0))       as under_review,
         sum(coalesce(no_linkage_needed, 0))  as no_linkage_needed
  from public.v_performance_rows
  group by organization_id
) p on p.organization_id = o.id
left join (
  select organization_id, count(*) as referral_count
  from public.v_referral_rows
  group by organization_id
) r on r.organization_id = o.id
left join (
  select organization_id,
         count(*)                      as item_count,
         sum(coalesce(stock, 0))       as total_stock
  from public.v_inventory_status
  group by organization_id
) i on i.organization_id = o.id;

-- 화성시 전체 통합 KPI (통합 대시보드)
create view public.v_city_overview
with (security_invoker = true) as
select
  (select count(*)                        from public.v_active_submissions)                  as submission_count,
  (select count(distinct organization_id) from public.v_active_submissions)                  as organization_count,
  (select coalesce(sum(user_count), 0)         from public.v_performance_rows)               as total_users,
  (select coalesce(sum(basic_consultation), 0) from public.v_performance_rows)               as total_consultations,
  (select coalesce(sum(referral_total), 0)     from public.v_performance_rows)               as total_referrals,
  (select coalesce(sum(linkage_completed), 0)  from public.v_performance_rows)               as total_linkage_completed,
  (select coalesce(sum(basic_livelihood), 0)   from public.v_performance_rows)               as total_basic_livelihood,
  (select coalesce(sum(near_poverty), 0)       from public.v_performance_rows)               as total_near_poverty,
  (select coalesce(sum(emergency_welfare), 0)  from public.v_performance_rows)               as total_emergency_welfare,
  (select coalesce(sum(other_linkage), 0)      from public.v_performance_rows)               as total_other_linkage,
  (select coalesce(sum(under_review), 0)       from public.v_performance_rows)               as total_under_review,
  (select coalesce(sum(no_linkage_needed), 0)  from public.v_performance_rows)               as total_no_linkage_needed,
  (select count(*)                        from public.v_referral_rows)                       as referral_record_count,
  (select count(*)                        from public.v_inventory_status)                    as inventory_item_count,
  (select coalesce(sum(stock), 0)         from public.v_inventory_status)                    as inventory_total_stock,
  (select count(*)                        from public.v_inventory_status where is_expiring_soon) as expiring_soon_count,
  (select count(*)                        from public.v_inventory_status where is_expired)   as expired_count,
  (select min(period_start)               from public.v_active_submissions)                  as period_start,
  (select max(period_end)                 from public.v_active_submissions)                  as period_end,
  (select max(uploaded_at)                from public.v_active_submissions)                  as last_uploaded_at;

-- 지역별 복지연계 집계 (실적·복지연계 화면) — 개인정보 컬럼을 내보내지 않는다
create view public.v_welfare_linkage
with (security_invoker = true) as
select
  o.id   as organization_id,
  o.name as organization_name,
  o.region_id,
  o.region_name,
  count(*)                                                          as referral_count,
  count(*) filter (where r.visit_type like '%방문%')                as visit_count,
  count(*) filter (where r.consultation_done is not null
                     and btrim(r.consultation_done) <> '')          as consultation_done_count,
  count(*) filter (where r.linkage_type is not null
                     and btrim(r.linkage_type) <> '')               as linkage_completed_count,
  count(*) filter (where r.linkage_type like '%기초생활%')          as basic_livelihood_count,
  count(*) filter (where r.linkage_type like '%차상위%')            as near_poverty_count,
  count(*) filter (where r.linkage_type like '%긴급복지%')          as emergency_welfare_count,
  min(r.consult_date)                                               as first_consult_date,
  max(r.consult_date)                                               as last_consult_date
from public.v_referral_rows r
join public.organizations o on o.id = r.organization_id
group by o.id, o.name, o.region_id, o.region_name;

-- 기관별 제출 현황 (대시보드 최근 제출 / 지역 상세 머리말)
create view public.v_submission_status
with (security_invoker = true) as
select distinct on (a.organization_id)
  a.organization_id,
  a.organization_name,
  a.region_id,
  a.region_name,
  a.id           as submission_id,
  a.file_name,
  a.record_count,
  a.issue_count,
  a.period_start,
  a.period_end,
  a.uploaded_at  as last_uploaded_at,
  (select count(*) from public.v_active_submissions b
    where b.organization_id = a.organization_id) as submission_count
from public.v_active_submissions a
order by a.organization_id, a.uploaded_at desc;

-- 월별 활동량 (월별 차트) — 복지연계 상담일 기준
create view public.v_monthly_activity
with (security_invoker = true) as
select
  organization_id,
  to_char(date_trunc('month', consult_date), 'YYYY-MM') as month,
  count(*)                                             as count
from public.v_referral_rows
where consult_date is not null
group by organization_id, date_trunc('month', consult_date);

grant select on
  public.v_active_submissions,
  public.v_performance_rows,
  public.v_referral_rows,
  public.v_inventory_rows,
  public.v_inventory_status,
  public.v_region_usage,
  public.v_city_overview,
  public.v_welfare_linkage,
  public.v_submission_status,
  public.v_monthly_activity
to anon, authenticated;
