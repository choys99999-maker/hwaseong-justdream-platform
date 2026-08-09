-- 제출 자료 삭제가 안 되는 문제 수정
--
-- 증상: 자료 상세에서 "삭제"를 눌러도 실패한다.
--
-- 원인 1) submissions.superseded_by 가 submissions(id) 를 참조하는데 on delete 절이 없다.
--   같은 기관이 같은 기간/파일명을 다시 올리면 이전 제출본에 superseded_by = 새 제출본 이
--   기록된다. 그 상태에서 새(최신) 제출본을 지우려 하면 이전 제출본이 그것을 참조하고 있어
--   외래키 위반으로 삭제가 막힌다.
--
-- 원인 2) 설령 지워지더라도, 밀려났던(superseded) 이전 제출본은 그대로 superseded 로 남는다.
--   집계 뷰는 status = 'active' 만 보므로, 최신본을 지우는 순간 그 기관 자료가 통째로
--   대시보드에서 사라진다. 삭제한 적 없는 자료가 조용히 없어지는 셈이다.
--
-- 고치는 방향: 최신본을 지우면 그것이 밀어냈던 바로 이전 제출본을 다시 살린다.
--   ("되돌리기"에 해당한다. 사용자가 기대하는 동작이기도 하다)

-- ── 1. 외래키에 on delete set null ────────────────────────
-- 제약 이름은 컬럼을 add column 으로 붙일 때 자동 생성된 이름을 따른다.
alter table public.submissions
  drop constraint if exists submissions_superseded_by_fkey;

alter table public.submissions
  add constraint submissions_superseded_by_fkey
  foreign key (superseded_by) references public.submissions(id) on delete set null;

-- ── 2. 삭제 RPC: 밀려났던 직전 제출본을 되살린다 ───────────
create or replace function public.delete_submission(p_submission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restored uuid;
begin
  -- 이 제출본이 밀어낸 것들 중 가장 최근 것을 다시 현재 자료로 세운다.
  select id into v_restored
  from submissions
  where superseded_by = p_submission_id
  order by uploaded_at desc
  limit 1;

  if v_restored is not null then
    update submissions
    set status = 'active', superseded_by = null, superseded_at = null
    where id = v_restored;

    -- 나머지는 계속 밀려난 상태로 두되, 되살린 제출본을 가리키게 한다.
    -- (한 기관의 같은 기간에 현재 자료가 둘이 되지 않도록)
    update submissions
    set superseded_by = v_restored
    where superseded_by = p_submission_id
      and id <> v_restored;
  end if;

  delete from submissions where id = p_submission_id;
end;
$$;

revoke all on function public.delete_submission(uuid) from public;
grant execute on function public.delete_submission(uuid) to anon, authenticated;

-- ── 3. 이미 꼬여 있는 자료 보정 ───────────────────────────
-- 최신본이 지워졌거나 참조가 끊겨 superseded 로 방치된 제출본을 되살린다.
-- (superseded 인데 가리키는 대상이 없으면 밀어낸 자료가 더는 없다는 뜻이다)
update public.submissions
set status = 'active', superseded_at = null
where status = 'superseded' and superseded_by is null;
