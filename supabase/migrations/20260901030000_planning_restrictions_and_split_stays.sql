-- Habitación Llena · Planning restrictions + split stays

create table if not exists public.hotel_planning_restrictions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  action text not null check (action in (
    'min_stay','max_stay','stop_sell','open_sell',
    'closed_to_arrival','open_arrival','closed_to_departure','open_departure'
  )),
  nights integer,
  room_type text,
  room_ids bigint[] not null default '{}'::bigint[],
  channels text[] not null default '{}'::text[],
  weekdays smallint[] not null default array[0,1,2,3,4,5,6]::smallint[],
  note text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from),
  check (action not in ('min_stay','max_stay') or coalesce(nights,0) >= 1)
);

create index if not exists hotel_planning_restrictions_property_dates_idx
  on public.hotel_planning_restrictions(property_id,date_from,date_to,active);

alter table public.hotel_planning_restrictions enable row level security;
revoke all on public.hotel_planning_restrictions from anon;
grant select,insert,update,delete on public.hotel_planning_restrictions to authenticated;

drop policy if exists hotel_planning_restrictions_select_access on public.hotel_planning_restrictions;
create policy hotel_planning_restrictions_select_access
on public.hotel_planning_restrictions for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_planning_restrictions_insert_management on public.hotel_planning_restrictions;
create policy hotel_planning_restrictions_insert_management
on public.hotel_planning_restrictions for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','manager','revenue']::text[]));

drop policy if exists hotel_planning_restrictions_update_management on public.hotel_planning_restrictions;
create policy hotel_planning_restrictions_update_management
on public.hotel_planning_restrictions for update to authenticated
using (private.user_has_property_role(property_id,array['owner','manager','revenue']::text[]))
with check (private.user_has_property_role(property_id,array['owner','manager','revenue']::text[]));

drop policy if exists hotel_planning_restrictions_delete_management on public.hotel_planning_restrictions;
create policy hotel_planning_restrictions_delete_management
on public.hotel_planning_restrictions for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','manager','revenue']::text[]));

create or replace function public.hl_apply_planning_restriction_atomic(
  p_property_id uuid,
  p_date_from date,
  p_date_to date,
  p_action text,
  p_nights integer default null,
  p_room_type text default null,
  p_room_ids bigint[] default '{}'::bigint[],
  p_channels text[] default '{}'::text[],
  p_weekdays smallint[] default array[0,1,2,3,4,5,6]::smallint[],
  p_note text default null
)
returns uuid
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
declare
  v_id uuid := gen_random_uuid();
  v_action text := lower(trim(coalesce(p_action,'')));
  v_weekdays smallint[] := case when coalesce(cardinality(p_weekdays),0)=0 then array[0,1,2,3,4,5,6]::smallint[] else p_weekdays end;
  v_room record;
  v_day date;
begin
  if not private.user_has_property_role(p_property_id,array['owner','manager','revenue']::text[]) then
    raise exception using errcode='42501', message='No tenés permiso para modificar restricciones de venta.';
  end if;
  if p_date_from is null or p_date_to is null or p_date_to < p_date_from then
    raise exception using errcode='22023', message='Revisá el rango de fechas de la restricción.';
  end if;
  if v_action not in ('min_stay','max_stay','stop_sell','open_sell','closed_to_arrival','open_arrival','closed_to_departure','open_departure') then
    raise exception using errcode='22023', message='La acción de restricción no es válida.';
  end if;
  if v_action in ('min_stay','max_stay') and coalesce(p_nights,0) < 1 then
    raise exception using errcode='22023', message='Indicá una cantidad válida de noches.';
  end if;

  insert into public.hotel_planning_restrictions(
    id,property_id,date_from,date_to,action,nights,room_type,room_ids,channels,weekdays,note,created_by
  ) values (
    v_id,p_property_id,p_date_from,p_date_to,v_action,p_nights,nullif(trim(coalesce(p_room_type,'')),''),
    coalesce(p_room_ids,'{}'::bigint[]),coalesce(p_channels,'{}'::text[]),v_weekdays,nullif(trim(coalesce(p_note,'')),''),auth.uid()
  );

  -- Materialize the restrictions that the existing rate calendar understands.
  if v_action <> 'max_stay' then
    for v_room in
      select h.id,h.precio
      from public.habitaciones h
      where h.property_id=p_property_id
        and h.activa is distinct from false
        and (coalesce(cardinality(p_room_ids),0)=0 or h.id=any(p_room_ids))
        and (nullif(trim(coalesce(p_room_type,'')),'') is null or lower(coalesce(h.tipo,''))=lower(trim(p_room_type)))
    loop
      v_day := p_date_from;
      while v_day <= p_date_to loop
        if extract(dow from v_day)::smallint = any(v_weekdays) then
          insert into public.hotel_rate_calendar(
            property_id,habitacion_id,stay_date,price,min_stay,stop_sell,closed_to_arrival,closed_to_departure,updated_at
          ) values (
            p_property_id,v_room.id,v_day,coalesce(v_room.precio,0),
            case when v_action='min_stay' then greatest(1,p_nights) else 1 end,
            v_action='stop_sell',v_action='closed_to_arrival',v_action='closed_to_departure',now()
          )
          on conflict (property_id,habitacion_id,stay_date) do update set
            min_stay=case when v_action='min_stay' then greatest(1,p_nights) else public.hotel_rate_calendar.min_stay end,
            stop_sell=case when v_action='stop_sell' then true when v_action='open_sell' then false else public.hotel_rate_calendar.stop_sell end,
            closed_to_arrival=case when v_action='closed_to_arrival' then true when v_action='open_arrival' then false else public.hotel_rate_calendar.closed_to_arrival end,
            closed_to_departure=case when v_action='closed_to_departure' then true when v_action='open_departure' then false else public.hotel_rate_calendar.closed_to_departure end,
            updated_at=now();
        end if;
        v_day := v_day + 1;
      end loop;
    end loop;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.hl_apply_planning_restriction_atomic(uuid,date,date,text,integer,text,bigint[],text[],smallint[],text) from anon;
grant execute on function public.hl_apply_planning_restriction_atomic(uuid,date,date,text,integer,text,bigint[],text[],smallint[],text) to authenticated;

-- Sales restrictions are enforced on new reservations regardless of which app/API created them.
create or replace function private.hl_enforce_planning_restrictions()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
declare
  v_room_type text;
  v_nights integer;
  v_rule record;
  v_day date;
begin
  if new.property_id is null or new.habitacion_id is null or new.fecha_entrada is null or new.fecha_salida is null then return new; end if;
  if new.estado='cancelada' or coalesce(new.no_show,false) then return new; end if;
  select h.tipo into v_room_type from public.habitaciones h where h.id=new.habitacion_id and h.property_id=new.property_id;
  if not found then return new; end if;
  v_nights := greatest(1,new.fecha_salida-new.fecha_entrada);

  -- Latest stop/open decision wins for each sold night.
  v_day := new.fecha_entrada;
  while v_day < new.fecha_salida loop
    select r.* into v_rule
    from public.hotel_planning_restrictions r
    where r.property_id=new.property_id and r.active
      and v_day between r.date_from and r.date_to
      and extract(dow from v_day)::smallint=any(r.weekdays)
      and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
      and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
      and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
      and r.action in ('stop_sell','open_sell')
    order by r.created_at desc limit 1;
    if found and v_rule.action='stop_sell' then
      raise exception using errcode='23P01', message='La fecha seleccionada tiene Stop Sell activo para esa habitación/canal.';
    end if;
    v_day := v_day + 1;
  end loop;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_entrada between r.date_from and r.date_to
    and extract(dow from new.fecha_entrada)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action in ('closed_to_arrival','open_arrival')
  order by r.created_at desc limit 1;
  if found and v_rule.action='closed_to_arrival' then
    raise exception using errcode='23P01', message='La fecha seleccionada está cerrada a llegadas (CTA).';
  end if;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_salida between r.date_from and r.date_to
    and extract(dow from new.fecha_salida)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action in ('closed_to_departure','open_departure')
  order by r.created_at desc limit 1;
  if found and v_rule.action='closed_to_departure' then
    raise exception using errcode='23P01', message='La fecha seleccionada está cerrada a salidas (CTD).';
  end if;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_entrada between r.date_from and r.date_to
    and extract(dow from new.fecha_entrada)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action='min_stay'
  order by r.created_at desc limit 1;
  if found and v_nights < coalesce(v_rule.nights,1) then
    raise exception using errcode='23P01', message='La estadía no cumple la estancia mínima configurada.';
  end if;

  select r.* into v_rule
  from public.hotel_planning_restrictions r
  where r.property_id=new.property_id and r.active
    and new.fecha_entrada between r.date_from and r.date_to
    and extract(dow from new.fecha_entrada)::smallint=any(r.weekdays)
    and (coalesce(cardinality(r.room_ids),0)=0 or new.habitacion_id=any(r.room_ids))
    and (r.room_type is null or lower(r.room_type)=lower(coalesce(v_room_type,'')))
    and (coalesce(cardinality(r.channels),0)=0 or exists(select 1 from unnest(r.channels) c where lower(c)=lower(coalesce(new.canal_reserva,'Directa'))))
    and r.action='max_stay'
  order by r.created_at desc limit 1;
  if found and v_nights > coalesce(v_rule.nights,v_nights) then
    raise exception using errcode='23P01', message='La estadía supera la estancia máxima configurada.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hl_enforce_planning_restrictions on public.reservas;
create trigger trg_hl_enforce_planning_restrictions
before insert on public.reservas
for each row execute function private.hl_enforce_planning_restrictions();

-- Split stays keep one commercial chain while creating operational room segments.
alter table public.reservas add column if not exists stay_chain_id uuid;
alter table public.reservas add column if not exists stay_master_id bigint references public.reservas(id) on delete set null;
alter table public.reservas add column if not exists stay_segment_index integer;
create index if not exists reservas_stay_chain_idx on public.reservas(property_id,stay_chain_id,fecha_entrada,fecha_salida) where stay_chain_id is not null;

create or replace function public.hl_split_reservation_atomic(
  p_reserva_id bigint,
  p_split_date date,
  p_next_room_id bigint,
  p_reprice boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
declare
  v public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_child public.reservas%rowtype;
  v_chain uuid;
  v_master bigint;
  v_next_index integer;
  v_total_nights integer;
  v_first_nights integer;
  v_second_nights integer;
  v_old_rate numeric;
  v_new_rate numeric;
  v_non_room_subtotal numeric;
  v_non_room_total numeric;
  v_parent_subtotal numeric;
  v_child_subtotal numeric;
  v_parent_total numeric;
  v_child_total numeric;
  v_target_start timestamp;
  v_target_end timestamp;
begin
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002', message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','manager','reception']::text[]) then
    raise exception using errcode='42501', message='No tenés permiso para dividir esta estadía.';
  end if;
  if v.estado='cancelada' or coalesce(v.no_show,false) then raise exception using errcode='22023', message='No se puede dividir una reserva cancelada o No Show.'; end if;
  if coalesce(v.tipo_estadia,'overnight')='day_use' then raise exception using errcode='22023', message='Las estadías Day Use no se dividen por noche.'; end if;
  if p_split_date is null or p_split_date<=v.fecha_entrada or p_split_date>=v.fecha_salida then
    raise exception using errcode='22023', message='La fecha de división debe quedar dentro de la estadía.';
  end if;

  select * into v_room from public.habitaciones
  where id=p_next_room_id and property_id=v.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002', message='La habitación destino no existe o está inactiva.'; end if;
  if lower(coalesce(v_room.estado,'')) in ('mantenimiento','fuera_servicio') then raise exception using errcode='23P01', message='La habitación destino está fuera de servicio.'; end if;

  v_target_start:=p_split_date::timestamp+private.hl_safe_time(v.hora_llegada_estimada,'14:00'::time);
  v_target_end:=v.fecha_salida::timestamp+private.hl_safe_time(v.hora_salida_estimada,'10:00'::time);

  if exists(
    select 1 from public.bloqueos b
    where b.property_id=v.property_id and b.habitacion_id=p_next_room_id
      and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)') && tsrange(v_target_start,v_target_end,'[)')
  ) then raise exception using errcode='23P01', message='La habitación destino tiene un bloqueo durante el segundo tramo.'; end if;

  if exists(
    select 1 from public.reservas r
    where r.property_id=v.property_id and r.id<>v.id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false
      and p_next_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])
      and tsrange(coalesce(r.ocupacion_desde_local,r.fecha_entrada::timestamp+private.hl_safe_time(r.hora_llegada_estimada,'14:00'::time)),coalesce(r.ocupacion_hasta_local,r.fecha_salida::timestamp+private.hl_safe_time(r.hora_salida_estimada,'10:00'::time)),'[)') && tsrange(v_target_start,v_target_end,'[)')
  ) then raise exception using errcode='23P01', message='La habitación destino ya está ocupada durante parte del segundo tramo.'; end if;

  v_total_nights:=greatest(1,v.fecha_salida-v.fecha_entrada);
  v_first_nights:=greatest(1,p_split_date-v.fecha_entrada);
  v_second_nights:=greatest(1,v.fecha_salida-p_split_date);
  v_old_rate:=greatest(0,coalesce(v.tarifa_noche,0));
  v_new_rate:=case when p_reprice then greatest(0,coalesce(v_room.precio,0)) else v_old_rate end;
  v_non_room_subtotal:=coalesce(v.subtotal,v.precio_total,0)-(v_old_rate*v_total_nights);
  v_non_room_total:=coalesce(v.precio_total,0)-(v_old_rate*v_total_nights);
  v_parent_subtotal:=greatest(0,v_old_rate*v_first_nights+v_non_room_subtotal);
  v_child_subtotal:=greatest(0,v_new_rate*v_second_nights);
  v_parent_total:=greatest(0,v_old_rate*v_first_nights+v_non_room_total);
  v_child_total:=greatest(0,v_new_rate*v_second_nights);

  v_chain:=coalesce(v.stay_chain_id,gen_random_uuid());
  v_master:=coalesce(v.stay_master_id,v.id);
  select coalesce(max(r.stay_segment_index),0)+1 into v_next_index
  from public.reservas r where r.property_id=v.property_id and r.stay_chain_id=v_chain;
  v_next_index:=greatest(2,v_next_index);

  update public.reservas set
    fecha_salida=p_split_date,
    noches=v_first_nights,
    subtotal=v_parent_subtotal,
    precio_total=v_parent_total,
    precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_parent_total/tipo_cambio,2) else precio_total_usd end,
    ocupacion_hasta_local=p_split_date::timestamp+private.hl_safe_time(v.hora_salida_estimada,'10:00'::time),
    stay_chain_id=v_chain,
    stay_master_id=v_master,
    stay_segment_index=coalesce(v.stay_segment_index,1)
  where id=v.id;

  insert into public.reservas(
    property_id,user_id,alojamiento_id,habitacion_id,habitaciones_ids,
    nombre_huesped,email_huesped,telefono_huesped,dni_huesped,direccion_huesped,provincia_estado_huesped,pais_huesped,
    fecha_entrada,fecha_salida,cantidad_huespedes,estado,notas,tarifa_noche,noches,precio_total,subtotal,moneda,tipo_cambio,precio_total_usd,
    vehiculos,tipo_vehiculo,dominio_vehiculo,cochera_total,extra,mascotas,mascotas_total,servicios,pasajeros,
    canal_reserva,codigo_canal,medio_pago_preferido,partner_id,group_id,guest_profile_id,
    garantia_tipo,garantia_marca,garantia_ultimos4,garantia_vencimiento,garantia_referencia,
    hora_llegada_estimada,hora_salida_estimada,tipo_estadia,ocupacion_desde_local,ocupacion_hasta_local,fecha_operativa,
    stay_chain_id,stay_master_id,stay_segment_index,no_show
  ) values (
    v.property_id,v.user_id,coalesce(v_room.alojamiento_id,v.alojamiento_id),v_room.id,array[v_room.id],
    v.nombre_huesped,v.email_huesped,v.telefono_huesped,v.dni_huesped,v.direccion_huesped,v.provincia_estado_huesped,v.pais_huesped,
    p_split_date,v.fecha_salida,v.cantidad_huespedes,'confirmada',v.notas,v_new_rate,v_second_nights,v_child_total,v_child_subtotal,v.moneda,v.tipo_cambio,
    case when coalesce(v.tipo_cambio,0)>0 then round(v_child_total/v.tipo_cambio,2) else null end,
    v.vehiculos,v.tipo_vehiculo,v.dominio_vehiculo,0,0,v.mascotas,0,'[]'::jsonb,v.pasajeros,
    v.canal_reserva,null,v.medio_pago_preferido,v.partner_id,v.group_id,v.guest_profile_id,
    v.garantia_tipo,v.garantia_marca,v.garantia_ultimos4,v.garantia_vencimiento,v.garantia_referencia,
    v.hora_llegada_estimada,v.hora_salida_estimada,'overnight',v_target_start,v_target_end,p_split_date,
    v_chain,v_master,v_next_index,false
  ) returning * into v_child;

  return jsonb_build_object(
    'chain_id',v_chain,
    'master_id',v_master,
    'first_segment_id',v.id,
    'second_segment_id',v_child.id,
    'split_date',p_split_date,
    'next_room_id',p_next_room_id,
    'reprice',p_reprice
  );
end;
$$;

revoke execute on function public.hl_split_reservation_atomic(bigint,date,bigint,boolean) from anon;
grant execute on function public.hl_split_reservation_atomic(bigint,date,bigint,boolean) to authenticated;
