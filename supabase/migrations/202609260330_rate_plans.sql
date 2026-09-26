begin;

create or replace function public.hl_change_rate_currency_with_plans(
  p_property_id uuid,
  p_target_currency text,
  p_usd_ars_rate numeric,
  p_rate_plans jsonb,
  p_fx_source text default 'BCRA',
  p_fx_as_of date default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_pricing jsonb;
begin
  v_pricing:=public.hl_change_rate_currency(p_property_id,p_target_currency,p_usd_ars_rate,p_fx_source,p_fx_as_of);
  update public.property_settings
     set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{rate_plans}',coalesce(p_rate_plans,'{}'::jsonb),true),
         updated_at=now(),
         updated_by=auth.uid()
   where property_id=p_property_id;
  return v_pricing;
end;
$$;

create or replace function public.hl_add_room_to_reservation_with_plan_atomic(
  p_reservation_id bigint,
  p_room jsonb
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  r public.reservas%rowtype;
  v_room_id bigint;
  v_guests integer;
  v_nights integer;
  v_booked_pp numeric;
  v_base_rate numeric;
  v_new_rate numeric;
  v_delta numeric;
  v_details jsonb;
  v_plan_count integer;
  v_detail_count integer;
  v_regimen text;
  v_next_net numeric;
  v_vat numeric;
begin
  r:=public.hl_add_room_to_reservation_atomic(p_reservation_id,p_room);
  v_room_id:=nullif(p_room->>'roomId','')::bigint;
  if coalesce(nullif(p_room->>'ratePlanCode',''),'')='' then return r; end if;

  v_guests:=greatest(1,coalesce(nullif(p_room->>'guests','')::integer,1));
  v_nights:=greatest(1,coalesce(nullif(p_room->>'end','')::date-nullif(p_room->>'start','')::date,1));
  v_booked_pp:=coalesce(nullif(p_room->>'ratePlanAdjustmentBookedPerPerson','')::numeric,0);

  select coalesce(nullif(e->>'tarifa_noche','')::numeric,0)
    into v_base_rate
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=v_room_id
  order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
  limit 1;

  v_new_rate:=greatest(0,coalesce(v_base_rate,0)+v_booked_pp*v_guests);
  v_delta:=round((v_new_rate-coalesce(v_base_rate,0))*v_nights,2);

  select coalesce(jsonb_agg(
    case when coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=v_room_id
      then e||jsonb_build_object(
        'tarifa_base_noche',coalesce(v_base_rate,0),
        'tarifa_noche',v_new_rate,
        'rate_plan_code',p_room->>'ratePlanCode',
        'rate_plan_name',p_room->>'ratePlanName',
        'rate_plan_meal',p_room->>'ratePlanMeal',
        'rate_plan_regimen',p_room->>'ratePlanRegimen',
        'rate_plan_adjustment_currency',p_room->>'ratePlanCurrency',
        'rate_plan_adjustment_configured_per_person',coalesce(nullif(p_room->>'ratePlanAdjustmentConfiguredPerPerson','')::numeric,0),
        'rate_plan_adjustment_booked_per_person',
          case when v_guests=0 then 0 else (v_new_rate-coalesce(v_base_rate,0))/v_guests end,
        'rate_plan_adjustment_final_per_person',coalesce(nullif(p_room->>'ratePlanAdjustmentFinalPerPerson','')::numeric,0),
        'rate_plan_booked_guests',v_guests,
        'rate_plan_snapshot',jsonb_build_object('code',p_room->>'ratePlanCode','name',p_room->>'ratePlanName','meal_plan',p_room->>'ratePlanMeal','adjustment_per_person',coalesce(nullif(p_room->>'ratePlanAdjustmentConfiguredPerPerson','')::numeric,0),'booked_guests',v_guests,'captured_at',now()),
        'rate_plan_snapshot_at',now()
      )
      else e end order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(e,ord);

  select count(*),count(*) filter(where coalesce(e->>'rate_plan_code','')<>'')
    into v_detail_count,v_plan_count
  from jsonb_array_elements(v_details) e
  where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');

  if v_detail_count>0 and v_plan_count=v_detail_count then
    select case when count(distinct e->>'rate_plan_regimen')=1 then max(e->>'rate_plan_regimen') else 'Mixto' end
      into v_regimen
    from jsonb_array_elements(v_details) e
    where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');
  else
    v_regimen:=r.regimen;
  end if;

  v_next_net:=greatest(0,round(coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,r.precio_total,0)+v_delta,2));
  v_vat:=case when coalesce(r.impuestos_desglosados,false) then round(v_next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;

  update public.reservas
     set habitaciones_detalle=v_details,
         tarifa_noche=greatest(0,coalesce(r.tarifa_noche,0)+(v_new_rate-coalesce(v_base_rate,0))),
         subtotal=greatest(0,round(coalesce(r.subtotal,0)+v_delta,2)),
         precio_sin_impuestos_nacionales=v_next_net,
         iva_importe=v_vat,
         precio_total=round(v_next_net+v_vat,2),
         precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round((v_next_net+v_vat)/tipo_cambio,2) else precio_total_usd end,
         regimen=v_regimen
   where id=r.id
   returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

create or replace function public.hl_extend_group_rooms_with_plan_atomic(
  p_reserva_id bigint,
  p_room_ids bigint[],
  p_new_end date
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype;
  r public.reservas%rowtype;
  rid bigint;
  before_detail jsonb;
  after_detail jsonb;
  details jsonb;
  old_end date;
  start_date date;
  guests integer;
  booked_pp numeric;
  extra_nights integer;
  total_nights integer;
  base_extension numeric;
  raw_delta numeric;
  delta numeric;
  total_delta numeric:=0;
  new_rate numeric;
  next_net numeric;
  next_vat numeric;
  total_rate numeric;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

  r:=public.hl_extend_group_rooms_atomic(p_reserva_id,p_room_ids,p_new_end);
  details:=coalesce(r.habitaciones_detalle,'[]'::jsonb);

  foreach rid in array coalesce(p_room_ids,array[]::bigint[]) loop
    select e into before_detail
    from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
      and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
    limit 1;

    booked_pp:=coalesce(nullif(before_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0);
    if booked_pp=0 then continue; end if;

    old_end:=coalesce(nullif(before_detail->>'fecha_salida','')::date,before_row.fecha_salida);
    start_date:=coalesce(nullif(before_detail->>'fecha_entrada','')::date,before_row.fecha_entrada);
    guests:=greatest(0,coalesce(nullif(before_detail->>'huespedes','')::integer,0));
    extra_nights:=greatest(0,p_new_end-old_end);
    total_nights:=greatest(1,p_new_end-start_date);
    if extra_nights=0 or guests=0 then continue; end if;

    select e into after_detail
    from jsonb_array_elements(details) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
      and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
    limit 1;

    base_extension:=greatest(0,coalesce(nullif(after_detail->>'extension_net_total','')::numeric,0));
    raw_delta:=booked_pp*guests*extra_nights;
    delta:=greatest(-base_extension,raw_delta);
    new_rate:=greatest(0,coalesce(nullif(after_detail->>'tarifa_noche','')::numeric,0)+delta/total_nights);

    select coalesce(jsonb_agg(
      case when coalesce(e->>'habitacion_id','')~'^[0-9]+$'
             and (e->>'habitacion_id')::bigint=rid
             and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
        then e||jsonb_build_object(
          'tarifa_noche',new_rate,
          'extension_net_total',round(base_extension+delta,2),
          'rate_plan_extension_net_total',round(delta,2)
        )
        else e end order by ord
    ),'[]'::jsonb)
    into details
    from jsonb_array_elements(details) with ordinality x(e,ord);

    total_delta:=total_delta+delta;
  end loop;

  if abs(total_delta)<0.000001 then return r; end if;

  select coalesce(sum(greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0))),0)
    into total_rate
  from jsonb_array_elements(details) e
  where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    and not (coalesce(r.room_checkout_dates,'{}'::jsonb) ? coalesce(e->>'habitacion_id',''));

  next_net:=greatest(0,round(coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,r.precio_total,0)+total_delta,2));
  next_vat:=case when coalesce(r.impuestos_desglosados,false) then round(next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;

  update public.reservas
     set habitaciones_detalle=details,
         tarifa_noche=total_rate,
         subtotal=greatest(0,round(coalesce(r.subtotal,0)+total_delta,2)),
         precio_sin_impuestos_nacionales=next_net,
         iva_importe=next_vat,
         precio_total=round(next_net+next_vat,2),
         precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round((next_net+next_vat)/tipo_cambio,2) else precio_total_usd end
   where id=r.id
   returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

create or replace function public.hl_planning_move_reservation_with_plan_atomic(
  p_reserva_id bigint,
  p_habitacion_id bigint,
  p_fecha_entrada date,
  p_fecha_salida date default null,
  p_reprice boolean default false
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype;
  r public.reservas%rowtype;
  source_detail jsonb;
  plan_code text;
  booked_pp numeric:=0;
  guests integer:=0;
  units integer:=1;
  base_rate numeric:=0;
  new_rate numeric:=0;
  plan_delta numeric:=0;
  next_subtotal numeric:=0;
  next_discount numeric:=0;
  next_net numeric:=0;
  next_vat numeric:=0;
  next_total numeric:=0;
  details jsonb;
  should_reprice boolean:=false;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

  select e into source_detail
  from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=before_row.habitacion_id
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
  order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
  limit 1;

  plan_code:=nullif(source_detail->>'rate_plan_code','');
  booked_pp:=coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0);
  guests:=greatest(0,coalesce(nullif(source_detail->>'huespedes','')::integer,before_row.cantidad_huespedes,0));
  should_reprice:=coalesce(p_reprice,false)
    or p_fecha_entrada is distinct from before_row.fecha_entrada
    or p_fecha_salida is distinct from before_row.fecha_salida;

  r:=public.hl_planning_move_reservation_priced_atomic(
    p_reserva_id,p_habitacion_id,p_fecha_entrada,p_fecha_salida,p_reprice
  );

  if plan_code is null or not should_reprice then return r; end if;

  units:=case when coalesce(r.tipo_estadia,'overnight')='day_use' then 1 else greatest(1,coalesce(r.noches,p_fecha_salida-p_fecha_entrada,1)) end;
  base_rate:=greatest(0,coalesce(r.tarifa_noche,0));
  new_rate:=greatest(0,base_rate+booked_pp*guests);
  plan_delta:=round((new_rate-base_rate)*units,2);
  next_subtotal:=greatest(0,round(coalesce(r.subtotal,0)+plan_delta,2));

  if lower(coalesce(r.descuento_tipo,'')) in('percent','porcentaje','percentage') then
    next_discount:=round(next_subtotal*least(100,greatest(0,coalesce(r.descuento_valor,0)))/100,2);
  elsif lower(coalesce(r.descuento_tipo,'')) in('amount','importe','fixed','fijo') then
    next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_valor,r.descuento_importe,0)));
  else
    next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_importe,0)));
  end if;

  next_net:=round(greatest(0,next_subtotal-next_discount),2);
  next_vat:=case when coalesce(r.impuestos_desglosados,false) then round(next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  next_total:=round(next_net+next_vat,2);

  select coalesce(jsonb_agg(
    case when coalesce(e->>'habitacion_id','')~'^[0-9]+$'
           and (e->>'habitacion_id')::bigint=p_habitacion_id
           and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
      then e||jsonb_build_object(
        'tarifa_base_noche',base_rate,
        'tarifa_noche',new_rate,
        'rate_plan_adjustment_booked_per_person',
          case when guests=0 then booked_pp else (new_rate-base_rate)/guests end
      )
      else e end order by ord
  ),'[]'::jsonb)
  into details
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(e,ord);

  update public.reservas
     set habitaciones_detalle=details,
         tarifa_noche=new_rate,
         subtotal=next_subtotal,
         descuento_importe=next_discount,
         precio_sin_impuestos_nacionales=next_net,
         iva_importe=next_vat,
         precio_total=next_total,
         precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(next_total/tipo_cambio,2) else precio_total_usd end
   where id=r.id
   returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

create or replace function public.hl_change_group_reservation_room_with_plan_atomic(
  p_reserva_id bigint,
  p_from_room_id bigint,
  p_to_room_id bigint,
  p_reprice boolean default false
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype;
  r public.reservas%rowtype;
  source_detail jsonb;
  guests integer:=0;
  booked_pp numeric:=0;
  plan_nightly numeric:=0;
  plan_total numeric:=0;
  start_date date;
  end_date date;
  nights integer:=1;
  details jsonb;
  next_subtotal numeric:=0;
  next_discount numeric:=0;
  next_net numeric:=0;
  next_vat numeric:=0;
  next_total numeric:=0;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

  select e into source_detail
  from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=p_from_room_id
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
  order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
  limit 1;

  r:=public.hl_change_group_reservation_room_atomic(p_reserva_id,p_from_room_id,p_to_room_id,p_reprice);
  if not coalesce(p_reprice,false) or coalesce(source_detail->>'rate_plan_code','')='' then return r; end if;

  guests:=greatest(0,coalesce(nullif(source_detail->>'rate_plan_booked_guests','')::integer,nullif(source_detail->>'huespedes','')::integer,0));
  booked_pp:=coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0);
  plan_nightly:=booked_pp*guests;
  if abs(plan_nightly)<0.000001 then return r; end if;

  start_date:=coalesce(nullif(source_detail->>'fecha_entrada','')::date,before_row.fecha_entrada);
  end_date:=coalesce(nullif(source_detail->>'fecha_salida','')::date,before_row.fecha_salida);
  nights:=greatest(1,end_date-start_date);
  plan_total:=round(plan_nightly*nights,2);

  select coalesce(jsonb_agg(
    case when coalesce(e->>'habitacion_id','')~'^[0-9]+$'
           and (e->>'habitacion_id')::bigint=p_to_room_id
           and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
      then e||jsonb_build_object(
        'tarifa_base_noche',greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0)),
        'tarifa_noche',greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0)+plan_nightly),
        'rate_plan_code',source_detail->>'rate_plan_code',
        'rate_plan_name',source_detail->>'rate_plan_name',
        'rate_plan_meal',source_detail->>'rate_plan_meal',
        'rate_plan_regimen',source_detail->>'rate_plan_regimen',
        'rate_plan_adjustment_currency',source_detail->>'rate_plan_adjustment_currency',
        'rate_plan_adjustment_configured_per_person',coalesce(nullif(source_detail->>'rate_plan_adjustment_configured_per_person','')::numeric,0),
        'rate_plan_adjustment_booked_per_person',booked_pp,
        'rate_plan_adjustment_final_per_person',coalesce(nullif(source_detail->>'rate_plan_adjustment_final_per_person','')::numeric,0),
        'rate_plan_booked_guests',guests,
        'rate_plan_snapshot',coalesce(source_detail->'rate_plan_snapshot','{}'::jsonb)
      )
      else e end order by ord
  ),'[]'::jsonb)
  into details
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(e,ord);

  next_subtotal:=greatest(0,round(coalesce(r.subtotal,0)+plan_total,2));
  if lower(coalesce(r.descuento_tipo,'')) in('percent','porcentaje','percentage') then
    next_discount:=round(next_subtotal*least(100,greatest(0,coalesce(r.descuento_valor,0)))/100,2);
  elsif lower(coalesce(r.descuento_tipo,'')) in('amount','importe','fixed','fijo','monto') then
    next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_valor,r.descuento_importe,0)));
  else
    next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_importe,0)));
  end if;
  next_net:=round(greatest(0,next_subtotal-next_discount),2);
  next_vat:=case when coalesce(r.impuestos_desglosados,false) then round(next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  next_total:=round(next_net+next_vat,2);

  update public.reservas
     set habitaciones_detalle=details,
         tarifa_noche=greatest(0,coalesce(r.tarifa_noche,0)+plan_nightly),
         subtotal=next_subtotal,
         descuento_importe=next_discount,
         precio_sin_impuestos_nacionales=next_net,
         iva_importe=next_vat,
         precio_total=next_total,
         precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(next_total/tipo_cambio,2) else precio_total_usd end
   where id=r.id
   returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

grant execute on function public.hl_change_rate_currency_with_plans(uuid,text,numeric,jsonb,text,date) to authenticated;
grant execute on function public.hl_add_room_to_reservation_with_plan_atomic(bigint,jsonb) to authenticated;
grant execute on function public.hl_extend_group_rooms_with_plan_atomic(bigint,bigint[],date) to authenticated;
grant execute on function public.hl_planning_move_reservation_with_plan_atomic(bigint,bigint,date,date,boolean) to authenticated;
grant execute on function public.hl_change_group_reservation_room_with_plan_atomic(bigint,bigint,bigint,boolean) to authenticated;

commit;
