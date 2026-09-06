-- Habitación Llena — rutinas operativas recurrentes + mantenimiento preventivo
-- EXPAND migration. Aplicar primero en Supabase preview/staging.

begin;

create table if not exists public.hotel_operational_routines (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  scope text not null default 'property' check (scope in ('property','staff')),
  frequency text not null default 'weekly' check (frequency in ('once','daily','weekly','monthly','annual')),
  weekdays smallint[] not null default '{}'::smallint[],
  month_days smallint[] not null default '{}'::smallint[],
  annual_month smallint,
  annual_day smallint,
  start_date date not null default current_date,
  end_date date,
  due_time time,
  assigned_user_ids uuid[] not null default '{}'::uuid[],
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  check (annual_month is null or annual_month between 1 and 12),
  check (annual_day is null or annual_day between 1 and 31)
);

create index if not exists hotel_operational_routines_property_active_idx on public.hotel_operational_routines(property_id,active,frequency);

alter table public.hotel_operational_routines enable row level security;

drop policy if exists hotel_operational_routines_select_access on public.hotel_operational_routines;
create policy hotel_operational_routines_select_access on public.hotel_operational_routines
for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_operational_routines_insert_manage on public.hotel_operational_routines;
create policy hotel_operational_routines_insert_manage on public.hotel_operational_routines
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists hotel_operational_routines_update_manage on public.hotel_operational_routines;
create policy hotel_operational_routines_update_manage on public.hotel_operational_routines
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists hotel_operational_routines_delete_manage on public.hotel_operational_routines;
create policy hotel_operational_routines_delete_manage on public.hotel_operational_routines
for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

create table if not exists public.hotel_operational_routine_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  routine_id uuid not null references public.hotel_operational_routines(id) on delete cascade,
  scheduled_for timestamptz not null,
  assignee_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','in_progress','done','skipped','cancelled')),
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(routine_id,scheduled_for,assignee_id)
);

create index if not exists hotel_operational_routine_runs_property_day_idx on public.hotel_operational_routine_runs(property_id,scheduled_for,status);
create index if not exists hotel_operational_routine_runs_assignee_idx on public.hotel_operational_routine_runs(property_id,assignee_id,scheduled_for) where assignee_id is not null;

alter table public.hotel_operational_routine_runs enable row level security;

drop policy if exists hotel_operational_routine_runs_select_access on public.hotel_operational_routine_runs;
create policy hotel_operational_routine_runs_select_access on public.hotel_operational_routine_runs
for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_operational_routine_runs_insert_access on public.hotel_operational_routine_runs;
create policy hotel_operational_routine_runs_insert_access on public.hotel_operational_routine_runs
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit','housekeeping','maintenance']::text[]));

drop policy if exists hotel_operational_routine_runs_update_access on public.hotel_operational_routine_runs;
create policy hotel_operational_routine_runs_update_access on public.hotel_operational_routine_runs
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit','housekeeping','maintenance']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit','housekeeping','maintenance']::text[]));

create or replace function private.hl_operational_routine_run_tenant_guard()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if not exists(select 1 from public.hotel_operational_routines r where r.id=new.routine_id and r.property_id=new.property_id) then
    raise exception using errcode='23514',message='La rutina no pertenece a la propiedad.';
  end if;
  new.updated_at:=now();
  if new.status='done' then new.completed_at:=coalesce(new.completed_at,now()); else new.completed_at:=null; end if;
  return new;
end
$function$;

drop trigger if exists hotel_operational_routine_runs_tenant_guard on public.hotel_operational_routine_runs;
create trigger hotel_operational_routine_runs_tenant_guard before insert or update on public.hotel_operational_routine_runs for each row execute function private.hl_operational_routine_run_tenant_guard();

create table if not exists public.hotel_preventive_maintenance_plans (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id bigint references public.habitaciones(id) on delete cascade,
  resource_id uuid references public.hotel_resources(id) on delete cascade,
  category text not null default 'general',
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  interval_days integer not null check (interval_days between 1 and 3650),
  warning_days integer not null default 7 check (warning_days between 0 and 365),
  last_completed_at timestamptz,
  next_due_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  supplier_id uuid,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (room_id is not null or resource_id is not null)
);

create index if not exists hotel_preventive_maintenance_property_due_idx on public.hotel_preventive_maintenance_plans(property_id,active,next_due_at);
create index if not exists hotel_preventive_maintenance_room_idx on public.hotel_preventive_maintenance_plans(property_id,room_id) where room_id is not null;
create index if not exists hotel_preventive_maintenance_resource_idx on public.hotel_preventive_maintenance_plans(property_id,resource_id) where resource_id is not null;

alter table public.hotel_preventive_maintenance_plans enable row level security;

drop policy if exists hotel_preventive_maintenance_select_access on public.hotel_preventive_maintenance_plans;
create policy hotel_preventive_maintenance_select_access on public.hotel_preventive_maintenance_plans
for select to authenticated using (private.user_has_property_access(property_id));

drop policy if exists hotel_preventive_maintenance_insert_access on public.hotel_preventive_maintenance_plans;
create policy hotel_preventive_maintenance_insert_access on public.hotel_preventive_maintenance_plans
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager','maintenance']::text[]));

drop policy if exists hotel_preventive_maintenance_update_access on public.hotel_preventive_maintenance_plans;
create policy hotel_preventive_maintenance_update_access on public.hotel_preventive_maintenance_plans
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','maintenance']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager','maintenance']::text[]));

create table if not exists public.hotel_preventive_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  plan_id uuid not null references public.hotel_preventive_maintenance_plans(id) on delete cascade,
  completed_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  technician_name text,
  supplier_id uuid,
  note text,
  attachment_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists hotel_preventive_maintenance_events_plan_idx on public.hotel_preventive_maintenance_events(property_id,plan_id,completed_at desc);

alter table public.hotel_preventive_maintenance_events enable row level security;

drop policy if exists hotel_preventive_maintenance_events_select_access on public.hotel_preventive_maintenance_events;
create policy hotel_preventive_maintenance_events_select_access on public.hotel_preventive_maintenance_events
for select to authenticated using (private.user_has_property_access(property_id));

drop policy if exists hotel_preventive_maintenance_events_insert_access on public.hotel_preventive_maintenance_events;
create policy hotel_preventive_maintenance_events_insert_access on public.hotel_preventive_maintenance_events
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager','maintenance']::text[]));

create or replace function private.hl_preventive_maintenance_tenant_guard()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.room_id is not null and not exists(select 1 from public.habitaciones h where h.id=new.room_id and h.property_id=new.property_id) then
    raise exception using errcode='23514',message='La habitación no pertenece a la propiedad.';
  end if;
  if new.resource_id is not null and not exists(select 1 from public.hotel_resources r where r.id=new.resource_id and r.property_id=new.property_id) then
    raise exception using errcode='23514',message='El recurso no pertenece a la propiedad.';
  end if;
  new.updated_at:=now();
  return new;
end
$function$;

drop trigger if exists hotel_preventive_maintenance_tenant_guard on public.hotel_preventive_maintenance_plans;
create trigger hotel_preventive_maintenance_tenant_guard before insert or update on public.hotel_preventive_maintenance_plans for each row execute function private.hl_preventive_maintenance_tenant_guard();

create or replace function private.hl_preventive_event_tenant_guard()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if not exists(select 1 from public.hotel_preventive_maintenance_plans p where p.id=new.plan_id and p.property_id=new.property_id) then
    raise exception using errcode='23514',message='El plan de mantenimiento no pertenece a la propiedad.';
  end if;
  return new;
end
$function$;

drop trigger if exists hotel_preventive_maintenance_events_tenant_guard on public.hotel_preventive_maintenance_events;
create trigger hotel_preventive_maintenance_events_tenant_guard before insert or update on public.hotel_preventive_maintenance_events for each row execute function private.hl_preventive_event_tenant_guard();

commit;
