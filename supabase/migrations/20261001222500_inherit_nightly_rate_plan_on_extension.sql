CREATE OR REPLACE FUNCTION public.hl_extend_group_rooms_with_plan_atomic(p_reserva_id bigint, p_room_ids bigint[], p_new_end date)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  before_row public.reservas%rowtype;
  r public.reservas%rowtype;
  rid bigint;
  before_detail jsonb;
  after_detail jsonb;
  details jsonb;
  old_end date;
  start_date date;
  extra_nights integer;
  total_nights integer;
  extension_guests integer;
  basis text;
  booked_pp numeric;
  booked_night numeric;
  base_extension numeric;
  raw_delta numeric;
  delta numeric;
  total_delta numeric:=0;
  old_room_total numeric;
  new_room_total numeric;
  new_rate numeric;
  next_net numeric;
  next_vat numeric;
  total_rate numeric;
  occupancy jsonb;
  extension_occupancy jsonb;
  all_occupancy jsonb;
  segment jsonb;
  night_date date;
  base_night numeric;
  net_night numeric;
  final_night numeric;
  factor numeric;
  avg_adj_net numeric;
  avg_adj_final numeric;
  max_guests integer;
  variable_guests integer;
  variable_plans integer;
  last_adjustment numeric;
  extension_plan_code text;
  extension_plan_name text;
  extension_plan_meal text;
  extension_plan_regimen text;
  extension_plan_basis text;
  has_occupancy boolean;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

  r:=public.hl_extend_group_rooms_atomic(p_reserva_id,p_room_ids,p_new_end);
  details:=coalesce(r.habitaciones_detalle,'[]'::jsonb);
  factor:=case when coalesce(r.impuestos_desglosados,false) then 1+greatest(0,coalesce(r.iva_porcentaje,0))/100 else 1 end;

  foreach rid in array coalesce(p_room_ids,array[]::bigint[]) loop
    select e into before_detail
    from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
      and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
    limit 1;

    old_end:=coalesce(nullif(before_detail->>'fecha_salida','')::date,before_row.fecha_salida);
    start_date:=coalesce(nullif(before_detail->>'fecha_entrada','')::date,before_row.fecha_entrada);
    extra_nights:=greatest(0,p_new_end-old_end);
    total_nights:=greatest(1,p_new_end-start_date);
    if extra_nights=0 then continue; end if;

    occupancy:=case when jsonb_typeof(before_detail->'occupancy_nights')='array' then before_detail->'occupancy_nights' else '[]'::jsonb end;
    has_occupancy:=jsonb_array_length(occupancy)>0;
    select greatest(1,coalesce(nullif(n->>'guests','')::integer,1)),
           nullif(n->>'adjustment_net','')::numeric,
           nullif(n->>'rate_plan_code',''),
           nullif(n->>'rate_plan_name',''),
           nullif(n->>'rate_plan_meal',''),
           nullif(n->>'rate_plan_regimen',''),
           lower(nullif(n->>'rate_plan_basis',''))
      into extension_guests,last_adjustment,extension_plan_code,extension_plan_name,extension_plan_meal,extension_plan_regimen,extension_plan_basis
    from jsonb_array_elements(occupancy) n
    where coalesce(n->>'date','')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    order by (n->>'date')::date desc
    limit 1;
    extension_guests:=coalesce(extension_guests,greatest(1,coalesce(nullif(before_detail->>'huespedes','')::integer,1)));
    extension_plan_code:=coalesce(extension_plan_code,nullif(before_detail->>'rate_plan_code',''));
    extension_plan_name:=coalesce(extension_plan_name,nullif(before_detail->>'rate_plan_name',''));
    extension_plan_meal:=coalesce(extension_plan_meal,nullif(before_detail->>'rate_plan_meal',''));
    extension_plan_regimen:=coalesce(extension_plan_regimen,nullif(before_detail->>'rate_plan_regimen',''));

    basis:=coalesce(extension_plan_basis,lower(coalesce(before_detail->>'rate_plan_adjustment_basis','per_person')));
    booked_pp:=coalesce(nullif(before_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0);
    booked_night:=coalesce(last_adjustment,case when basis='per_person'
      then booked_pp*extension_guests
      else coalesce(nullif(before_detail->>'rate_plan_adjustment_booked_per_night','')::numeric,0)
    end);

    select e into after_detail
    from jsonb_array_elements(details) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
      and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
    limit 1;

    base_extension:=greatest(0,coalesce(nullif(after_detail->>'extension_net_total','')::numeric,0));
    raw_delta:=booked_night*extra_nights;
    delta:=greatest(-base_extension,raw_delta);
    old_room_total:=case
      when has_occupancy and coalesce(nullif(before_detail->>'stay_net_total','')::numeric,0)>0
        then coalesce(nullif(before_detail->>'stay_net_total','')::numeric,0)
      else greatest(0,coalesce(nullif(before_detail->>'tarifa_noche','')::numeric,0))*greatest(1,old_end-start_date)
    end;
    new_room_total:=greatest(0,round(old_room_total+base_extension+delta,2));
    new_rate:=round(new_room_total/total_nights,6);

    all_occupancy:=occupancy;
    if has_occupancy then
      extension_occupancy:='[]'::jsonb;
      for night_date in select generate_series(old_end,p_new_end-1,interval '1 day')::date loop
        select coalesce(nullif(e->>'tarifa_neta','')::numeric,nullif(e->>'price','')::numeric,nullif(e->>'tarifa','')::numeric)
          into base_night
        from jsonb_array_elements(case when jsonb_typeof(after_detail->'tarifas_por_noche')='array' then after_detail->'tarifas_por_noche' else '[]'::jsonb end) e
        where coalesce(e->>'fecha',e->>'stay_date','')=night_date::text
        order by 1 desc nulls last
        limit 1;
        base_night:=coalesce(base_night,case when extra_nights>0 then base_extension/extra_nights else 0 end);
        net_night:=greatest(0,round(base_night+booked_night,2));
        final_night:=round(net_night*factor,2);
        extension_occupancy:=extension_occupancy||jsonb_build_array(jsonb_build_object(
          'date',night_date,'guests',extension_guests,'net_rate',net_night,'final_rate',final_night,
          'adjustment_net',round(booked_night,6),'adjustment_final',round(booked_night*factor,2),
          'rate_plan_code',extension_plan_code,'rate_plan_name',extension_plan_name,'rate_plan_meal',extension_plan_meal,
          'rate_plan_regimen',extension_plan_regimen,'rate_plan_basis',basis
        ));
      end loop;
      all_occupancy:=occupancy||extension_occupancy;

      select round(coalesce(avg(coalesce(nullif(n->>'adjustment_net','')::numeric,0)),0),2),
             round(coalesce(avg(coalesce(nullif(n->>'adjustment_final','')::numeric,0)),0),2),
             coalesce(max(greatest(1,coalesce(nullif(n->>'guests','')::integer,1))),extension_guests),
             count(distinct greatest(1,coalesce(nullif(n->>'guests','')::integer,1))),
             count(distinct coalesce(nullif(n->>'rate_plan_code',''),nullif(before_detail->>'rate_plan_code','')))
        into avg_adj_net,avg_adj_final,max_guests,variable_guests,variable_plans
      from jsonb_array_elements(all_occupancy) n;

      segment:=jsonb_build_object(
        'from',old_end,'to',p_new_end,'guests',extension_guests,'nights',extra_nights,
        'rate_plan_code',extension_plan_code,'rate_plan_name',extension_plan_name,
        'net_total',round(base_extension+delta,2),'final_total',round((base_extension+delta)*factor,2)
      );
    end if;

    select coalesce(jsonb_agg(
      case when coalesce(e->>'habitacion_id','')~'^[0-9]+$'
             and (e->>'habitacion_id')::bigint=rid
             and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
        then e||jsonb_build_object(
          'tarifa_noche',new_rate,
          'extension_net_total',round(base_extension+delta,2),
          'rate_plan_extension_net_total',round(delta,2),
          'stay_net_total',case when has_occupancy then to_jsonb(new_room_total) else e->'stay_net_total' end,
          'occupancy_nights',case when has_occupancy then all_occupancy else e->'occupancy_nights' end,
          'occupancy_segments',case when has_occupancy then
            (case when jsonb_typeof(before_detail->'occupancy_segments')='array' then before_detail->'occupancy_segments' else '[]'::jsonb end)||jsonb_build_array(segment)
            else e->'occupancy_segments' end,
          'variable_occupancy',case when has_occupancy then variable_guests>1 else coalesce((e->>'variable_occupancy')::boolean,false) end,
          'rate_plan_variable',case when has_occupancy then variable_plans>1 else coalesce((e->>'rate_plan_variable')::boolean,false) end,
          'rate_plan_name',case when has_occupancy and variable_plans>1 then 'Régimen variable' else coalesce(e->>'rate_plan_name',extension_plan_name) end,
          'rate_plan_regimen',case when has_occupancy and variable_plans>1 then 'Mixto' else coalesce(e->>'rate_plan_regimen',extension_plan_regimen) end,
          'rate_plan_meal',case when has_occupancy and variable_plans>1 then 'variable' else coalesce(e->>'rate_plan_meal',extension_plan_meal) end,
          'huespedes',case when has_occupancy then greatest(coalesce(nullif(e->>'huespedes','')::integer,1),max_guests) else coalesce(nullif(e->>'huespedes','')::integer,1) end,
          'rate_plan_booked_guests',case when has_occupancy then greatest(coalesce(nullif(e->>'rate_plan_booked_guests','')::integer,1),max_guests) else coalesce(nullif(e->>'rate_plan_booked_guests','')::integer,1) end,
          'rate_plan_adjustment_booked_per_night',case when has_occupancy then avg_adj_net else coalesce(nullif(e->>'rate_plan_adjustment_booked_per_night','')::numeric,booked_night) end,
          'rate_plan_adjustment_final_per_night',case when has_occupancy then avg_adj_final else coalesce(nullif(e->>'rate_plan_adjustment_final_per_night','')::numeric,round(booked_night*factor,2)) end
        )
        else e end order by ord
    ),'[]'::jsonb)
    into details
    from jsonb_array_elements(details) with ordinality x(e,ord);

    total_delta:=total_delta+delta;
  end loop;

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
$function$;

grant execute on function public.hl_extend_group_rooms_with_plan_atomic(bigint,bigint[],date) to authenticated;
