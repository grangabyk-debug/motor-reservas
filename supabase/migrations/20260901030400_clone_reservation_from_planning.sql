create or replace function public.hl_clone_reservation_atomic(
  p_reserva_id bigint,
  p_room_id bigint,
  p_start date,
  p_reprice boolean default false,
  p_copy_extras boolean default true,
  p_copy_notes boolean default true
)
returns public.reservas
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_source public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_created public.reservas%rowtype;
  v_length integer;
  v_units integer;
  v_end date;
  v_rate numeric;
  v_non_room numeric;
  v_total numeric;
  v_payload jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Tenés que iniciar sesión para duplicar una reserva.';
  end if;

  select * into v_source
  from public.reservas
  where id=p_reserva_id
  for share;

  if not found then
    raise exception using errcode='P0002', message='La reserva original no existe.';
  end if;

  if not private.user_has_property_role(v_source.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501', message='No tenés permisos para duplicar reservas en esta propiedad.';
  end if;

  if p_start is null then
    raise exception using errcode='22023', message='Elegí la fecha de entrada de la copia.';
  end if;

  select * into v_room
  from public.habitaciones
  where id=p_room_id
    and property_id=v_source.property_id
    and activa is distinct from false;

  if not found then
    raise exception using errcode='22023', message='La habitación elegida no está disponible en esta propiedad.';
  end if;

  if coalesce(v_room.capacidad,1) < greatest(1,coalesce(v_source.cantidad_huespedes,1)) then
    raise exception using errcode='22023', message='La habitación elegida no tiene capacidad suficiente para esta reserva.';
  end if;

  if coalesce(v_source.tipo_estadia,'overnight')='day_use' then
    v_length:=0;
    v_units:=1;
    v_end:=p_start;
  else
    v_length:=greatest(1,v_source.fecha_salida-v_source.fecha_entrada);
    v_units:=v_length;
    v_end:=p_start+v_length;
  end if;

  v_rate:=case when p_reprice then coalesce(v_room.precio,v_source.tarifa_noche,0) else coalesce(v_source.tarifa_noche,0) end;
  v_non_room:=case when p_copy_extras then greatest(0,coalesce(v_source.precio_total,0)-(coalesce(v_source.tarifa_noche,0)*v_units)) else 0 end;
  v_total:=greatest(0,(v_rate*v_units)+v_non_room);

  v_payload:=jsonb_build_object(
    'property_id',v_source.property_id,
    'user_id',auth.uid(),
    'alojamiento_id',v_room.alojamiento_id,
    'habitacion_id',v_room.id,
    'habitaciones_ids',jsonb_build_array(v_room.id),
    'fecha_entrada',p_start,
    'fecha_salida',v_end,
    'tipo_estadia',coalesce(v_source.tipo_estadia,'overnight'),
    'nombre_huesped',coalesce(v_source.nombre_huesped,''),
    'email_huesped',v_source.email_huesped,
    'telefono_huesped',v_source.telefono_huesped,
    'dni_huesped',v_source.dni_huesped,
    'direccion_huesped',v_source.direccion_huesped,
    'provincia_estado_huesped',v_source.provincia_estado_huesped,
    'pais_huesped',v_source.pais_huesped,
    'cantidad_huespedes',greatest(1,coalesce(v_source.cantidad_huespedes,1)),
    'canal_reserva',coalesce(v_source.canal_reserva,'Directa'),
    'codigo_canal',null,
    'tarifa_noche',v_rate,
    'noches',case when coalesce(v_source.tipo_estadia,'overnight')='day_use' then 0 else v_length end,
    'precio_total',v_total,
    'moneda',coalesce(v_source.moneda,'ARS'),
    'notas',case when p_copy_notes then v_source.notas else null end,
    'partner_id',v_source.partner_id,
    'group_id',v_source.group_id,
    'garantia_tipo',null,
    'garantia_marca',null,
    'garantia_ultimos4',null,
    'garantia_vencimiento',null,
    'medio_pago_preferido',v_source.medio_pago_preferido,
    'vehiculos',case when p_copy_extras then coalesce(v_source.vehiculos,0) else 0 end,
    'tipo_vehiculo',case when p_copy_extras then v_source.tipo_vehiculo else null end,
    'dominio_vehiculo',case when p_copy_extras then v_source.dominio_vehiculo else null end,
    'cochera_total',case when p_copy_extras then coalesce(v_source.cochera_total,0) else 0 end,
    'mascotas',case when p_copy_extras then coalesce(v_source.mascotas,'[]'::jsonb) else '[]'::jsonb end,
    'mascotas_total',case when p_copy_extras then coalesce(v_source.mascotas_total,0) else 0 end,
    'servicios',case when p_copy_extras then coalesce(v_source.servicios,'[]'::jsonb) else '[]'::jsonb end,
    'pasajeros',coalesce(v_source.pasajeros,'[]'::jsonb),
    'hora_llegada_estimada',v_source.hora_llegada_estimada,
    'hora_salida_estimada',v_source.hora_salida_estimada,
    'estado','confirmada',
    'no_show',false
  );

  v_created:=public.hl_create_reservation_atomic(v_payload,'[]'::jsonb);
  return v_created;
end;
$function$;

revoke all on function public.hl_clone_reservation_atomic(bigint,bigint,date,boolean,boolean,boolean) from public;
revoke execute on function public.hl_clone_reservation_atomic(bigint,bigint,date,boolean,boolean,boolean) from anon;
grant execute on function public.hl_clone_reservation_atomic(bigint,bigint,date,boolean,boolean,boolean) to authenticated;
