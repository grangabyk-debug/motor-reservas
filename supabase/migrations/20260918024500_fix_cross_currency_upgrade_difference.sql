create or replace function private.hl_room_change_pricing_quote(
  p_reserva_id bigint,
  p_from_room_id bigint,
  p_to_room_id bigint,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_res public.reservas%rowtype;
  v_detail jsonb;
  v_settings jsonb:='{}'::jsonb;
  v_pricing jsonb:='{}'::jsonb;
  v_taxes jsonb:='{}'::jsonb;
  v_property_currency text:='ARS';
  v_reservation_currency text:='ARS';
  v_tax_enabled boolean:=true;
  v_tax_rate numeric:=21;
  v_tax_mode text:='tax_included';
  v_nights integer;
  v_source_net numeric:=0;
  v_target_net numeric:=0;
  v_factor numeric:=1;
  v_source_local numeric:=0;
  v_target_local numeric:=0;
  v_local_delta numeric:=0;
  v_fx numeric:=1;
  v_fx_source text:='Misma moneda';
  v_delta_res numeric:=0;
  v_old_booked_rate numeric:=0;
  v_new_booked_rate numeric:=0;
begin
  select * into v_res from public.reservas where id=p_reserva_id;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if p_start is null or p_end is null or p_end<=p_start then
    raise exception using errcode='22023',message='El rango del cambio de habitación no es válido.';
  end if;
  v_nights:=p_end-p_start;

  select coalesce(settings,'{}'::jsonb) into v_settings
  from public.property_settings where property_id=v_res.property_id;
  v_pricing:=coalesce(v_settings->'pricing','{}'::jsonb);
  v_taxes:=coalesce(v_settings->'taxes','{}'::jsonb);

  v_property_currency:=upper(coalesce(nullif(v_pricing->>'rate_currency',''),
    (select nullif(operational_settings->>'currency','') from public.hotel_os_settings where property_id=v_res.property_id),
    'ARS'));
  v_reservation_currency:=upper(coalesce(nullif(v_res.moneda,''),'ARS'));
  v_tax_enabled:=coalesce(nullif(v_taxes->>'enabled','')::boolean,true);
  v_tax_rate:=greatest(0,coalesce(nullif(v_taxes->>'vat_rate','')::numeric,21));
  v_tax_mode:=coalesce(nullif(v_taxes->>'price_tax_mode',''),'tax_included');

  select e into v_detail
  from jsonb_array_elements(coalesce(v_res.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=p_from_room_id
  order by case when e->>'segment_role'='active_room' then 0 else 1 end
  limit 1;

  v_old_booked_rate:=greatest(0,coalesce(nullif(v_detail->>'tarifa_noche','')::numeric,v_res.tarifa_noche,0));

  select q.net_total into v_source_net
  from private.hl_calendar_room_pricing(v_res.property_id,p_from_room_id,p_start,p_end) q;
  select q.net_total into v_target_net
  from private.hl_calendar_room_pricing(v_res.property_id,p_to_room_id,p_start,p_end) q;

  v_factor:=case when v_tax_enabled and v_tax_mode='tax_included' then 1+v_tax_rate/100 else 1 end;
  v_source_local:=round(v_source_net*v_factor,2);
  v_target_local:=round(v_target_net*v_factor,2);
  v_local_delta:=round(v_target_local-v_source_local,2);

  if v_property_currency=v_reservation_currency then
    v_fx:=1;
    v_fx_source:='Misma moneda';
    v_delta_res:=v_local_delta;
  elsif (v_property_currency='ARS' and v_reservation_currency='USD')
     or (v_property_currency='USD' and v_reservation_currency='ARS') then
    select p.fx_rate,coalesce(nullif(p.fx_source,''),'Pago registrado')
      into v_fx,v_fx_source
    from public.pagos p
    where p.reserva_id=v_res.id
      and p.estado='confirmado'
      and coalesce(p.fx_rate,0)>0
    order by p.created_at desc
    limit 1;

    if coalesce(v_fx,0)<=0 then
      v_fx:=coalesce(
        nullif(v_pricing->>'manual_usd_ars','')::numeric,
        nullif(v_pricing->>'last_conversion_rate','')::numeric,
        0
      );
      v_fx_source:=coalesce(nullif(v_pricing->>'last_fx_source',''),'Configuración de tarifas');
    end if;
    if coalesce(v_fx,0)<=0 then
      raise exception using errcode='P0001',message='Falta una cotización USD/ARS válida para calcular la diferencia del upgrade.';
    end if;

    if v_property_currency='ARS' and v_reservation_currency='USD' then
      v_delta_res:=round(v_local_delta/v_fx,2);
    else
      v_delta_res:=round(v_local_delta*v_fx,2);
    end if;
  else
    raise exception using errcode='P0001',message=format('No se puede convertir automáticamente la diferencia de %s a %s.',v_property_currency,v_reservation_currency);
  end if;

  v_new_booked_rate:=round(v_old_booked_rate+(v_delta_res/v_nights),6);

  return jsonb_build_object(
    'nights',v_nights,
    'property_currency',v_property_currency,
    'reservation_currency',v_reservation_currency,
    'source_net_total',round(v_source_net,2),
    'target_net_total',round(v_target_net,2),
    'source_local_total',v_source_local,
    'target_local_total',v_target_local,
    'source_local_rate',round(v_source_local/v_nights,2),
    'target_local_rate',round(v_target_local/v_nights,2),
    'local_delta',v_local_delta,
    'fx_rate',v_fx,
    'fx_source',v_fx_source,
    'reservation_delta',v_delta_res,
    'current_booked_rate',v_old_booked_rate,
    'target_booked_rate',v_new_booked_rate,
    'tax_rate',v_tax_rate,
    'tax_mode',v_tax_mode
  );
end;
$function$;

create or replace function public.hl_quote_room_upgrade_atomic(
  p_reserva_id bigint,
  p_from_room_id bigint,
  p_to_room_id bigint,
  p_start date,
  p_end date
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare v_property uuid;
begin
  select property_id into v_property from public.reservas where id=p_reserva_id;
  if v_property is null then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_property,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para consultar este cambio.';
  end if;
  return private.hl_room_change_pricing_quote(p_reserva_id,p_from_room_id,p_to_room_id,p_start,p_end);
end;
$function$;

revoke all on function public.hl_quote_room_upgrade_atomic(bigint,bigint,bigint,date,date) from public;
grant execute on function public.hl_quote_room_upgrade_atomic(bigint,bigint,bigint,date,date) to authenticated;

do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text)'::regprocedure) into v_def;
  if position('v_pricing_quote jsonb;' in v_def)=0 then
    v_def:=replace(v_def,'  v_calendar_total numeric := 0;'||chr(10)||'  v_total_rate numeric := 0;',
      '  v_calendar_total numeric := 0;'||chr(10)||'  v_pricing_quote jsonb;'||chr(10)||'  v_total_rate numeric := 0;');
  end if;
  v_old:='  if coalesce(p_reprice,false) then'||chr(10)||
         '    select q.net_total,q.avg_rate into v_calendar_total,v_new_rate from private.hl_calendar_room_pricing(v_before.property_id,p_to_room_id,p_effective_date,v_end) q;'||chr(10)||
         '    v_rate_delta:=round(v_calendar_total-v_old_rate*v_remaining_nights,2);'||chr(10)||
         '  else';
  v_new:='  if coalesce(p_reprice,false) then'||chr(10)||
         '    v_pricing_quote:=private.hl_room_change_pricing_quote(v_before.id,p_from_room_id,p_to_room_id,p_effective_date,v_end);'||chr(10)||
         '    v_new_rate:=coalesce((v_pricing_quote->>''target_booked_rate'')::numeric,v_old_rate);'||chr(10)||
         '    v_rate_delta:=coalesce((v_pricing_quote->>''reservation_delta'')::numeric,0);'||chr(10)||
         '  else';
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;

  select pg_get_functiondef('public.hl_move_inhouse_group_room_segment_atomic(bigint,bigint,bigint,date,boolean)'::regprocedure) into v_def;
  if position('v_pricing_quote jsonb;' in v_def)=0 then
    v_def:=replace(v_def,'  v_calendar_total numeric := 0;'||chr(10)||'  v_total_rate numeric := 0;',
      '  v_calendar_total numeric := 0;'||chr(10)||'  v_pricing_quote jsonb;'||chr(10)||'  v_total_rate numeric := 0;');
  end if;
  v_old:='  if coalesce(p_reprice,false) then'||chr(10)||
         '    select q.net_total,q.avg_rate into v_calendar_total,v_new_rate from private.hl_calendar_room_pricing(v_before.property_id,p_to_room_id,p_effective_date,v_end) q;'||chr(10)||
         '    v_rate_delta:=round(v_calendar_total-v_old_rate*v_remaining_nights,2);'||chr(10)||
         '  else';
  v_new:='  if coalesce(p_reprice,false) then'||chr(10)||
         '    v_pricing_quote:=private.hl_room_change_pricing_quote(v_before.id,p_from_room_id,p_to_room_id,p_effective_date,v_end);'||chr(10)||
         '    v_new_rate:=coalesce((v_pricing_quote->>''target_booked_rate'')::numeric,v_old_rate);'||chr(10)||
         '    v_rate_delta:=coalesce((v_pricing_quote->>''reservation_delta'')::numeric,0);'||chr(10)||
         '  else';
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;

  select pg_get_functiondef('public.hl_change_group_reservation_room_atomic(bigint,bigint,bigint,boolean)'::regprocedure) into v_def;
  if position('v_pricing_quote jsonb;' in v_def)=0 then
    v_def:=replace(v_def,'  v_calendar_total numeric := 0;'||chr(10)||'  v_total_rate numeric := 0;',
      '  v_calendar_total numeric := 0;'||chr(10)||'  v_pricing_quote jsonb;'||chr(10)||'  v_total_rate numeric := 0;');
  end if;
  v_old:='  if coalesce(p_reprice,false) then'||chr(10)||
         '    select q.net_total,q.avg_rate into v_calendar_total,v_new_rate from private.hl_calendar_room_pricing(v_before.property_id,p_to_room_id,v_start,v_end) q;'||chr(10)||
         '    v_rate_delta:=round(v_calendar_total-v_old_rate*v_nights,2);'||chr(10)||
         '  else';
  v_new:='  if coalesce(p_reprice,false) then'||chr(10)||
         '    v_pricing_quote:=private.hl_room_change_pricing_quote(v_before.id,p_from_room_id,p_to_room_id,v_start,v_end);'||chr(10)||
         '    v_new_rate:=coalesce((v_pricing_quote->>''target_booked_rate'')::numeric,v_old_rate);'||chr(10)||
         '    v_rate_delta:=coalesce((v_pricing_quote->>''reservation_delta'')::numeric,0);'||chr(10)||
         '  else';
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;
end
$patch$;
