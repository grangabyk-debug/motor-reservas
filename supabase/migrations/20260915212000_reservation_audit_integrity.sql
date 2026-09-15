-- Reserva / auditoría: mantener el snapshot nocturno coherente en cambios y extensiones,
-- y contabilizar una penalidad de No Show cobrada como cargo real del folio.

create or replace function private.hl_refresh_reservation_nightly_rates_on_update()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  d jsonb;
  old_d jsonb;
  out_details jsonb := '[]'::jsonb;
  out_nightly jsonb;
  existing_entry jsonb;
  v_room_id bigint;
  v_old_room_id bigint;
  v_start date;
  v_end date;
  v_old_start date;
  v_old_end date;
  v_day date;
  v_rate numeric;
  v_base numeric;
  v_old_rate numeric;
  v_new_rate numeric;
  v_min numeric;
  v_max numeric;
  v_source text;
  v_category text;
  v_role text;
  v_manual boolean;
  v_force_full boolean;
  v_is_extension boolean;
  v_is_shorten boolean;
  v_ord bigint;
begin
  if new.habitaciones_detalle is null or jsonb_typeof(new.habitaciones_detalle) <> 'array' then
    return new;
  end if;

  for d,v_ord in select value, ordinality from jsonb_array_elements(new.habitaciones_detalle) with ordinality
  loop
    if coalesce(d->>'habitacion_id','') !~ '^\d+$' then
      out_details := out_details || jsonb_build_array(d);
      continue;
    end if;

    v_room_id := (d->>'habitacion_id')::bigint;
    v_start := coalesce(nullif(d->>'fecha_entrada','')::date,new.fecha_entrada);
    v_end := coalesce(nullif(d->>'fecha_salida','')::date,new.fecha_salida);
    if v_start is null or v_end is null or v_end<=v_start then
      out_details := out_details || jsonb_build_array(d);
      continue;
    end if;

    old_d := null;
    if old.habitaciones_detalle is not null and jsonb_typeof(old.habitaciones_detalle)='array' then
      select e into old_d
      from jsonb_array_elements(old.habitaciones_detalle) e
      where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=v_room_id
      limit 1;
      if old_d is null and coalesce(d->>'moved_from_room_id','')~'^\d+$' then
        select e into old_d
        from jsonb_array_elements(old.habitaciones_detalle) e
        where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=(d->>'moved_from_room_id')::bigint
        limit 1;
      end if;
      if old_d is null then
        select e into old_d
        from jsonb_array_elements(old.habitaciones_detalle) with ordinality t(e,ord)
        where ord=v_ord limit 1;
      end if;
    end if;

    v_old_room_id := case when old_d is not null and coalesce(old_d->>'habitacion_id','')~'^\d+$' then (old_d->>'habitacion_id')::bigint else v_room_id end;
    v_old_start := case when old_d is not null then coalesce(nullif(old_d->>'fecha_entrada','')::date,old.fecha_entrada) else v_start end;
    v_old_end := case when old_d is not null then coalesce(nullif(old_d->>'fecha_salida','')::date,old.fecha_salida) else v_end end;
    v_old_rate := greatest(0,coalesce(nullif(old_d->>'tarifa_noche','')::numeric,nullif(d->>'tarifa_noche','')::numeric,0));
    v_new_rate := greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,v_old_rate,0));
    v_source := coalesce(nullif(d->>'tarifa_fuente',''),nullif(old_d->>'tarifa_fuente',''),'calendar_room');
    v_category := nullif(trim(coalesce(d->>'tarifa_categoria',d->>'categoria_vendida',old_d->>'tarifa_categoria',old_d->>'categoria_vendida','')),'');
    v_role := lower(coalesce(d->>'segment_role','active_room'));
    v_manual := coalesce(nullif(d->>'tarifa_manual','')::boolean,false) or v_source='manual';
    v_is_extension := nullif(d->>'extension_from','') is not null and (old_d is null or d->>'extension_from' is distinct from old_d->>'extension_from');
    v_is_shorten := old_d is not null and v_end < v_old_end;

    v_force_full := false;
    if v_manual then
      v_force_full := true;
    elsif v_role in ('previous_room','cancelled_room') then
      v_force_full := false;
    elsif old_d is not null and v_room_id<>v_old_room_id and abs(v_new_rate-v_old_rate)>.005 then
      v_force_full := true;
    elsif old_d is not null and v_room_id=v_old_room_id and v_start=v_old_start and v_end=v_old_end and abs(v_new_rate-v_old_rate)>.005 then
      v_force_full := true;
    elsif old_d is not null and (v_start<>v_old_start or v_end<>v_old_end) and not v_is_extension and not v_is_shorten then
      v_force_full := true;
    end if;

    select h.precio into v_base from public.habitaciones h where h.id=v_room_id and h.property_id=new.property_id;
    out_nightly := '[]'::jsonb;

    for v_day in select gs::date from generate_series(v_start::timestamp,(v_end-1)::timestamp,interval '1 day') gs
    loop
      existing_entry := null;
      if not v_force_full and jsonb_typeof(d->'tarifas_por_noche')='array' then
        select e into existing_entry from jsonb_array_elements(d->'tarifas_por_noche') e where e->>'fecha'=v_day::text limit 1;
      end if;
      if existing_entry is not null then
        out_nightly := out_nightly || jsonb_build_array(existing_entry);
        continue;
      end if;

      v_rate := null;
      if v_manual or v_role in ('previous_room','cancelled_room') then
        v_rate := v_new_rate;
        out_nightly := out_nightly || jsonb_build_array(jsonb_build_object('fecha',v_day,'tarifa_neta',round(v_rate,6),'fuente',case when v_manual then 'manual' else 'snapshot_average_fallback' end));
        continue;
      end if;

      if v_source='calendar_sold_category' and v_category is not null then
        select min(c.price),max(c.price) into v_min,v_max
        from public.hotel_rate_calendar c
        join public.habitaciones h on h.id=c.habitacion_id and h.property_id=c.property_id
        where c.property_id=new.property_id and h.activa=true and h.tipo=v_category and c.stay_date=v_day;
        if v_min is not null and (v_max is null or abs(v_max-v_min)<=.005) then
          v_rate := v_min;
          out_nightly := out_nightly || jsonb_build_array(jsonb_build_object('fecha',v_day,'tarifa_neta',round(v_rate,6),'fuente','calendar_sold_category'));
        else
          v_rate := v_new_rate;
          out_nightly := out_nightly || jsonb_build_array(jsonb_build_object('fecha',v_day,'tarifa_neta',round(v_rate,6),'fuente','snapshot_average_fallback'));
        end if;
      else
        select c.price into v_rate from public.hotel_rate_calendar c where c.property_id=new.property_id and c.habitacion_id=v_room_id and c.stay_date=v_day;
        if v_rate is null then
          v_rate := greatest(0,coalesce(v_base,v_new_rate,0));
          out_nightly := out_nightly || jsonb_build_array(jsonb_build_object('fecha',v_day,'tarifa_neta',round(v_rate,6),'fuente','base_room_fallback'));
        else
          out_nightly := out_nightly || jsonb_build_array(jsonb_build_object('fecha',v_day,'tarifa_neta',round(v_rate,6),'fuente','calendar_room'));
        end if;
      end if;
    end loop;

    d := jsonb_set(d,'{tarifas_por_noche}',out_nightly,true);
    d := jsonb_set(d,'{tarifa_snapshot_at}',to_jsonb(current_timestamp::text),true);
    out_details := out_details || jsonb_build_array(d);
  end loop;

  new.habitaciones_detalle := out_details;
  return new;
end;
$$;

drop trigger if exists zy_hl_refresh_reservation_nightly_rates on public.reservas;
create trigger zy_hl_refresh_reservation_nightly_rates
before update of habitaciones_detalle, fecha_entrada, fecha_salida, tarifa_noche
on public.reservas
for each row execute function private.hl_refresh_reservation_nightly_rates_on_update();

create or replace function public.hl_mark_no_show_atomic(
  p_reserva_id bigint,
  p_release_date date default null::date,
  p_penalty_amount numeric default 0,
  p_penalty_status text default 'none'::text,
  p_note text default null::text
)
returns public.reservas
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v public.reservas%rowtype;
  v_release date;
  v_penalty numeric:=greatest(0,coalesce(p_penalty_amount,0));
  v_status text:=lower(coalesce(p_penalty_status,'none'));
  v_paid numeric:=0;
  v_guarantee public.hotel_guarantees%rowtype;
  v_has_guarantee boolean:=false;
  v_original_total numeric:=0;
  v_services jsonb:='[]'::jsonb;
  v_penalty_net numeric:=0;
  v_penalty_service jsonb;
  v_has_penalty_service boolean:=false;
  v_penalty_folio uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para marcar No Show.'; end if;
  if v.estado in ('cancelada','finalizada') or v.estado='alojado' then raise exception using errcode='P0001',message='La reserva no admite No Show en su estado actual.'; end if;
  if coalesce(v.no_show,false) then return v; end if;

  v_original_total:=coalesce(v.precio_total,0);
  v_release:=coalesce(p_release_date,current_date);
  if v_release<v.fecha_entrada then raise exception using errcode='P0001',message='No se puede marcar No Show antes de la fecha de llegada.'; end if;
  if v_release>v.fecha_salida then raise exception using errcode='P0001',message='La fecha de liberación no puede ser posterior a la salida original.'; end if;
  if v_status not in ('none','charged','waived') then raise exception using errcode='22023',message='Estado de penalidad inválido.'; end if;
  if v_penalty<=0 then v_status:='none'; end if;

  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid
  from public.pagos p
  where p.property_id=v.property_id and p.reserva_id=v.id
    and lower(coalesce(p.estado,'')) not in ('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');

  if v_penalty>0 and v_status='charged' and v_paid+0.01<v_penalty then
    raise exception using errcode='P0001',message='Primero registrá el cobro de la penalidad antes de marcar No Show.';
  end if;
  if v_penalty>0 and v_status='none' then
    raise exception using errcode='P0001',message='Indicá si la penalidad fue cobrada o eximida.';
  end if;

  select * into v_guarantee from public.hotel_guarantees g
  where g.property_id=v.property_id and g.reserva_id=v.id
  order by g.updated_at desc limit 1;
  v_has_guarantee:=found or nullif(v.garantia_tipo,'') is not null or nullif(v.garantia_ultimos4,'') is not null;

  insert into public.hotel_no_show_history(
    property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,original_noches,original_tarifa_noche,original_precio_total,currency,release_date,penalty_amount,penalty_status,had_guarantee,guarantee_id,note,snapshot,created_by
  ) values(
    v.property_id,v.id,'marked',v.fecha_entrada,v.fecha_salida,coalesce(v.noches,greatest(1,v.fecha_salida-v.fecha_entrada)),v.tarifa_noche,v_original_total,coalesce(v.moneda,'ARS'),v_release,v_penalty,v_status,v_has_guarantee,v_guarantee.id,nullif(trim(coalesce(p_note,'')),''),
    jsonb_build_object('numero_reserva',v.numero_reserva,'nombre_huesped',v.nombre_huesped,'habitacion_id',v.habitacion_id,'habitaciones_ids',v.habitaciones_ids,'canal_reserva',v.canal_reserva,'estado',v.estado,'paid_at_mark',v_paid),auth.uid()
  );

  v_services:=coalesce(v.servicios,'[]'::jsonb);
  if v_penalty>0 and v_status='charged' then
    v_penalty_net:=case when coalesce(v.impuestos_desglosados,false) and coalesce(v.iva_porcentaje,0)>0
      then round(v_penalty/(1+v.iva_porcentaje/100),6)
      else round(v_penalty,6) end;

    select f.id into v_penalty_folio
    from public.hotel_folios f
    where f.reservation_id=v.id and f.status<>'void'
    order by case when f.folio_type='master' then 0 when f.is_primary then 1 else 2 end,f.sort_order,f.created_at
    limit 1;

    v_penalty_service:=jsonb_strip_nulls(jsonb_build_object(
      'id','no-show-penalty-'||v.id::text,
      'categoria','fee',
      'nombre','Penalidad No Show',
      'detalle',coalesce(nullif(trim(coalesce(p_note,'')),''),'Penalidad aplicada al registrar No Show.'),
      'cantidad',1,
      'precio',v_penalty_net,
      'total',v_penalty_net,
      'total_final',round(v_penalty,2),
      'price_tax_mode',case when coalesce(v.impuestos_desglosados,false) then 'tax_included' else 'net' end,
      'precio_comercial',round(v_penalty,2),
      'folio_id',case when v_penalty_folio is not null then v_penalty_folio::text else null end,
      'no_show_penalty',true,
      'created_at',current_timestamp::text
    ));

    select exists(
      select 1 from jsonb_array_elements(v_services) s
      where s->>'id'='no-show-penalty-'||v.id::text or lower(trim(coalesce(s->>'nombre','')))='penalidad no show'
    ) into v_has_penalty_service;

    if v_has_penalty_service then
      select coalesce(jsonb_agg(
        case when s->>'id'='no-show-penalty-'||v.id::text or lower(trim(coalesce(s->>'nombre','')))='penalidad no show' then v_penalty_service else s end
        order by ord
      ),'[]'::jsonb) into v_services
      from jsonb_array_elements(v_services) with ordinality t(s,ord);
    else
      v_services:=v_services||jsonb_build_array(v_penalty_service);
    end if;
  end if;

  update public.reservas set
    no_show=true,
    no_show_at=now(),
    no_show_release_date=v_release,
    no_show_penalty_amount=v_penalty,
    no_show_penalty_status=v_status,
    no_show_note=nullif(trim(coalesce(p_note,'')),''),
    servicios=v_services
  where id=v.id returning * into v;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(v.property_id,v.id,'no_show','Reserva marcada No Show','El huésped no se presentó. La disponibilidad quedó liberada sin perder la estadía ni la tarifa original.',jsonb_build_object('original_start',v.fecha_entrada,'original_end',v.fecha_salida,'original_total',v_original_total,'original_rate',v.tarifa_noche,'release_date',v_release,'penalty_amount',v_penalty,'penalty_status',v_status,'had_guarantee',v_has_guarantee,'penalty_posted_to_folio',v_penalty>0 and v_status='charged'),auth.uid());

  return v;
end;
$$;
