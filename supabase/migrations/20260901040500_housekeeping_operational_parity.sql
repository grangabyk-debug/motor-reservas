-- Habitación Llena · Housekeeping operativo inspirado en el flujo real de pisos

create table if not exists public.hotel_housekeeping_checklist_catalog (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  required boolean not null default true,
  transition text not null default 'clean_to_inspected' check (transition in ('clean_to_inspected')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hotel_housekeeping_checklist_property_label_idx
  on public.hotel_housekeeping_checklist_catalog(property_id,lower(label));
create index if not exists hotel_housekeeping_checklist_property_sort_idx
  on public.hotel_housekeeping_checklist_catalog(property_id,active,sort_order,label);
alter table public.hotel_housekeeping_checklist_catalog enable row level security;
revoke all on public.hotel_housekeeping_checklist_catalog from anon;
grant select,insert,update,delete on public.hotel_housekeeping_checklist_catalog to authenticated;
drop policy if exists hotel_housekeeping_checklist_select_access on public.hotel_housekeeping_checklist_catalog;
create policy hotel_housekeeping_checklist_select_access on public.hotel_housekeeping_checklist_catalog for select to authenticated
using (private.user_has_property_access(property_id));
drop policy if exists hotel_housekeeping_checklist_insert_management on public.hotel_housekeeping_checklist_catalog;
create policy hotel_housekeeping_checklist_insert_management on public.hotel_housekeeping_checklist_catalog for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','manager']::text[]));
drop policy if exists hotel_housekeeping_checklist_update_management on public.hotel_housekeeping_checklist_catalog;
create policy hotel_housekeeping_checklist_update_management on public.hotel_housekeeping_checklist_catalog for update to authenticated
using (private.user_has_property_role(property_id,array['owner','manager']::text[]))
with check (private.user_has_property_role(property_id,array['owner','manager']::text[]));
drop policy if exists hotel_housekeeping_checklist_delete_management on public.hotel_housekeeping_checklist_catalog;
create policy hotel_housekeeping_checklist_delete_management on public.hotel_housekeeping_checklist_catalog for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','manager']::text[]));

create table if not exists public.hotel_housekeeping_schedules (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  mode text not null default 'periodic' check (mode in ('periodic','weekdays')),
  every_n_nights integer not null default 2 check (every_n_nights between 1 and 60),
  weekdays smallint[] not null default '{}'::smallint[],
  last_cleaning_date date,
  next_cleaning_date date,
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,reservation_id)
);
create index if not exists hotel_housekeeping_schedules_due_idx
  on public.hotel_housekeeping_schedules(property_id,active,next_cleaning_date);
alter table public.hotel_housekeeping_schedules enable row level security;
revoke all on public.hotel_housekeeping_schedules from anon;
grant select,insert,update,delete on public.hotel_housekeeping_schedules to authenticated;
drop policy if exists hotel_housekeeping_schedules_select_access on public.hotel_housekeeping_schedules;
create policy hotel_housekeeping_schedules_select_access on public.hotel_housekeeping_schedules for select to authenticated
using (private.user_has_property_access(property_id));
drop policy if exists hotel_housekeeping_schedules_insert_access on public.hotel_housekeeping_schedules;
create policy hotel_housekeeping_schedules_insert_access on public.hotel_housekeeping_schedules for insert to authenticated
with check (private.user_has_property_access(property_id));
drop policy if exists hotel_housekeeping_schedules_update_access on public.hotel_housekeeping_schedules;
create policy hotel_housekeeping_schedules_update_access on public.hotel_housekeeping_schedules for update to authenticated
using (private.user_has_property_access(property_id)) with check (private.user_has_property_access(property_id));
drop policy if exists hotel_housekeeping_schedules_delete_access on public.hotel_housekeeping_schedules;
create policy hotel_housekeeping_schedules_delete_access on public.hotel_housekeeping_schedules for delete to authenticated
using (private.user_has_property_access(property_id));

create table if not exists public.hotel_housekeeping_history (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_id bigint not null references public.habitaciones(id) on delete cascade,
  reservation_id bigint references public.reservas(id) on delete set null,
  task_id uuid references public.hotel_housekeeping_tasks(id) on delete set null,
  from_status text,
  to_status text not null,
  source text not null default 'manual',
  note text,
  metadata jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hotel_housekeeping_history_room_idx
  on public.hotel_housekeeping_history(property_id,room_id,created_at desc);
create index if not exists hotel_housekeeping_history_reservation_idx
  on public.hotel_housekeeping_history(property_id,reservation_id,created_at desc);
alter table public.hotel_housekeeping_history enable row level security;
revoke all on public.hotel_housekeeping_history from anon;
grant select,insert on public.hotel_housekeeping_history to authenticated;
drop policy if exists hotel_housekeeping_history_select_access on public.hotel_housekeeping_history;
create policy hotel_housekeeping_history_select_access on public.hotel_housekeeping_history for select to authenticated
using (private.user_has_property_access(property_id));
drop policy if exists hotel_housekeeping_history_insert_access on public.hotel_housekeeping_history;
create policy hotel_housekeeping_history_insert_access on public.hotel_housekeeping_history for insert to authenticated
with check (private.user_has_property_access(property_id));

create or replace function public.hl_housekeeping_next_cleaning_date(
  p_arrival date,
  p_departure date,
  p_mode text,
  p_every_n_nights integer,
  p_weekdays smallint[],
  p_not_before date default null
)
returns date
language plpgsql
immutable
set search_path to 'public','pg_temp'
as $$
declare
  v_mode text := lower(coalesce(p_mode,'periodic'));
  v_candidate date;
  v_step integer := greatest(1,coalesce(p_every_n_nights,2));
  v_floor date := greatest(p_arrival,coalesce(p_not_before,p_arrival));
  v_weekdays smallint[] := coalesce(p_weekdays,'{}'::smallint[]);
begin
  if p_arrival is null or p_departure is null or p_departure <= p_arrival then return null; end if;
  if v_mode='periodic' then
    v_candidate := p_arrival + v_step;
    while v_candidate < v_floor loop v_candidate := v_candidate + v_step; end loop;
    if v_candidate < p_departure then return v_candidate; end if;
    return null;
  end if;
  if v_mode='weekdays' then
    if coalesce(cardinality(v_weekdays),0)=0 then return null; end if;
    v_candidate := greatest(p_arrival + 1,v_floor);
    while v_candidate < p_departure loop
      if extract(dow from v_candidate)::smallint = any(v_weekdays) then return v_candidate; end if;
      v_candidate := v_candidate + 1;
    end loop;
  end if;
  return null;
end;
$$;

grant execute on function public.hl_housekeeping_next_cleaning_date(date,date,text,integer,smallint[],date) to authenticated;
revoke execute on function public.hl_housekeeping_next_cleaning_date(date,date,text,integer,smallint[],date) from anon;

create or replace function public.hl_housekeeping_save_schedule(
  p_reservation_id bigint,
  p_mode text default 'periodic',
  p_every_n_nights integer default 2,
  p_weekdays smallint[] default '{}'::smallint[],
  p_active boolean default true,
  p_notes text default null
)
returns public.hotel_housekeeping_schedules
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_res public.reservas%rowtype;
  v_saved public.hotel_housekeeping_schedules%rowtype;
  v_mode text := lower(coalesce(p_mode,'periodic'));
  v_next date;
begin
  select * into v_res from public.reservas where id=p_reservation_id;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_access(v_res.property_id) then raise exception using errcode='42501',message='No tenés acceso a esta propiedad.'; end if;
  if v_mode not in ('periodic','weekdays') then raise exception using errcode='22023',message='La rutina de limpieza no es válida.'; end if;
  if v_mode='periodic' and coalesce(p_every_n_nights,0)<1 then raise exception using errcode='22023',message='Indicá cada cuántas noches corresponde limpiar.'; end if;
  if v_mode='weekdays' and coalesce(cardinality(p_weekdays),0)=0 then raise exception using errcode='22023',message='Elegí al menos un día de limpieza.'; end if;
  v_next := case when p_active then public.hl_housekeeping_next_cleaning_date(v_res.fecha_entrada,v_res.fecha_salida,v_mode,greatest(1,coalesce(p_every_n_nights,2)),coalesce(p_weekdays,'{}'::smallint[]),greatest(v_res.fecha_entrada,current_date)) else null end;
  insert into public.hotel_housekeeping_schedules(property_id,reservation_id,mode,every_n_nights,weekdays,next_cleaning_date,active,notes,created_by,updated_at)
  values(v_res.property_id,v_res.id,v_mode,greatest(1,coalesce(p_every_n_nights,2)),coalesce(p_weekdays,'{}'::smallint[]),v_next,coalesce(p_active,true),nullif(trim(coalesce(p_notes,'')),''),auth.uid(),now())
  on conflict(property_id,reservation_id) do update set mode=excluded.mode,every_n_nights=excluded.every_n_nights,weekdays=excluded.weekdays,next_cleaning_date=excluded.next_cleaning_date,active=excluded.active,notes=excluded.notes,updated_at=now()
  returning * into v_saved;
  return v_saved;
end;
$$;
revoke execute on function public.hl_housekeeping_save_schedule(bigint,text,integer,smallint[],boolean,text) from anon;
grant execute on function public.hl_housekeeping_save_schedule(bigint,text,integer,smallint[],boolean,text) to authenticated;

create or replace function public.hl_housekeeping_set_room_state(
  p_room_id bigint,
  p_status text,
  p_checklist jsonb default '[]'::jsonb,
  p_source text default 'manual',
  p_note text default null
)
returns public.habitaciones
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_room public.habitaciones%rowtype;
  v_current text;
  v_target text := lower(trim(coalesce(p_status,'')));
  v_required integer := 0;
  v_done integer := 0;
  v_res public.reservas%rowtype;
  v_schedule public.hotel_housekeeping_schedules%rowtype;
begin
  select * into v_room from public.habitaciones where id=p_room_id for update;
  if not found then raise exception using errcode='P0002',message='Habitación inexistente.'; end if;
  if not private.user_has_property_access(v_room.property_id) then raise exception using errcode='42501',message='No tenés acceso a esta propiedad.'; end if;
  if v_target='inspeccion' then v_target:='inspeccionada'; end if;
  if v_target='en_limpieza' then v_target:='limpieza'; end if;
  if v_target not in ('sucia','limpieza','limpia','inspeccionada') then raise exception using errcode='22023',message='Estado de housekeeping no válido.'; end if;
  v_current := lower(coalesce(v_room.estado,'libre'));
  if v_current in ('mantenimiento','fuera_servicio') then raise exception using errcode='22023',message='La habitación está bloqueada por mantenimiento/fuera de servicio.'; end if;
  if v_target='limpieza' and v_current not in ('sucia','limpieza','en_limpieza') then raise exception using errcode='22023',message='Solo una habitación sucia puede pasar a limpieza.'; end if;
  if v_target='limpia' and v_current not in ('sucia','limpieza','en_limpieza','limpia') then raise exception using errcode='22023',message='La habitación debe estar sucia o en limpieza antes de marcarla limpia.'; end if;
  if v_target='inspeccionada' and v_current not in ('limpia','inspeccion','inspeccionada') then raise exception using errcode='22023',message='Primero marcá la habitación como limpia.'; end if;

  if v_target='inspeccionada' and v_current not in ('inspeccionada','inspeccion') then
    select count(*) into v_required from public.hotel_housekeeping_checklist_catalog c where c.property_id=v_room.property_id and c.active and c.required and c.transition='clean_to_inspected';
    if v_required>0 then
      select count(distinct c.id) into v_done
      from public.hotel_housekeeping_checklist_catalog c
      join lateral jsonb_array_elements(coalesce(p_checklist,'[]'::jsonb)) j on (j->>'id')=c.id::text and lower(coalesce(j->>'done','false'))='true'
      where c.property_id=v_room.property_id and c.active and c.required and c.transition='clean_to_inspected';
      if v_done<v_required then raise exception using errcode='22023',message='Completá las tareas obligatorias antes de inspeccionar la habitación.'; end if;
    end if;
  end if;

  select * into v_res from public.reservas r
  where r.property_id=v_room.property_id and r.estado='alojado' and not coalesce(r.no_show,false)
    and current_date>=r.fecha_entrada and current_date<=r.fecha_salida
    and (r.habitacion_id=v_room.id or v_room.id=any(coalesce(r.habitaciones_ids,array[]::bigint[])))
  order by r.fecha_entrada desc limit 1;

  update public.habitaciones set estado=v_target where id=v_room.id returning * into v_room;
  insert into public.hotel_housekeeping_history(property_id,room_id,reservation_id,from_status,to_status,source,note,metadata,actor_id)
  values(v_room.property_id,v_room.id,case when v_res.id is null then null else v_res.id end,v_current,v_target,coalesce(nullif(trim(coalesce(p_source,'')),''),'manual'),nullif(trim(coalesce(p_note,'')),''),jsonb_build_object('checklist',coalesce(p_checklist,'[]'::jsonb)),auth.uid());

  if v_target='inspeccionada' and v_res.id is not null then
    select * into v_schedule from public.hotel_housekeeping_schedules where property_id=v_room.property_id and reservation_id=v_res.id and active for update;
    if found then
      update public.hotel_housekeeping_schedules set last_cleaning_date=current_date,next_cleaning_date=public.hl_housekeeping_next_cleaning_date(v_res.fecha_entrada,v_res.fecha_salida,v_schedule.mode,v_schedule.every_n_nights,v_schedule.weekdays,current_date+1),updated_at=now() where id=v_schedule.id;
    end if;
  end if;
  return v_room;
end;
$$;
revoke execute on function public.hl_housekeeping_set_room_state(bigint,text,jsonb,text,text) from anon;
grant execute on function public.hl_housekeeping_set_room_state(bigint,text,jsonb,text,text) to authenticated;

create or replace function private.hl_housekeeping_reservation_state_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_room_id bigint;
  v_previous text;
  v_rooms bigint[];
  v_source text;
begin
  if new.estado is not distinct from old.estado or new.estado not in ('alojado','finalizada') then return new; end if;
  v_source := case when new.estado='alojado' then 'checkin' else 'checkout' end;
  v_rooms := case when coalesce(cardinality(new.habitaciones_ids),0)>0 then new.habitaciones_ids when new.habitacion_id is not null then array[new.habitacion_id] else array[]::bigint[] end;
  foreach v_room_id in array v_rooms loop
    select lower(coalesce(estado,'libre')) into v_previous from public.habitaciones where id=v_room_id and property_id=new.property_id for update;
    if found and v_previous not in ('mantenimiento','fuera_servicio') then
      update public.habitaciones set estado='sucia' where id=v_room_id and property_id=new.property_id;
      insert into public.hotel_housekeeping_history(property_id,room_id,reservation_id,from_status,to_status,source,note,actor_id)
      values(new.property_id,v_room_id,new.id,v_previous,'sucia',v_source,case when v_source='checkin' then 'Habitación marcada sucia automáticamente al hacer check-in.' else 'Habitación liberada a housekeeping al hacer check-out.' end,auth.uid());
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_hl_housekeeping_reservation_state on public.reservas;
create trigger trg_hl_housekeeping_reservation_state
after update of estado on public.reservas
for each row execute function private.hl_housekeeping_reservation_state_sync();

create or replace function private.hl_seed_housekeeping_defaults()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
begin
  insert into public.hotel_housekeeping_checklist_catalog(property_id,label,required,sort_order)
  values(new.id,'Baño revisado',true,10),(new.id,'Amenities completos',true,20),(new.id,'Cama y blancos revisados',true,30),(new.id,'Minibar / consumos revisados',false,40)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists trg_hl_seed_housekeeping_defaults on public.properties;
create trigger trg_hl_seed_housekeeping_defaults after insert on public.properties for each row execute function private.hl_seed_housekeeping_defaults();

insert into public.hotel_housekeeping_checklist_catalog(property_id,label,required,sort_order)
select p.id,v.label,v.required,v.sort_order
from public.properties p
cross join (values ('Baño revisado',true,10),('Amenities completos',true,20),('Cama y blancos revisados',true,30),('Minibar / consumos revisados',false,40)) as v(label,required,sort_order)
where not exists(select 1 from public.hotel_housekeeping_checklist_catalog c where c.property_id=p.id and lower(c.label)=lower(v.label));

-- Realtime entre recepción y pisos también para rutina e historial.
do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hotel_housekeeping_schedules') then execute 'alter publication supabase_realtime add table public.hotel_housekeeping_schedules'; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hotel_housekeeping_history') then execute 'alter publication supabase_realtime add table public.hotel_housekeeping_history'; end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hotel_housekeeping_checklist_catalog') then execute 'alter publication supabase_realtime add table public.hotel_housekeeping_checklist_catalog'; end if;
  end if;
end $$;
