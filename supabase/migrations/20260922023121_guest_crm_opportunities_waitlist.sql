create table if not exists public.hotel_crm_opportunities(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  guest_profile_id uuid null references public.hotel_guest_profiles(id) on delete set null,
  stage text not null default 'new',
  priority text not null default 'normal',
  name text not null,
  email text null,
  phone text null,
  source_channel text not null default 'direct',
  desired_check_in date null,
  desired_check_out date null,
  adults integer not null default 1,
  children integer not null default 0,
  rooms_count integer not null default 1,
  preferred_room_type text null,
  alternative_room_types text[] not null default '{}'::text[],
  flexible_dates boolean not null default false,
  flexibility_days integer not null default 0,
  max_budget numeric null,
  currency text not null default 'ARS',
  waitlist_until date null,
  next_follow_up_at timestamptz null,
  follow_up_channel text null,
  last_contacted_at timestamptz null,
  quote_id uuid null references public.hotel_group_quotes(id) on delete set null,
  reservation_id bigint null references public.reservas(id) on delete set null,
  assigned_to uuid null,
  notes text null,
  lost_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_crm_opportunities_stage_check check(stage in('new','quote_sent','follow_up','waitlist','won','lost')),
  constraint hotel_crm_opportunities_priority_check check(priority in('low','normal','high')),
  constraint hotel_crm_opportunities_followup_channel_check check(follow_up_channel is null or follow_up_channel in('email','whatsapp','phone','other')),
  constraint hotel_crm_opportunities_people_check check(adults>=0 and children>=0 and adults+children>=1),
  constraint hotel_crm_opportunities_rooms_check check(rooms_count>=1),
  constraint hotel_crm_opportunities_flexibility_check check(flexibility_days>=0 and flexibility_days<=60),
  constraint hotel_crm_opportunities_dates_check check(desired_check_out is null or desired_check_in is null or desired_check_out>desired_check_in),
  constraint hotel_crm_opportunities_budget_check check(max_budget is null or max_budget>=0)
);
create index if not exists hotel_crm_opportunities_property_stage_idx on public.hotel_crm_opportunities(property_id,stage,updated_at desc);
create index if not exists hotel_crm_opportunities_waitlist_idx on public.hotel_crm_opportunities(property_id,desired_check_in,desired_check_out) where stage='waitlist';
create index if not exists hotel_crm_opportunities_followup_idx on public.hotel_crm_opportunities(property_id,next_follow_up_at) where stage not in('won','lost') and next_follow_up_at is not null;
create index if not exists hotel_crm_opportunities_guest_idx on public.hotel_crm_opportunities(property_id,guest_profile_id) where guest_profile_id is not null;

create table if not exists public.hotel_crm_opportunity_activities(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  opportunity_id uuid not null references public.hotel_crm_opportunities(id) on delete cascade,
  activity_type text not null default 'note',
  channel text null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_by uuid null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint hotel_crm_activity_type_check check(activity_type in('note','email','whatsapp','phone','stage','quote','reservation','system')),
  constraint hotel_crm_activity_channel_check check(channel is null or channel in('email','whatsapp','phone','other'))
);
create index if not exists hotel_crm_opportunity_activities_opp_idx on public.hotel_crm_opportunity_activities(opportunity_id,occurred_at desc);
create index if not exists hotel_crm_opportunity_activities_property_idx on public.hotel_crm_opportunity_activities(property_id,occurred_at desc);

alter table public.hotel_crm_opportunities enable row level security;
alter table public.hotel_crm_opportunity_activities enable row level security;

drop policy if exists hotel_crm_opportunities_select_access on public.hotel_crm_opportunities;
create policy hotel_crm_opportunities_select_access on public.hotel_crm_opportunities for select using(private.user_has_property_access(property_id));
drop policy if exists hotel_crm_opportunities_insert_access on public.hotel_crm_opportunities;
create policy hotel_crm_opportunities_insert_access on public.hotel_crm_opportunities for insert with check(private.user_has_property_role(property_id,array['owner','admin','manager','reception','revenue']::text[]));
drop policy if exists hotel_crm_opportunities_update_access on public.hotel_crm_opportunities;
create policy hotel_crm_opportunities_update_access on public.hotel_crm_opportunities for update using(private.user_has_property_role(property_id,array['owner','admin','manager','reception','revenue']::text[])) with check(private.user_has_property_role(property_id,array['owner','admin','manager','reception','revenue']::text[]));
drop policy if exists hotel_crm_opportunities_delete_access on public.hotel_crm_opportunities;
create policy hotel_crm_opportunities_delete_access on public.hotel_crm_opportunities for delete using(private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));
drop policy if exists hotel_crm_activities_select_access on public.hotel_crm_opportunity_activities;
create policy hotel_crm_activities_select_access on public.hotel_crm_opportunity_activities for select using(private.user_has_property_access(property_id));
drop policy if exists hotel_crm_activities_insert_access on public.hotel_crm_opportunity_activities;
create policy hotel_crm_activities_insert_access on public.hotel_crm_opportunity_activities for insert with check(private.user_has_property_role(property_id,array['owner','admin','manager','reception','revenue']::text[]));
drop policy if exists hotel_crm_activities_update_access on public.hotel_crm_opportunity_activities;
create policy hotel_crm_activities_update_access on public.hotel_crm_opportunity_activities for update using(private.user_has_property_role(property_id,array['owner','admin','manager','reception','revenue']::text[])) with check(private.user_has_property_role(property_id,array['owner','admin','manager','reception','revenue']::text[]));
drop policy if exists hotel_crm_activities_delete_access on public.hotel_crm_opportunity_activities;
create policy hotel_crm_activities_delete_access on public.hotel_crm_opportunity_activities for delete using(private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

create or replace function private.hl_crm_set_updated_at() returns trigger language plpgsql set search_path='public','private','pg_temp' as $fn$
begin new.updated_at:=now();return new;end
$fn$;
drop trigger if exists hotel_crm_opportunities_updated_at on public.hotel_crm_opportunities;
create trigger hotel_crm_opportunities_updated_at before update on public.hotel_crm_opportunities for each row execute function private.hl_crm_set_updated_at();

create or replace function public.hl_crm_log_activity_atomic(
  p_opportunity_id uuid,p_activity_type text,p_summary text,p_channel text default null,p_metadata jsonb default '{}'::jsonb
) returns public.hotel_crm_opportunity_activities language plpgsql security definer set search_path='public','private','pg_temp' as $fn$
declare o public.hotel_crm_opportunities%rowtype;a public.hotel_crm_opportunity_activities%rowtype;v_type text:=lower(trim(coalesce(p_activity_type,'note')));v_channel text:=nullif(lower(trim(coalesce(p_channel,''))),'');
begin
  if auth.uid() is null then raise exception 'Sesión requerida'; end if;
  select * into o from public.hotel_crm_opportunities where id=p_opportunity_id for update;
  if not found then raise exception 'Oportunidad inexistente'; end if;
  if not private.user_has_property_role(o.property_id,array['owner','admin','manager','reception','revenue']::text[]) then raise exception 'Sin permisos'; end if;
  if v_type not in('note','email','whatsapp','phone','stage','quote','reservation','system') then raise exception 'Tipo de actividad inválido'; end if;
  if v_channel is not null and v_channel not in('email','whatsapp','phone','other') then raise exception 'Canal inválido'; end if;
  if nullif(trim(coalesce(p_summary,'')),'') is null then raise exception 'La actividad necesita una descripción'; end if;
  insert into public.hotel_crm_opportunity_activities(property_id,opportunity_id,activity_type,channel,summary,metadata,created_by)
  values(o.property_id,o.id,v_type,v_channel,trim(p_summary),coalesce(p_metadata,'{}'::jsonb),auth.uid()) returning * into a;
  if v_type in('email','whatsapp','phone') then update public.hotel_crm_opportunities set last_contacted_at=now() where id=o.id; end if;
  return a;
end
$fn$;
revoke all on function public.hl_crm_log_activity_atomic(uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.hl_crm_log_activity_atomic(uuid,text,text,text,jsonb) to authenticated,service_role;
