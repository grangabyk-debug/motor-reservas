create or replace function public.hl_public_booking_create(p_slug text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  e public.hotel_booking_engines%rowtype; h public.habitaciones%rowtype; r public.reservas%rowtype;
  v_in date; v_out date; v_guests integer; v_nights integer; v_total numeric; v_nightly numeric;
  v_name text; v_email text; v_phone text; v_type text; v_bed text; v_request text; v_existing bigint; v_channel_code text; v_manage uuid;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  v_request:=coalesce(nullif(trim(coalesce(p_payload->>'request_id','')),''),gen_random_uuid()::text);
  perform pg_advisory_xact_lock(hashtextextended(e.id::text||':'||v_request,0));
  select reservation_id,manage_token into v_existing,v_manage from public.hotel_public_booking_requests where engine_id=e.id and request_key=v_request;
  if found then
    select * into r from public.reservas where id=v_existing;
    return jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'status',r.estado,'property_id',r.property_id,'room_type',coalesce((r.habitaciones_detalle->0->>'tipo'),'Habitación'),'bed_type',r.tipo_cama,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'total',r.precio_total,'currency',r.moneda,'manage_token',v_manage,'idempotent_replay',true);
  end if;
  v_in:=nullif(p_payload->>'check_in','')::date; v_out:=nullif(p_payload->>'check_out','')::date; v_guests:=greatest(1,coalesce(nullif(p_payload->>'guests','')::integer,1));
  v_name:=trim(coalesce(p_payload->>'name','')); v_email:=nullif(trim(coalesce(p_payload->>'email','')),''); v_phone:=nullif(trim(coalesce(p_payload->>'phone','')),''); v_type:=nullif(trim(coalesce(p_payload->>'room_type','')),''); v_bed:=nullif(trim(coalesce(p_payload->>'bed_type','')),'');
  if v_name='' then raise exception 'Falta el nombre del huésped'; end if;
  if v_email is null then raise exception 'Falta el email del huésped'; end if;
  if v_type is null then raise exception 'Falta el tipo de habitación'; end if;
  if v_in is null or v_out is null then raise exception 'Faltan fechas'; end if;
  v_nights:=v_out-v_in;
  if v_nights<e.min_nights then raise exception 'Estadía mínima de % noche(s)',e.min_nights; end if;
  if v_in<current_date+e.min_advance_days or v_in>current_date+e.max_advance_days then raise exception 'Fecha de entrada no disponible'; end if;
  if coalesce((e.room_type_rules->v_type->>'enabled')::boolean,true)=false then raise exception 'Ese tipo de habitación no se vende online'; end if;
  select h0.* into h from public.habitaciones h0
  where h0.property_id=e.property_id and coalesce(h0.activa,true)=true and coalesce(h0.online_bookable,true)=true and h0.estado<>'mantenimiento'
    and coalesce(h0.descripcion,'') not like '[QA-PLANNING-LOAD-%' and coalesce(h0.capacidad,1)>=v_guests
    and lower(coalesce(nullif(trim(h0.tipo),''),'Habitación'))=lower(v_type)
    and not exists(select 1 from public.reservas x where x.property_id=e.property_id and coalesce(x.no_show,false)=false and coalesce(x.estado,'')<>'cancelada' and (x.habitacion_id=h0.id or h0.id=any(coalesce(x.habitaciones_ids,'{}'::bigint[]))) and x.fecha_entrada<v_out and x.fecha_salida>v_in)
    and not exists(select 1 from public.bloqueos b where b.property_id=e.property_id and b.habitacion_id=h0.id and b.fecha_desde<v_out and b.fecha_hasta>v_in)
    and not exists(select 1 from public.hotel_rate_calendar rc where rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date>=v_in and rc.stay_date<v_out and rc.stop_sell=true)
    and coalesce((select max(rc.min_stay) from public.hotel_rate_calendar rc where rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date>=v_in and rc.stay_date<v_out),1)<=v_nights
  order by (select sum(coalesce(rc.price,h0.precio,0)) from generate_series(v_in,v_out-1,interval '1 day') g(day) left join public.hotel_rate_calendar rc on rc.property_id=e.property_id and rc.habitacion_id=h0.id and rc.stay_date=g.day::date),h0.id
  limit 1 for update of h0;
  if not found then raise exception 'Ese tipo de habitación acaba de dejar de estar disponible'; end if;
  select sum(coalesce(rc.price,h.precio,0)) into v_total from generate_series(v_in,v_out-1,interval '1 day') g(day) left join public.hotel_rate_calendar rc on rc.property_id=e.property_id and rc.habitacion_id=h.id and rc.stay_date=g.day::date;
  v_nightly:=case when v_nights>0 then round(v_total/v_nights,2) else 0 end;
  v_channel_code:='motor:'||e.slug||':'||left(v_request,36);
  insert into public.reservas(property_id,habitacion_id,habitaciones_ids,habitaciones_detalle,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,cantidad_huespedes,estado,tarifa_noche,noches,subtotal,precio_total,moneda,canal_reserva,codigo_canal,tipo_estadia,tipo_cama,notas)
  values(e.property_id,h.id,array[h.id],jsonb_build_array(jsonb_build_object('habitacion_id',h.id,'tipo',h.tipo,'tarifa_noche',v_nightly)),v_name,v_email,v_phone,v_in,v_out,v_guests,'confirmada',v_nightly,v_nights,v_total,v_total,e.currency,'Motor web',v_channel_code,'overnight',v_bed,'Reserva creada desde motor web') returning * into r;
  insert into public.hotel_public_booking_requests(engine_id,request_key,reservation_id) values(e.id,v_request,r.id) returning manage_token into v_manage;
  return jsonb_build_object('id',r.id,'numero_reserva',r.numero_reserva,'status',r.estado,'property_id',r.property_id,'room_type',coalesce(h.tipo,'Habitación'),'bed_type',r.tipo_cama,'check_in',r.fecha_entrada,'check_out',r.fecha_salida,'nights',r.noches,'total',r.precio_total,'currency',r.moneda,'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,'manage_token',v_manage,'idempotent_replay',false);
end;
$function$;
