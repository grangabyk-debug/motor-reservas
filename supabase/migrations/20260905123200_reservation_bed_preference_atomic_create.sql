create or replace function public.hl_create_reservation_atomic(p_reservation jsonb, p_payments jsonb default '[]'::jsonb)
returns public.reservas
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  p jsonb;
  v_property uuid;
  v_user uuid;
begin
  if p_reservation is null or jsonb_typeof(p_reservation)<>'object' then
    raise exception using errcode='22023', message='Datos de reserva inválidos.';
  end if;
  if p_payments is null then p_payments:='[]'::jsonb; end if;
  if jsonb_typeof(p_payments)<>'array' then
    raise exception using errcode='22023', message='Los pagos iniciales deben ser una lista.';
  end if;
  v_property:=nullif(p_reservation->>'property_id','')::uuid;
  v_user:=nullif(p_reservation->>'user_id','')::uuid;
  if v_property is null then raise exception using errcode='23502', message='Falta la propiedad de la reserva.'; end if;
  insert into public.reservas(
    property_id,user_id,alojamiento_id,habitacion_id,habitaciones_ids,habitaciones_detalle,
    fecha_entrada,fecha_salida,tipo_estadia,tipo_cama,nombre_huesped,email_huesped,telefono_huesped,dni_huesped,
    direccion_huesped,provincia_estado_huesped,pais_huesped,cantidad_huespedes,
    canal_reserva,codigo_canal,tarifa_noche,noches,precio_total,moneda,notas,
    partner_id,group_id,garantia_tipo,garantia_marca,garantia_ultimos4,garantia_vencimiento,
    medio_pago_preferido,vehiculos,tipo_vehiculo,dominio_vehiculo,cochera_total,
    mascotas,mascotas_total,servicios,pasajeros,hora_llegada_estimada,hora_salida_estimada,estado,no_show
  ) values (
    v_property,v_user,
    nullif(p_reservation->>'alojamiento_id','')::bigint,
    nullif(p_reservation->>'habitacion_id','')::bigint,
    array(select value::bigint from jsonb_array_elements_text(coalesce(p_reservation->'habitaciones_ids','[]'::jsonb))),
    coalesce(p_reservation->'habitaciones_detalle','[]'::jsonb),
    nullif(p_reservation->>'fecha_entrada','')::date,
    nullif(p_reservation->>'fecha_salida','')::date,
    coalesce(nullif(p_reservation->>'tipo_estadia',''),'overnight'),
    nullif(p_reservation->>'tipo_cama',''),
    coalesce(p_reservation->>'nombre_huesped',''),
    nullif(p_reservation->>'email_huesped',''),nullif(p_reservation->>'telefono_huesped',''),nullif(p_reservation->>'dni_huesped',''),
    nullif(p_reservation->>'direccion_huesped',''),nullif(p_reservation->>'provincia_estado_huesped',''),nullif(p_reservation->>'pais_huesped',''),
    greatest(1,coalesce(nullif(p_reservation->>'cantidad_huespedes','')::integer,1)),
    coalesce(nullif(p_reservation->>'canal_reserva',''),'Directa'),nullif(p_reservation->>'codigo_canal',''),
    coalesce(nullif(p_reservation->>'tarifa_noche','')::numeric,0),coalesce(nullif(p_reservation->>'noches','')::integer,0),
    coalesce(nullif(p_reservation->>'precio_total','')::numeric,0),coalesce(nullif(p_reservation->>'moneda',''),'ARS'),nullif(p_reservation->>'notas',''),
    nullif(p_reservation->>'partner_id','')::uuid,nullif(p_reservation->>'group_id','')::uuid,
    nullif(p_reservation->>'garantia_tipo',''),nullif(p_reservation->>'garantia_marca',''),nullif(p_reservation->>'garantia_ultimos4',''),nullif(p_reservation->>'garantia_vencimiento',''),
    nullif(p_reservation->>'medio_pago_preferido',''),greatest(0,coalesce(nullif(p_reservation->>'vehiculos','')::integer,0)),
    nullif(p_reservation->>'tipo_vehiculo',''),nullif(p_reservation->>'dominio_vehiculo',''),coalesce(nullif(p_reservation->>'cochera_total','')::numeric,0),
    coalesce(p_reservation->'mascotas','[]'::jsonb),coalesce(nullif(p_reservation->>'mascotas_total','')::numeric,0),
    coalesce(p_reservation->'servicios','[]'::jsonb),coalesce(p_reservation->'pasajeros','[]'::jsonb),
    nullif(p_reservation->>'hora_llegada_estimada',''),nullif(p_reservation->>'hora_salida_estimada',''),
    coalesce(nullif(p_reservation->>'estado',''),'confirmada'),coalesce(nullif(p_reservation->>'no_show','')::boolean,false)
  ) returning * into v;
  for p in select value from jsonb_array_elements(p_payments) loop
    if coalesce(nullif(p->>'monto','')::numeric,0)<=0 then raise exception using errcode='22023', message='Hay un pago inicial con monto inválido.'; end if;
    if nullif(trim(coalesce(p->>'metodo','')),'') is null then raise exception using errcode='22023', message='Hay un pago inicial sin medio de pago.'; end if;
    insert into public.pagos(property_id,user_id,reserva_id,monto,metodo,moneda,nota)
    values(v.property_id,coalesce(nullif(p->>'user_id','')::uuid,v_user),v.id,(p->>'monto')::numeric,trim(p->>'metodo'),coalesce(nullif(p->>'moneda',''),'ARS'),nullif(p->>'nota',''));
  end loop;
  return v;
end;
$function$;
