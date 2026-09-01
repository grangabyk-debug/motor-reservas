create table if not exists public.hotel_reservation_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  payload jsonb not null default '{}'::jsonb,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists hotel_reservation_events_reservation_created_idx
  on public.hotel_reservation_events(property_id,reservation_id,created_at desc);
create index if not exists hotel_reservation_events_actor_idx
  on public.hotel_reservation_events(actor_user_id,created_at desc);

alter table public.hotel_reservation_events enable row level security;

drop policy if exists hotel_reservation_events_select_access on public.hotel_reservation_events;
create policy hotel_reservation_events_select_access
on public.hotel_reservation_events for select to authenticated
using (private.user_has_property_access(property_id));

create or replace function private.hl_event_actor_name()
returns text
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select coalesce(nullif(trim(p.full_name),''),'Usuario')
  from public.profiles p
  where p.id=auth.uid()
  limit 1;
$function$;

create or replace function private.hl_log_reservation_change()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_name text:=private.hl_event_actor_name();
  v_title text;
  v_detail text;
begin
  if tg_op='INSERT' then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'created','Reserva creada',coalesce(new.numero_reserva,'Reserva '||new.id::text),jsonb_build_object('status',new.estado,'room_id',new.habitacion_id,'start',new.fecha_entrada,'end',new.fecha_salida,'channel',new.canal_reserva),v_actor,v_name);
    return new;
  end if;

  if new.estado is distinct from old.estado or new.no_show is distinct from old.no_show then
    v_title:=case
      when coalesce(new.no_show,false) then 'No show registrado'
      when new.estado='alojado' and old.estado is distinct from 'alojado' then 'Check-in realizado'
      when new.estado='finalizada' and old.estado is distinct from 'finalizada' then 'Check-out realizado'
      when new.estado='cancelada' and old.estado is distinct from 'cancelada' then 'Reserva cancelada'
      when old.estado='cancelada' and new.estado is distinct from 'cancelada' then 'Reserva reactivada'
      else 'Estado actualizado'
    end;
    v_detail:=coalesce(old.estado,'—')||' → '||coalesce(new.estado,'—');
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'status',v_title,v_detail,jsonb_build_object('before_status',old.estado,'after_status',new.estado,'before_no_show',old.no_show,'after_no_show',new.no_show),v_actor,v_name);
  end if;

  if new.habitacion_id is distinct from old.habitacion_id then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'room','Habitación modificada',coalesce(old.habitacion_id::text,'Sin asignar')||' → '||coalesce(new.habitacion_id::text,'Sin asignar'),jsonb_build_object('before_room_id',old.habitacion_id,'after_room_id',new.habitacion_id),v_actor,v_name);
  end if;

  if new.fecha_entrada is distinct from old.fecha_entrada or new.fecha_salida is distinct from old.fecha_salida or new.hora_llegada_estimada is distinct from old.hora_llegada_estimada or new.hora_salida_estimada is distinct from old.hora_salida_estimada then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'stay','Estadía modificada',coalesce(old.fecha_entrada::text,'—')||' → '||coalesce(old.fecha_salida::text,'—')||'  /  '||coalesce(new.fecha_entrada::text,'—')||' → '||coalesce(new.fecha_salida::text,'—'),jsonb_build_object('before_start',old.fecha_entrada,'before_end',old.fecha_salida,'after_start',new.fecha_entrada,'after_end',new.fecha_salida,'before_arrival_time',old.hora_llegada_estimada,'after_arrival_time',new.hora_llegada_estimada,'before_departure_time',old.hora_salida_estimada,'after_departure_time',new.hora_salida_estimada),v_actor,v_name);
  end if;

  if new.precio_total is distinct from old.precio_total or new.tarifa_noche is distinct from old.tarifa_noche or new.moneda is distinct from old.moneda then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'account','Cuenta actualizada',coalesce(old.moneda,'ARS')||' '||coalesce(old.precio_total,0)::text||' → '||coalesce(new.moneda,'ARS')||' '||coalesce(new.precio_total,0)::text,jsonb_build_object('before_total',old.precio_total,'after_total',new.precio_total,'before_rate',old.tarifa_noche,'after_rate',new.tarifa_noche,'before_currency',old.moneda,'after_currency',new.moneda),v_actor,v_name);
  end if;

  if new.nombre_huesped is distinct from old.nombre_huesped or new.email_huesped is distinct from old.email_huesped or new.telefono_huesped is distinct from old.telefono_huesped or new.dni_huesped is distinct from old.dni_huesped then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'guest','Datos del huésped actualizados',coalesce(new.nombre_huesped,'Huésped'),jsonb_build_object('before_name',old.nombre_huesped,'after_name',new.nombre_huesped,'before_email',old.email_huesped,'after_email',new.email_huesped,'before_phone',old.telefono_huesped,'after_phone',new.telefono_huesped,'before_document',old.dni_huesped,'after_document',new.dni_huesped),v_actor,v_name);
  end if;

  if new.servicios is distinct from old.servicios or new.mascotas is distinct from old.mascotas or new.cochera_total is distinct from old.cochera_total then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'articles','Artículos de la cuenta modificados','Alojamiento, extras, cochera o mascotas',jsonb_build_object('before_services',old.servicios,'after_services',new.servicios,'before_parking',old.cochera_total,'after_parking',new.cochera_total,'before_pets',old.mascotas,'after_pets',new.mascotas),v_actor,v_name);
  end if;

  return new;
end;
$function$;

create or replace function private.hl_log_reservation_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_row public.pagos%rowtype;
  v_actor uuid:=auth.uid();
  v_name text:=private.hl_event_actor_name();
  v_type text;
  v_title text;
begin
  v_row:=case when tg_op='DELETE' then old else new end;
  if v_row.reserva_id is null then return coalesce(new,old); end if;
  v_type:=case when tg_op='INSERT' then 'payment_added' when tg_op='DELETE' then 'payment_removed' else 'payment_changed' end;
  v_title:=case when tg_op='INSERT' then 'Pago añadido' when tg_op='DELETE' then 'Pago eliminado' else 'Pago modificado' end;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
  values(v_row.property_id,v_row.reserva_id,v_type,v_title,coalesce(v_row.metodo,'Pago')||' · '||coalesce(v_row.moneda,'ARS')||' '||coalesce(v_row.monto,0)::text,jsonb_build_object('payment_id',v_row.id,'amount',v_row.monto,'currency',v_row.moneda,'method',v_row.metodo,'note',v_row.nota),v_actor,v_name);
  return coalesce(new,old);
end;
$function$;

drop trigger if exists hl_reservation_history_trg on public.reservas;
create trigger hl_reservation_history_trg
after insert or update on public.reservas
for each row execute function private.hl_log_reservation_change();

drop trigger if exists hl_reservation_payment_history_trg on public.pagos;
create trigger hl_reservation_payment_history_trg
after insert or update or delete on public.pagos
for each row execute function private.hl_log_reservation_payment();

revoke all on function private.hl_event_actor_name() from public;
revoke all on function private.hl_log_reservation_change() from public;
revoke all on function private.hl_log_reservation_payment() from public;
