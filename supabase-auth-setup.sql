begin;

alter table public.activity_records
  add column user_id uuid not null default auth.uid()
  references auth.users(id) on delete cascade;

create index activity_records_user_id_idx
  on public.activity_records(user_id);

drop policy if exists "Allow tracker record reads" on public.activity_records;
drop policy if exists "Allow tracker record creation" on public.activity_records;

revoke all on public.activity_records from anon, authenticated;
grant select, insert on public.activity_records to authenticated;

create policy "Users can read their own activity records"
on public.activity_records
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own activity records"
on public.activity_records
for insert
to authenticated
with check ((select auth.uid()) = user_id);

commit;
