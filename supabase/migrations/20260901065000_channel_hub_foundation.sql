alter table public.hotel_channel_connections add column if not exists transport text not null default 'legacy';
alter table public.hotel_channel_connections add column if not exists adapter text;
alter table public.hotel_channel_connections add column if not exists external_property_id text;
alter table public.hotel_channel_connections add column if not exists credential_secret_id uuid;
alter table public.hotel_channel_connections add column if not exists sync_cursor text;
alter table public.hotel_channel_connections add column if not exists diagnostics jsonb not null default '{}'::jsonb;

update public.hotel_channel_connections
set transport=case when provider='Motor directo' then 'native' else coalesce(nullif(transport,''),'legacy') end,
    adapter=case when provider='Motor directo' then 'native' else adapter end
where true;

create table if not exists public.hotel_distribution_calendar (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  room_type text not null,
  stay_date date not null,
  base_price numeric(14,2),
  min_stay integer not null default 1 check(min_stay>=1),
  max_stay integer not null default 0 check(max_stay>=0),
  stop_sell boolean not null default false,
  closed_to_arrival boolean not null default false,
  closed_to_departure boolean not null default false,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,room_type,stay_date)
);
create index if not exists hotel_distribution_calendar_property_date_idx on public.hotel_distribution_calendar(property_id,stay_date,room_type);

create table if not exists public.hotel_channel_mappings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  connection_id uuid not null references public.hotel_channel_connections(id) on delete cascade,
  mapping_type text not null check(mapping_type in ('room_type','rate_plan','channel')),
  local_key text not null,
  channel_code text not null default '',
  external_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id,mapping_type,local_key,channel_code)
);
create index if not exists hotel_channel_mappings_property_idx on public.hotel_channel_mappings(property_id,connection_id,mapping_type);

create table if not exists public.hotel_channel_rate_overrides (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  connection_id uuid not null references public.hotel_channel_connections(id) on delete cascade,
  channel_code text not null,
  room_type text not null,
  stay_date date not null,
  price_mode text not null default 'inherit' check(price_mode in ('inherit','absolute','delta_amount','delta_percent')),
  price_value numeric(14,2),
  min_stay integer check(min_stay is null or min_stay>=1),
  max_stay integer check(max_stay is null or max_stay>=0),
  stop_sell boolean,
  closed_to_arrival boolean,
  closed_to_departure boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connection_id,channel_code,room_type,stay_date)
);
create index if not exists hotel_channel_rate_overrides_property_date_idx on public.hotel_channel_rate_overrides(property_id,stay_date,channel_code,room_type);

create table if not exists public.hotel_channel_outbox (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  connection_id uuid not null references public.hotel_channel_connections(id) on delete cascade,
  event_type text not null check(event_type in ('inventory','ari','full_sync')),
  reason text,
  date_from date not null,
  date_to date not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','processing','retry','sent','failed','cancelled')),
  attempts integer not null default 0,
  next_retry_at timestamptz,
  last_error text,
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  check(date_to>=date_from)
);
create index if not exists hotel_channel_outbox_pending_idx on public.hotel_channel_outbox(connection_id,status,next_retry_at,created_at);
create index if not exists hotel_channel_outbox_property_idx on public.hotel_channel_outbox(property_id,created_at desc);

create table if not exists public.hotel_channel_inbox (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  connection_id uuid not null references public.hotel_channel_connections(id) on delete cascade,
  provider_event_id text not null,
  event_type text not null,
  external_reservation_id text,
  channel_code text,
  payload jsonb not null,
  status text not null default 'pending' check(status in ('pending','processed','rejected','duplicate','failed')),
  reservation_id bigint references public.reservas(id) on delete set null,
  error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(connection_id,provider_event_id)
);
create index if not exists hotel_channel_inbox_property_idx on public.hotel_channel_inbox(property_id,received_at desc);
create index if not exists hotel_channel_inbox_reservation_idx on public.hotel_channel_inbox(reservation_id);

create table if not exists public.hotel_channel_sync_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  connection_id uuid not null references public.hotel_channel_connections(id) on delete cascade,
  direction text not null check(direction in ('outbound','inbound')),
  kind text not null,
  status text not null check(status in ('started','ok','warning','failed')),
  item_count integer not null default 0,
  summary text,
  detail jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists hotel_channel_sync_runs_property_idx on public.hotel_channel_sync_runs(property_id,started_at desc);

alter table public.hotel_distribution_calendar enable row level security;
alter table public.hotel_channel_mappings enable row level security;
alter table public.hotel_channel_rate_overrides enable row level security;
alter table public.hotel_channel_outbox enable row level security;
alter table public.hotel_channel_inbox enable row level security;
alter table public.hotel_channel_sync_runs enable row level security;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_distribution_calendar' and policyname='distribution_calendar_read') then
    create policy distribution_calendar_read on public.hotel_distribution_calendar for select to authenticated using(private.user_has_property_access(property_id));
    create policy distribution_calendar_manage on public.hotel_distribution_calendar for all to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin'])) with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_channel_mappings' and policyname='channel_mappings_read') then
    create policy channel_mappings_read on public.hotel_channel_mappings for select to authenticated using(private.user_has_property_access(property_id));
    create policy channel_mappings_manage on public.hotel_channel_mappings for all to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin'])) with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_channel_rate_overrides' and policyname='channel_overrides_read') then
    create policy channel_overrides_read on public.hotel_channel_rate_overrides for select to authenticated using(private.user_has_property_access(property_id));
    create policy channel_overrides_manage on public.hotel_channel_rate_overrides for all to authenticated using(private.user_has_property_role(property_id,array['owner','manager','admin'])) with check(private.user_has_property_role(property_id,array['owner','manager','admin']));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_channel_outbox' and policyname='channel_outbox_read') then
    create policy channel_outbox_read on public.hotel_channel_outbox for select to authenticated using(private.user_has_property_access(property_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_channel_inbox' and policyname='channel_inbox_read') then
    create policy channel_inbox_read on public.hotel_channel_inbox for select to authenticated using(private.user_has_property_access(property_id));
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='hotel_channel_sync_runs' and policyname='channel_sync_runs_read') then
    create policy channel_sync_runs_read on public.hotel_channel_sync_runs for select to authenticated using(private.user_has_property_access(property_id));
  end if;
end $$;

grant select,insert,update,delete on public.hotel_distribution_calendar,public.hotel_channel_mappings,public.hotel_channel_rate_overrides to authenticated;
grant select on public.hotel_channel_outbox,public.hotel_channel_inbox,public.hotel_channel_sync_runs to authenticated;

create or replace function public.hl_channel_vault_upsert_secret(p_secret_id uuid,p_name text,p_secret text,p_description text default '') returns uuid
language plpgsql security definer set search_path to 'public','vault','pg_temp' as $$
declare v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_id uuid;
begin
 if v_role <> 'service_role' then raise exception 'Operación restringida'; end if;
 if p_secret is null or length(p_secret)<16 then raise exception 'Secreto inválido'; end if;
 if p_secret_id is null then v_id:=vault.create_secret(p_secret,p_name,p_description); else perform vault.update_secret(p_secret_id,p_secret,p_name,p_description); v_id:=p_secret_id; end if;
 return v_id;
end $$;
create or replace function public.hl_channel_vault_read_secret(p_secret_id uuid) returns text
language plpgsql security definer set search_path to 'public','vault','pg_temp' as $$
declare v_role text:=coalesce(current_setting('request.jwt.claim.role',true),''); v_secret text;
begin
 if v_role <> 'service_role' then raise exception 'Operación restringida'; end if;
 select decrypted_secret into v_secret from vault.decrypted_secrets where id=p_secret_id;
 return v_secret;
end $$;
revoke all on function public.hl_channel_vault_upsert_secret(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.hl_channel_vault_read_secret(uuid) from public,anon,authenticated;
grant execute on function public.hl_channel_vault_upsert_secret(uuid,text,text,text) to service_role;
grant execute on function public.hl_channel_vault_read_secret(uuid) to service_role;

create or replace function public.hl_channel_inventory_snapshot(p_property_id uuid,p_start date,p_end date)
returns table(room_type text,stay_date date,capacity integer,reserved integer,blocked integer,group_hold integer,available integer,base_price numeric,min_stay integer,max_stay integer,stop_sell boolean,closed_to_arrival boolean,closed_to_departure boolean)
language sql stable security invoker set search_path='public','pg_temp' as $$
with dates as (
  select d::date stay_date from generate_series(p_start::timestamp,p_end::timestamp,interval '1 day') d where p_end>=p_start and p_end-p_start<=370
), room_base as (
  select h.id,coalesce(nullif(trim(h.tipo),''),'Habitación') room_type,coalesce(h.precio,0)::numeric base_price
  from public.habitaciones h
  where h.property_id=p_property_id and h.activa is not false and lower(coalesce(h.estado,'')) not in ('mantenimiento','fuera_servicio','fuera de servicio')
), types as (
  select room_type,count(*)::int capacity,min(base_price)::numeric fallback_price from room_base group by room_type
), reservation_rooms as (
  select r.id,r.fecha_entrada,r.fecha_salida,x.room_id
  from public.reservas r
  cross join lateral unnest(case when cardinality(r.habitaciones_ids)>0 then r.habitaciones_ids else array[r.habitacion_id] end) x(room_id)
  where r.property_id=p_property_id and x.room_id is not null and r.estado<>'cancelada' and not r.no_show
    and not(lower(coalesce(r.estado,''))='tentativa' and ((r.tentative_expired_at is not null) or (r.tentative_expires_at is not null and r.tentative_expires_at<=now())))
), reserved_by_type as (
  select rb.room_type,d.stay_date,count(distinct rr.room_id)::int reserved
  from dates d join reservation_rooms rr on d.stay_date>=rr.fecha_entrada and d.stay_date<rr.fecha_salida join room_base rb on rb.id=rr.room_id
  group by rb.room_type,d.stay_date
), blocked_by_type as (
  select rb.room_type,d.stay_date,count(distinct b.habitacion_id)::int blocked
  from dates d join public.bloqueos b on b.property_id=p_property_id and d.stay_date>=b.fecha_desde and d.stay_date<b.fecha_hasta join room_base rb on rb.id=b.habitacion_id
  group by rb.room_type,d.stay_date
), held_by_type as (
  select t.room_type,d.stay_date,coalesce(sum(g.quantity),0)::int group_hold
  from types t cross join dates d left join public.hotel_group_inventory_blocks g on g.property_id=p_property_id and lower(trim(g.room_type))=lower(trim(t.room_type)) and d.stay_date>=g.arrival_date and d.stay_date<g.departure_date and lower(coalesce(g.status,'')) not in ('cancelled','canceled','released') and (g.release_date is null or g.release_date>=current_date or lower(coalesce(g.status,'')) in ('confirmed','inhouse'))
  group by t.room_type,d.stay_date
), legacy_rate as (
  select rb.room_type,rc.stay_date,min(coalesce(rc.price,rb.base_price))::numeric price,max(rc.min_stay)::int min_stay,bool_or(rc.stop_sell) stop_sell,bool_or(rc.closed_to_arrival) cta,bool_or(rc.closed_to_departure) ctd
  from room_base rb join public.hotel_rate_calendar rc on rc.property_id=p_property_id and rc.habitacion_id=rb.id and rc.stay_date between p_start and p_end
  group by rb.room_type,rc.stay_date
)
select t.room_type,d.stay_date,t.capacity,coalesce(r.reserved,0),coalesce(b.blocked,0),coalesce(h.group_hold,0),greatest(0,t.capacity-coalesce(r.reserved,0)-coalesce(b.blocked,0)-coalesce(h.group_hold,0))::int,
       coalesce(dc.base_price,lr.price,t.fallback_price)::numeric,
       coalesce(dc.min_stay,lr.min_stay,1)::int,coalesce(dc.max_stay,0)::int,
       coalesce(dc.stop_sell,lr.stop_sell,false),coalesce(dc.closed_to_arrival,lr.cta,false),coalesce(dc.closed_to_departure,lr.ctd,false)
from types t cross join dates d
left join reserved_by_type r on r.room_type=t.room_type and r.stay_date=d.stay_date
left join blocked_by_type b on b.room_type=t.room_type and b.stay_date=d.stay_date
left join held_by_type h on h.room_type=t.room_type and h.stay_date=d.stay_date
left join public.hotel_distribution_calendar dc on dc.property_id=p_property_id and dc.room_type=t.room_type and dc.stay_date=d.stay_date
left join legacy_rate lr on lr.room_type=t.room_type and lr.stay_date=d.stay_date
order by t.room_type,d.stay_date
$$;
grant execute on function public.hl_channel_inventory_snapshot(uuid,date,date) to authenticated,service_role;

create or replace function public.hl_channel_queue_change(p_property_id uuid,p_event_type text,p_reason text,p_from date,p_to date) returns void
language plpgsql security definer set search_path='public','pg_temp' as $$
declare c record; q uuid; f date:=coalesce(p_from,current_date); t date:=coalesce(p_to,coalesce(p_from,current_date));
begin
 if p_property_id is null then return; end if;
 if t<f then t:=f; end if;
 for c in select id from public.hotel_channel_connections where property_id=p_property_id and transport='hub' and status not in ('disabled','not_connected') loop
   perform pg_advisory_xact_lock(hashtextextended(c.id::text||':'||p_event_type,0));
   select id into q from public.hotel_channel_outbox where connection_id=c.id and event_type=p_event_type and status in ('pending','retry') order by created_at limit 1 for update;
   if q is null then
     insert into public.hotel_channel_outbox(property_id,connection_id,event_type,reason,date_from,date_to) values(p_property_id,c.id,p_event_type,p_reason,f,t);
   else
     update public.hotel_channel_outbox set date_from=least(date_from,f),date_to=greatest(date_to,t),reason=coalesce(reason,p_reason),status='pending',next_retry_at=null,updated_at=now() where id=q;
   end if;
 end loop;
end $$;
revoke all on function public.hl_channel_queue_change(uuid,text,text,date,date) from public,anon,authenticated;
grant execute on function public.hl_channel_queue_change(uuid,text,text,date,date) to service_role;

create or replace function public.hl_channel_reservation_queue_trigger() returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare pid uuid:=coalesce(new.property_id,old.property_id); df date:=least(coalesce(new.fecha_entrada,old.fecha_entrada),coalesce(old.fecha_entrada,new.fecha_entrada)); dt date:=greatest(coalesce(new.fecha_salida,old.fecha_salida),coalesce(old.fecha_salida,new.fecha_salida));
begin perform public.hl_channel_queue_change(pid,'inventory','reservation_change',df,dt); return coalesce(new,old); end $$;
drop trigger if exists trg_channel_queue_reservas on public.reservas;
create trigger trg_channel_queue_reservas after insert or update or delete on public.reservas for each row execute function public.hl_channel_reservation_queue_trigger();

create or replace function public.hl_channel_block_queue_trigger() returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare pid uuid:=coalesce(new.property_id,old.property_id); df date:=least(coalesce(new.fecha_desde,old.fecha_desde),coalesce(old.fecha_desde,new.fecha_desde)); dt date:=greatest(coalesce(new.fecha_hasta,old.fecha_hasta),coalesce(old.fecha_hasta,new.fecha_hasta));
begin perform public.hl_channel_queue_change(pid,'inventory','block_change',df,dt); return coalesce(new,old); end $$;
drop trigger if exists trg_channel_queue_bloqueos on public.bloqueos;
create trigger trg_channel_queue_bloqueos after insert or update or delete on public.bloqueos for each row execute function public.hl_channel_block_queue_trigger();

create or replace function public.hl_channel_distribution_queue_trigger() returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare pid uuid:=coalesce(new.property_id,old.property_id); d date:=coalesce(new.stay_date,old.stay_date);
begin perform public.hl_channel_queue_change(pid,'ari','distribution_change',d,d); return coalesce(new,old); end $$;
drop trigger if exists trg_channel_queue_distribution on public.hotel_distribution_calendar;
create trigger trg_channel_queue_distribution after insert or update or delete on public.hotel_distribution_calendar for each row execute function public.hl_channel_distribution_queue_trigger();

drop trigger if exists trg_channel_queue_legacy_rates on public.hotel_rate_calendar;
create trigger trg_channel_queue_legacy_rates after insert or update or delete on public.hotel_rate_calendar for each row execute function public.hl_channel_distribution_queue_trigger();

create or replace function public.hl_channel_override_queue_trigger() returns trigger language plpgsql security definer set search_path='public','pg_temp' as $$
declare pid uuid:=coalesce(new.property_id,old.property_id); d date:=coalesce(new.stay_date,old.stay_date);
begin perform public.hl_channel_queue_change(pid,'ari','channel_override',d,d); return coalesce(new,old); end $$;
drop trigger if exists trg_channel_queue_overrides on public.hotel_channel_rate_overrides;
create trigger trg_channel_queue_overrides after insert or update or delete on public.hotel_channel_rate_overrides for each row execute function public.hl_channel_override_queue_trigger();
