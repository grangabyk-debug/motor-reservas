create table if not exists public.hotel_room_types (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  code text,
  color text not null default '#5B6CF3',
  capacity integer not null default 2 check (capacity >= 1 and capacity <= 30),
  adults integer not null default 2 check (adults >= 0 and adults <= 30),
  children integer not null default 0 check (children >= 0 and children <= 30),
  beds integer not null default 1 check (beds >= 0 and beds <= 20),
  base_price numeric not null default 0 check (base_price >= 0),
  description text,
  amenities jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  online_bookable boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hotel_room_types_property_name_uidx on public.hotel_room_types(property_id, lower(name));
create index if not exists hotel_room_types_property_sort_idx on public.hotel_room_types(property_id, sort_order, name);

alter table public.hotel_room_types enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hotel_room_types' and policyname='room_types_select_access') then
    create policy room_types_select_access on public.hotel_room_types for select using (private.user_has_property_access(property_id));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hotel_room_types' and policyname='room_types_insert_management') then
    create policy room_types_insert_management on public.hotel_room_types for insert with check (private.user_has_property_role(property_id,array['owner'::text,'manager'::text]));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hotel_room_types' and policyname='room_types_update_management') then
    create policy room_types_update_management on public.hotel_room_types for update using (private.user_has_property_role(property_id,array['owner'::text,'manager'::text])) with check (private.user_has_property_role(property_id,array['owner'::text,'manager'::text]));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='hotel_room_types' and policyname='room_types_delete_management') then
    create policy room_types_delete_management on public.hotel_room_types for delete using (private.user_has_property_role(property_id,array['owner'::text,'manager'::text]));
  end if;
end $$;

grant select,insert,update,delete on public.hotel_room_types to authenticated;

alter table public.habitaciones add column if not exists room_type_id uuid references public.hotel_room_types(id) on delete set null;
alter table public.habitaciones add column if not exists color text;
create index if not exists habitaciones_property_room_type_idx on public.habitaciones(property_id,room_type_id);

do $$ begin
  if exists(select 1 from pg_trigger where tgrelid='public.habitaciones'::regclass and tgname='hl_guard_room_update_by_role_trigger') then
    alter table public.habitaciones disable trigger hl_guard_room_update_by_role_trigger;
  end if;
end $$;

with ranked as (
  select property_id,trim(tipo) as name,max(coalesce(capacidad,1)) as capacity,min(coalesce(precio,0)) as base_price,
         bool_or(coalesce(activa,true)) as active,bool_or(coalesce(online_bookable,true)) as online_bookable,
         row_number() over(partition by property_id order by lower(trim(tipo))) as rn
  from public.habitaciones
  where nullif(trim(coalesce(tipo,'')),'') is not null
  group by property_id,trim(tipo)
)
insert into public.hotel_room_types(property_id,name,code,color,capacity,adults,children,beds,base_price,active,online_bookable,sort_order)
select property_id,name,nullif(upper(left(regexp_replace(name,'[^A-Za-z0-9]+','','g'),8)),''),
       (array['#5B6CF3','#2EA7A0','#9A6BDF','#D59B48','#4A8FD8','#D56F8A','#5A9B68','#8A6E5A'])[((rn-1)%8)+1],
       capacity,capacity,0,1,base_price,active,online_bookable,rn
from ranked
on conflict do nothing;

update public.habitaciones h
set room_type_id=rt.id
from public.hotel_room_types rt
where h.property_id=rt.property_id and h.room_type_id is null and lower(trim(coalesce(h.tipo,'')))=lower(trim(rt.name));

do $$ begin
  if exists(select 1 from pg_trigger where tgrelid='public.habitaciones'::regclass and tgname='hl_guard_room_update_by_role_trigger') then
    alter table public.habitaciones enable trigger hl_guard_room_update_by_role_trigger;
  end if;
end $$;

create or replace function private.validate_habitacion_room_type_property()
returns trigger language plpgsql security definer set search_path=public,private as $$
begin
  if new.room_type_id is not null and not exists(select 1 from public.hotel_room_types rt where rt.id=new.room_type_id and rt.property_id=new.property_id) then
    raise exception 'room_type_id does not belong to this property';
  end if;
  return new;
end;
$$;
revoke all on function private.validate_habitacion_room_type_property() from public;

drop trigger if exists habitaciones_room_type_property_guard on public.habitaciones;
create trigger habitaciones_room_type_property_guard before insert or update of room_type_id,property_id on public.habitaciones for each row execute function private.validate_habitacion_room_type_property();

create or replace function public.hl_guard_room_update_by_role()
returns trigger language plpgsql set search_path to 'public','private','pg_temp' as $$
begin
  if private.user_has_property_role(new.property_id,array['owner','manager']::text[]) then return new; end if;
  if not private.user_has_property_role(new.property_id,array['housekeeping','maintenance']::text[]) then
    raise exception using errcode='42501',message='Tu rol no puede modificar habitaciones.';
  end if;
  if new.nombre is distinct from old.nombre
     or new.tipo is distinct from old.tipo
     or new.room_type_id is distinct from old.room_type_id
     or new.color is distinct from old.color
     or new.capacidad is distinct from old.capacidad
     or new.precio is distinct from old.precio
     or new.activa is distinct from old.activa
     or new.online_bookable is distinct from old.online_bookable
     or new.cochera_precio is distinct from old.cochera_precio
     or new.floor_id is distinct from old.floor_id
     or new.sort_order is distinct from old.sort_order
     or new.descripcion is distinct from old.descripcion
     or new.alojamiento_id is distinct from old.alojamiento_id
     or new.property_id is distinct from old.property_id then
    raise exception using errcode='42501',message='Housekeeping y Mantenimiento solo pueden cambiar el estado operativo de la habitación.';
  end if;
  return new;
end;
$$;
