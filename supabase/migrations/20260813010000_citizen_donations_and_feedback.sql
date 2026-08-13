-- 시민 서비스 P1: 도움 방식(직접/전달) + 물품 기부 + 말 남기기
--
-- help_requests 확장
--   기존 표에 "도움 방식"(request_type)과 "선택한 거점"(preferred_site_id)을 추가한다.
--   두 값 모두 선택 항목이라 기존 행은 null로 남는다.
--
-- donations
--   시민이 `/donate`에서 사진과 함께 남기는 물품 기부. help_requests와 같은 원칙 —
--   단일 표 + RPC 하나로 접수하고, 관리자 대시보드가 status='NEW' 를 큐로 읽는다.
--
-- feedback_messages
--   "말 남기기". 익명이 기본이며, 답변을 원할 때만 연락처를 받는다.
--
-- ⚠️ 보안: 다른 마이그레이션과 같은 데모 한정 정책이다 — 로그인 없이 anon 키로
--    읽기/쓰기(RPC)가 모두 열려 있다. 실제 운영 전에는 auth 를 붙여야 한다.
--    (supabase/README.md 의 기존 경고와 동일한 원칙)

-- ── help_requests: 도움 방식 확장 ───────────────────────────
alter table public.help_requests
  add column request_type     text check (request_type in ('SELF', 'DELIVERY')),
  add column preferred_site_id text;                -- justdream_sites_25.ts 의 id (선택)

drop function if exists public.create_help_request(text, text, text, text, text);

create or replace function public.create_help_request(
  p_phone             text,
  p_dong              text,
  p_item_category     text,
  p_message           text,
  p_channel           text default 'CITIZEN',
  p_request_type      text default null,
  p_preferred_site_id text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into help_requests (phone, dong, item_category, message, channel, request_type, preferred_site_id)
  values (
    p_phone, p_dong, p_item_category, nullif(p_message, ''), coalesce(p_channel, 'CITIZEN'),
    p_request_type, nullif(p_preferred_site_id, '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_help_request(text, text, text, text, text, text, text) from public;
grant execute on function public.create_help_request(text, text, text, text, text, text, text) to anon, authenticated;

-- ── 물품 기부 ────────────────────────────────────────────────
create table public.donations (
  id               uuid primary key default gen_random_uuid(),
  item_name        text not null,
  quantity         integer not null default 1 check (quantity > 0),
  image_path       text not null,                 -- donation-photos 버킷 안 경로
  donor_contact    text,                           -- 선택
  region           text not null,                  -- 사는/기부하는 동네
  donation_method  text not null check (donation_method in ('SELF_DELIVER', 'PICKUP_NEEDED')),
  target_site_id   text,                           -- SELF_DELIVER 일 때 추천/선택된 거점
  status           text not null default 'NEW' check (status in ('NEW', 'DONE')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index donations_status_idx on public.donations (status, created_at desc);

create or replace function public.create_donation(
  p_item_name       text,
  p_quantity        integer,
  p_image_path      text,
  p_donor_contact   text,
  p_region          text,
  p_donation_method text,
  p_target_site_id  text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into donations (item_name, quantity, image_path, donor_contact, region, donation_method, target_site_id)
  values (
    p_item_name, greatest(p_quantity, 1), p_image_path, nullif(p_donor_contact, ''),
    p_region, p_donation_method, nullif(p_target_site_id, '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.resolve_donation(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update donations set status = 'DONE', resolved_at = now() where id = p_id;
end;
$$;

alter table public.donations enable row level security;
drop policy if exists "demo_anon_read" on public.donations;
create policy "demo_anon_read" on public.donations for select to anon, authenticated using (true);
grant select on public.donations to anon, authenticated;

revoke all on function public.create_donation(text, integer, text, text, text, text, text) from public;
revoke all on function public.resolve_donation(uuid) from public;
grant execute on function public.create_donation(text, integer, text, text, text, text, text) to anon, authenticated;
grant execute on function public.resolve_donation(uuid) to anon, authenticated;

-- ── 기부 사진 Storage 버킷 ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('donation-photos', 'donation-photos', false)
on conflict (id) do nothing;

drop policy if exists "demo_anon_upload_donation_photos" on storage.objects;
create policy "demo_anon_upload_donation_photos"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'donation-photos');

drop policy if exists "demo_anon_read_donation_photos" on storage.objects;
create policy "demo_anon_read_donation_photos"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'donation-photos');

-- ── 말 남기기 ────────────────────────────────────────────────
create table public.feedback_messages (
  id          uuid primary key default gen_random_uuid(),
  message     text not null,
  anonymous   boolean not null default true,
  contact     text,                                -- anonymous=false 이고 답변을 원할 때만
  created_at  timestamptz not null default now()
);

create or replace function public.create_feedback(
  p_message   text,
  p_anonymous boolean default true,
  p_contact   text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into feedback_messages (message, anonymous, contact)
  values (p_message, coalesce(p_anonymous, true), case when p_anonymous then null else nullif(p_contact, '') end)
  returning id into v_id;
  return v_id;
end;
$$;

alter table public.feedback_messages enable row level security;
drop policy if exists "demo_anon_read" on public.feedback_messages;
create policy "demo_anon_read" on public.feedback_messages for select to anon, authenticated using (true);
grant select on public.feedback_messages to anon, authenticated;

revoke all on function public.create_feedback(text, boolean, text) from public;
grant execute on function public.create_feedback(text, boolean, text) to anon, authenticated;
