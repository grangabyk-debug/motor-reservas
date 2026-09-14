create table if not exists public.hotel_operational_notifications (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  connection_id uuid references public.hotel_channel_connections(id) on delete set null,
  source_event_id text not null,
  event_type text not null check (event_type in ('booking_new','booking_modified','booking_cancelled')),
  channel_code text,
  provider_name text not null default 'OTA',
  reservation_id bigint references public.reservas(id) on delete set null,
  title text not null,
  detail text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(property_id, connection_id, source_event_id)
);

create index if not exists hotel_operational_notifications_property_created_idx
  on public.hotel_operational_notifications(property_id, created_at desc);
create index if not exists hotel_operational_notifications_reservation_idx
  on public.hotel_operational_notifications(reservation_id)
  where reservation_id is not null;

create table if not exists public.hotel_notification_reads (
  notification_id uuid not null references public.hotel_operational_notifications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(notification_id, user_id)
);

create index if not exists hotel_notification_reads_user_idx
  on public.hotel_notification_reads(user_id, read_at desc);

alter table public.hotel_operational_notifications enable row level security;
alter table public.hotel_notification_reads enable row level security;
revoke all on public.hotel_operational_notifications from anon;
revoke all on public.hotel_notification_reads from anon;
grant select on public.hotel_operational_notifications to authenticated;
grant select,insert,delete on public.hotel_notification_reads to authenticated;

drop policy if exists hotel_operational_notifications_select_property on public.hotel_operational_notifications;
create policy hotel_operational_notifications_select_property
on public.hotel_operational_notifications for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_notification_reads_select_own on public.hotel_notification_reads;
create policy hotel_notification_reads_select_own
on public.hotel_notification_reads for select to authenticated
using (
  user_id=auth.uid()
  and exists (
    select 1 from public.hotel_operational_notifications n
    where n.id=notification_id and private.user_has_property_access(n.property_id)
  )
);

drop policy if exists hotel_notification_reads_insert_own on public.hotel_notification_reads;
create policy hotel_notification_reads_insert_own
on public.hotel_notification_reads for insert to authenticated
with check (
  user_id=auth.uid()
  and exists (
    select 1 from public.hotel_operational_notifications n
    where n.id=notification_id and private.user_has_property_access(n.property_id)
  )
);

drop policy if exists hotel_notification_reads_delete_own on public.hotel_notification_reads;
create policy hotel_notification_reads_delete_own
on public.hotel_notification_reads for delete to authenticated
using (
  user_id=auth.uid()
  and exists (
    select 1 from public.hotel_operational_notifications n
    where n.id=notification_id and private.user_has_property_access(n.property_id)
  )
);

create or replace function public.hl_emit_channel_notification_from_inbox()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r record;
  h record;
  v_provider text;
  v_title text;
  v_detail text;
begin
  if new.status <> 'processed'
     or new.event_type not in ('booking_new','booking_modified','booking_cancelled')
     or new.reservation_id is null then
    return new;
  end if;

  select id, numero_reserva, nombre_huesped, fecha_entrada, fecha_salida,
         habitacion_id, canal_reserva, codigo_canal
    into r
  from public.reservas
  where id=new.reservation_id and property_id=new.property_id;

  if not found then return new; end if;

  select nombre, tipo into h
  from public.habitaciones
  where id=r.habitacion_id and property_id=new.property_id;

  v_provider := case
    when coalesce(new.channel_code,'')='BDC' then 'Booking.com'
    else coalesce(nullif(r.canal_reserva,''), nullif(new.channel_code,''), 'OTA')
  end;

  v_title := case new.event_type
    when 'booking_new' then 'Nueva reserva OTA'
    when 'booking_modified' then 'Reserva OTA modificada'
    when 'booking_cancelled' then 'Reserva OTA cancelada'
  end;

  v_detail := concat_ws(' · ',
    nullif(r.nombre_huesped,''),
    case when r.fecha_entrada is not null and r.fecha_salida is not null
      then to_char(r.fecha_entrada,'DD/MM')||' → '||to_char(r.fecha_salida,'DD/MM') end,
    case when h.nombre is not null then 'Hab. '||h.nombre end
  );

  insert into public.hotel_operational_notifications(
    property_id, connection_id, source_event_id, event_type, channel_code,
    provider_name, reservation_id, title, detail, metadata
  ) values (
    new.property_id, new.connection_id, new.provider_event_id, new.event_type, new.channel_code,
    v_provider, new.reservation_id, v_title, coalesce(v_detail,''),
    jsonb_strip_nulls(jsonb_build_object(
      'external_reservation_id', new.external_reservation_id,
      'reservation_number', r.numero_reserva,
      'guest_name', r.nombre_huesped,
      'arrival_date', r.fecha_entrada,
      'departure_date', r.fecha_salida,
      'room_name', h.nombre,
      'room_type', h.tipo,
      'channel_code', new.channel_code,
      'provider', v_provider
    ))
  )
  on conflict (property_id, connection_id, source_event_id) do nothing;

  return new;
end;
$$;

revoke all on function public.hl_emit_channel_notification_from_inbox() from public;

drop trigger if exists trg_hl_channel_notification_from_inbox on public.hotel_channel_inbox;
create trigger trg_hl_channel_notification_from_inbox
after insert or update of status, reservation_id, event_type on public.hotel_channel_inbox
for each row execute function public.hl_emit_channel_notification_from_inbox();

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(
       select 1 from pg_publication_tables
       where pubname='supabase_realtime'
         and schemaname='public'
         and tablename='hotel_operational_notifications'
     ) then
    execute 'alter publication supabase_realtime add table public.hotel_operational_notifications';
  end if;
end $$;
