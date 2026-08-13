-- 시민 서비스 P0: 도움 요청 큐 + 거점 빠른 현황
--
-- help_requests
--   시민이 `/help`에서 직접 넣거나, 전화를 받은 담당자가 관리자 화면에서 대신 넣는다.
--   두 경로 모두 이 표 하나로 들어간다 — channel 로만 구분하고 큐는 하나다.
--
-- site_quick_status
--   현장 담당자가 "지금 가능 / 얼마 안 남음 / 확인 필요" 만 눌러서 남기는 거점별 최신 상태.
--   거점 자체(이름·주소·좌표)는 `src/data/justdream_sites_25.ts` 가 기준이라 여기 없다 —
--   이 표는 그 25개소 id 에 매다는 "지금 상태" 오버레이 1행씩만 갖는다(site_id 가 PK).
--   행이 없으면 프런트가 시연용 기본값(mockSites)으로 대체해 보여준다.
--
-- ⚠️ 보안: 다른 마이그레이션과 같은 데모 한정 정책이다 — 로그인 없이 anon 키로
--    읽기/쓰기(RPC)가 모두 열려 있다. phone 컬럼에 연락처가 들어가므로 실제 운영 전에는
--    반드시 auth 를 붙이고 이 정책을 organization/역할 기반으로 교체해야 한다.
--    (supabase/README.md 의 기존 경고와 동일한 원칙)

-- ── 도움 요청 큐 ────────────────────────────────────────────
create table public.help_requests (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null,
  dong          text not null,                 -- 사는 읍면동
  item_category text not null,                 -- ItemCategory 값 (식품/위생용품/생필품/영유아용품/기타)
  message       text,                           -- 선택: 전달할 말
  channel       text not null default 'CITIZEN' check (channel in ('CITIZEN', 'PHONE')),
  status        text not null default 'NEW'     check (status in ('NEW', 'DONE')),
  created_at    timestamptz not null default now(),
  resolved_at   timestamptz
);

create index help_requests_status_idx on public.help_requests (status, created_at desc);

-- ── 거점 빠른 현황 ──────────────────────────────────────────
create table public.site_quick_status (
  site_id      text primary key,               -- justdream_sites_25.ts 의 id
  availability text not null check (availability in ('available', 'low', 'unknown')),
  focus_item   text,
  note         text,
  updated_at   timestamptz not null default now()
);

-- ── RPC: 도움 요청 접수 (시민 직접 입력 / 전화 대리 입력 공용) ──
create or replace function public.create_help_request(
  p_phone         text,
  p_dong          text,
  p_item_category text,
  p_message       text,
  p_channel       text default 'CITIZEN'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into help_requests (phone, dong, item_category, message, channel)
  values (p_phone, p_dong, p_item_category, nullif(p_message, ''), coalesce(p_channel, 'CITIZEN'))
  returning id into v_id;
  return v_id;
end;
$$;

-- ── RPC: 도움 요청 확인 처리 ──────────────────────────────
create or replace function public.resolve_help_request(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update help_requests set status = 'DONE', resolved_at = now() where id = p_id;
end;
$$;

-- ── RPC: 거점 빠른 현황 저장 (site_id 기준 upsert) ──────────
create or replace function public.upsert_site_quick_status(
  p_site_id      text,
  p_availability text,
  p_focus_item   text,
  p_note         text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into site_quick_status (site_id, availability, focus_item, note, updated_at)
  values (p_site_id, p_availability, nullif(p_focus_item, ''), nullif(p_note, ''), now())
  on conflict (site_id) do update
    set availability = excluded.availability,
        focus_item   = excluded.focus_item,
        note         = excluded.note,
        updated_at   = now();
end;
$$;

-- ── RLS: 데모 임시 정책 (다른 표와 동일한 원칙) ──────────────
alter table public.help_requests    enable row level security;
alter table public.site_quick_status enable row level security;

drop policy if exists "demo_anon_read" on public.help_requests;
create policy "demo_anon_read" on public.help_requests     for select to anon, authenticated using (true);
drop policy if exists "demo_anon_read" on public.site_quick_status;
create policy "demo_anon_read" on public.site_quick_status for select to anon, authenticated using (true);

grant select on public.help_requests, public.site_quick_status to anon, authenticated;

revoke all on function public.create_help_request(text, text, text, text, text) from public;
revoke all on function public.resolve_help_request(uuid) from public;
revoke all on function public.upsert_site_quick_status(text, text, text, text) from public;
grant execute on function public.create_help_request(text, text, text, text, text) to anon, authenticated;
grant execute on function public.resolve_help_request(uuid) to anon, authenticated;
grant execute on function public.upsert_site_quick_status(text, text, text, text) to anon, authenticated;
