CREATE OR REPLACE FUNCTION public.hl_set_group_room_special_stay_atomic(p_reserva_id bigint, p_room_id bigint, p_kind text, p_enabled boolean)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  r public.reservas%rowtype;
  h public.habitaciones%rowtype;
  ids bigint[];
  rid bigint;
  kind text:=lower(trim(coalesce(p_kind,'')));
  prefs jsonb:='{}'::jsonb;
  pct numeric;
  tm time;
  details jsonb;
  services jsonb;
  checkout jsonb;
  d jsonb;
  nd jsonb;
  desired boolean;
  rate numeric;
  amount numeric;
  room_start date;
  room_end date;
  room_name text;
  old_services numeric:=0;
  new_services numeric:=0;
  old_global numeric:=0;
  current_net numeric:=0;
  next_net numeric:=0;
  vat_rate numeric:=0;
  next_vat numeric:=0;
  next_total numeric:=0;
  states jsonb:='[]'::jsonb;
  exists_detail boolean;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  if kind not in ('early','late') then raise exception using errcode='22023',message='Horario especial inválido.'; end if;

  select * into r from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(r.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para configurar early/late.';
  end if;
  if r.estado in('cancelada','fusionada','finalizada') or coalesce(r.no_show,false) then
    raise exception using errcode='22023',message='Los horarios especiales sólo se pueden editar en una estadía activa.';
  end if;

  details:=case when jsonb_typeof(r.habitaciones_detalle)='array' then r.habitaciones_detalle else '[]'::jsonb end;
  checkout:=coalesce(r.room_checkout_dates,'{}'::jsonb);

  select coalesce(array_agg(distinct x order by x),array[]::bigint[]) into ids
  from unnest(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id]) x
  where x is not null
    and not (coalesce(checkout->>x::text,'')~'^\d{4}-\d{2}-\d{2}$')
    and not exists(
      select 1 from jsonb_array_elements(details) e
      where coalesce(e->>'habitacion_id','')~'^\d+$'
        and (e->>'habitacion_id')::bigint=x
        and lower(coalesce(e->>'segment_role','active_room')) in('previous_room','transient_room','cancelled_room','no_show_room')
    );

  if cardinality(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])<=1 then
    raise exception using errcode='22023',message='Este flujo es para reservas grupales.';
  end if;
  if not p_room_id=any(ids) then
    raise exception using errcode='22023',message='La habitación elegida ya no está activa dentro del grupo.';
  end if;

  select coalesce(settings->'preferences','{}'::jsonb) into prefs
  from public.property_settings where property_id=r.property_id;
  prefs:=coalesce(prefs,'{}'::jsonb);
  if kind='early' then
    pct:=greatest(0,least(100,coalesce(nullif(prefs->>'early_checkin_percent','')::numeric,35)));
    tm:=private.hl_safe_time(prefs->>'early_checkin_time','08:00'::time);
    old_global:=greatest(0,coalesce(r.early_checkin_importe,0));
  else
    pct:=greatest(0,least(100,coalesce(nullif(prefs->>'late_checkout_percent','')::numeric,35)));
    tm:=private.hl_safe_time(prefs->>'late_checkout_time','18:00'::time);
    old_global:=greatest(0,coalesce(r.late_checkout_importe,0));
  end if;

  -- Quita sólo servicios del tipo que estamos normalizando en habitaciones activas.
  select coalesce(jsonb_agg(svc order by ord),'[]'::jsonb) into services
  from jsonb_array_elements(coalesce(r.servicios,'[]'::jsonb)) with ordinality x(svc,ord)
  where not(
    coalesce(svc->>'room_id',svc->>'habitacion_id','')~'^\d+$'
    and coalesce(svc->>'room_id',svc->>'habitacion_id')::bigint=any(ids)
    and (
      lower(coalesce(svc->>'special_stay',''))=kind
      or coalesce(svc->>'id','') like kind||'-room-%'
      or (kind='early' and svc ? 'early_checkin_time')
      or (kind='late' and svc ? 'late_checkout_time')
    )
  );

  foreach rid in array ids loop
    select * into h from public.habitaciones where id=rid and property_id=r.property_id;
    if h.id is null then raise exception using errcode='22023',message='No se pudo resolver una habitación del grupo.'; end if;

    select e into d from jsonb_array_elements(details) e
    where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=rid limit 1;
    exists_detail:=d is not null;
    d:=coalesce(d,jsonb_build_object(
      'habitacion_id',rid,'nombre',coalesce(h.nombre,rid::text),
      'categoria_asignada',coalesce(h.tipo,'Habitación'),
      'categoria_vendida',coalesce(h.tipo,'Habitación'),
      'fecha_entrada',r.fecha_entrada,'fecha_salida',r.fecha_salida,'segment_role','active_room'
    ));

    room_start:=public.hl_reservation_room_start_date(r.habitaciones_detalle,rid,r.fecha_entrada);
    room_end:=public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,rid,r.fecha_salida);
    room_name:=coalesce(h.nombre,rid::text);

    desired:=case
      when rid=p_room_id then coalesce(p_enabled,false)
      when kind='early' then public.hl_reservation_room_early_checkin(r.habitaciones_detalle,rid,room_start,r.fecha_entrada,r.early_checkin)
      else public.hl_reservation_room_late_checkout(r.habitaciones_detalle,r.room_checkout_dates,rid,room_end,r.fecha_salida,r.late_checkout)
    end;

    select coalesce(
      (select coalesce(nullif(n->>'tarifa_neta','')::numeric,nullif(n->>'price','')::numeric,nullif(n->>'tarifa','')::numeric)
       from jsonb_array_elements(case when jsonb_typeof(d->'tarifas_por_noche')='array' then d->'tarifas_por_noche' else '[]'::jsonb end) n
       where coalesce(n->>'fecha',n->>'stay_date','')<>''
       order by coalesce(n->>'fecha',n->>'stay_date') || case when kind='late' then '' else '' end
       limit 1),
      nullif(d->>'tarifa_noche','')::numeric,
      (select nullif(i.unit_price,0) from public.hotel_folio_items i where i.reservation_id=r.id and i.room_id=rid and i.source_type='lodging' and i.status='active' order by i.created_at desc limit 1),
      nullif(h.precio,0),0
    ) into rate;

    -- Para late usamos la última noche del snapshot.
    if kind='late' and jsonb_typeof(d->'tarifas_por_noche')='array' then
      select coalesce(nullif(n->>'tarifa_neta','')::numeric,nullif(n->>'price','')::numeric,nullif(n->>'tarifa','')::numeric,rate)
      into rate
      from jsonb_array_elements(d->'tarifas_por_noche') n
      where coalesce(n->>'fecha',n->>'stay_date','')<>''
      order by coalesce(n->>'fecha',n->>'stay_date') desc limit 1;
    end if;

    if desired and coalesce(rate,0)<=0 then
      raise exception using errcode='22023',message=format('No se pudo resolver la tarifa de la habitación %s.',room_name);
    end if;
    amount:=case when desired then round(rate*pct/100,2) else 0 end;

    if kind='early' then
      nd:=(d-'early_checkin_time'-'early_checkin_net'-'early_checkin_percent')||
         jsonb_build_object('early_checkin_requested',desired);
      if desired then
        nd:=nd||jsonb_build_object('early_checkin_time',to_char(tm,'HH24:MI'),'early_checkin_net',amount,'early_checkin_percent',pct);
      end if;
    else
      nd:=(d-'late_checkout_time'-'late_checkout_net'-'late_checkout_percent')||
         jsonb_build_object('late_checkout_requested',desired);
      if desired then
        nd:=nd||jsonb_build_object('late_checkout_time',to_char(tm,'HH24:MI'),'late_checkout_net',amount,'late_checkout_percent',pct);
        checkout:=jsonb_set(checkout,array['late:'||rid::text],to_jsonb((room_end+1)::text),true);
      else
        checkout:=checkout-('late:'||rid::text);
      end if;
    end if;

    if exists_detail then
      select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=rid then nd else e end order by ord),'[]'::jsonb)
      into details from jsonb_array_elements(details) with ordinality x(e,ord);
    else
      details:=details||jsonb_build_array(nd);
    end if;

    if desired then
      services:=services||jsonb_build_array(jsonb_build_object(
        'id',kind||'-room-'||rid::text,'categoria','service','special_stay',kind,
        'nombre',case when kind='early' then 'Early check-in · Habitación ' else 'Late check-out · Habitación ' end||room_name,
        'detalle',case when kind='early' then 'Early check-in desde ' else 'Late check-out hasta ' end||to_char(tm,'HH24:MI')||' · '||trim(to_char(pct,'FM999990.##'))||'% de la tarifa',
        'cantidad',1,'precio',amount,'total',amount,'room_id',rid,'habitacion_id',rid,
        case when kind='early' then 'early_checkin_time' else 'late_checkout_time' end,to_char(tm,'HH24:MI'),
        case when kind='early' then 'early_checkin_percent' else 'late_checkout_percent' end,pct,
        'created_at',now()
      ));
    end if;

    states:=states||jsonb_build_array(jsonb_build_object(
      'room_id',rid,'room_name',room_name,'enabled',desired,'net_amount',amount,
      'percent',pct,'time',to_char(tm,'HH24:MI'),'rate_net',rate
    ));
  end loop;

  old_services:=private.hl_services_base_total(r.servicios);
  new_services:=private.hl_services_base_total(services);
  current_net:=greatest(0,coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,
    case when coalesce(r.impuestos_desglosados,false) then coalesce(r.precio_total,0)-coalesce(r.iva_importe,0) else r.precio_total end,0));
  next_net:=greatest(0,round(current_net-old_global+(new_services-old_services),2));
  vat_rate:=case when coalesce(r.impuestos_desglosados,false) then greatest(0,coalesce(r.iva_porcentaje,0)) else 0 end;
  next_vat:=round(next_net*vat_rate/100,2);
  next_total:=round(next_net+next_vat,2);

  if kind='early' then
    update public.reservas set habitaciones_detalle=details,servicios=services,room_checkout_dates=checkout,
      early_checkin=false,early_checkin_importe=0,
      subtotal=next_net,precio_sin_impuestos_nacionales=next_net,iva_importe=next_vat,precio_total=next_total
    where id=r.id returning * into r;
  else
    update public.reservas set habitaciones_detalle=details,servicios=services,room_checkout_dates=checkout,
      late_checkout=false,late_checkout_importe=0,
      subtotal=next_net,precio_sin_impuestos_nacionales=next_net,iva_importe=next_vat,precio_total=next_total
    where id=r.id returning * into r;
  end if;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(r.property_id,r.id,'group_room_special_stay',
    case when kind='early' then 'Early check-in por habitación' else 'Late check-out por habitación' end,
    format('Hab. %s · %s · %s%% · %s',coalesce((select nombre from public.habitaciones where id=p_room_id),p_room_id::text),
      case when p_enabled then 'aplicado' else 'quitado' end,pct,to_char(tm,'HH24:MI')),
    jsonb_build_object('kind',kind,'room_id',p_room_id,'enabled',p_enabled,'states',states,'price_total',r.precio_total,'currency',r.moneda),
    auth.uid());

  return r;
end
$function$


revoke all on function public.hl_set_group_room_special_stay_atomic(bigint,bigint,text,boolean) from public,anon;
grant execute on function public.hl_set_group_room_special_stay_atomic(bigint,bigint,text,boolean) to authenticated,service_role;
