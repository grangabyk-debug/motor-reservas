create table if not exists public.hotel_derived_notification_reads (
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  read_at timestamptz not null default now(),
  primary key(property_id,user_id,item_id)
);

alter table public.hotel_derived_notification_reads enable row level security;

drop policy if exists hotel_derived_notification_reads_select on public.hotel_derived_notification_reads;
create policy hotel_derived_notification_reads_select on public.hotel_derived_notification_reads
for select to authenticated using (user_id=auth.uid() and private.user_has_property_access(property_id));

drop policy if exists hotel_derived_notification_reads_insert on public.hotel_derived_notification_reads;
create policy hotel_derived_notification_reads_insert on public.hotel_derived_notification_reads
for insert to authenticated with check (user_id=auth.uid() and private.user_has_property_access(property_id));

drop policy if exists hotel_derived_notification_reads_update on public.hotel_derived_notification_reads;
create policy hotel_derived_notification_reads_update on public.hotel_derived_notification_reads
for update to authenticated using (user_id=auth.uid() and private.user_has_property_access(property_id)) with check (user_id=auth.uid() and private.user_has_property_access(property_id));

drop policy if exists hotel_derived_notification_reads_delete on public.hotel_derived_notification_reads;
create policy hotel_derived_notification_reads_delete on public.hotel_derived_notification_reads
for delete to authenticated using (user_id=auth.uid() and private.user_has_property_access(property_id));

create index if not exists hotel_derived_notification_reads_user_property_idx on public.hotel_derived_notification_reads(user_id,property_id,read_at desc);

grant select,insert,update,delete on public.hotel_derived_notification_reads to authenticated;
