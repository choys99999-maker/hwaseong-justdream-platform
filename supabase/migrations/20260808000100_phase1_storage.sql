-- Phase 1: 원본 Excel 보관용 Storage 버킷
-- ⚠️ 보안: 데모 한정으로 anon 이 업로드/다운로드 모두 가능하다.
--    실제 운영에서는 Auth 도입 후 organization 단위 정책으로 교체해야 한다.

insert into storage.buckets (id, name, public)
values ('submissions', 'submissions', false)
on conflict (id) do nothing;

-- storage.objects 는 supabase_storage_admin 소유다. SQL Editor(postgres 역할)에서
-- 정책 생성이 권한 오류로 막히면 Dashboard > Storage > Policies 에서 같은 내용으로 만든다.
drop policy if exists "demo_anon_upload_submissions" on storage.objects;
create policy "demo_anon_upload_submissions"
  on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'submissions');

drop policy if exists "demo_anon_read_submissions" on storage.objects;
create policy "demo_anon_read_submissions"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'submissions');
