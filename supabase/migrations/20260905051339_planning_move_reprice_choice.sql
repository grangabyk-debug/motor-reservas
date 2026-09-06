create or replace function public.hl_planning_move_reservation_priced_atomic(
  p_reserva_id bigint,
  p_habitacion_id bigint,
  p_fecha_entrada date,
  p_fecha_salida date default null,
  p_reprice boolean default false
)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_group uuid:=gen_random_uuid();
  v_action text;
  v_units integer;
  v_old_room_component numeric;
  v_non_room numeric;
  v_subtotal numeric;
  v_discount numeric;
  v_total numeric;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then
    raise exception using errcode='P0002',message='Reserva inexistente.';
  end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para operar el Planning.';
  end if;

  select * into v_room
  from public.habitaciones
  where id=p_habitacion_id and property_id=v_before.property_id and activa is distinct from false;
  if not found then
    raise exception using errcode='P0002',message='Habitación inexistente o inactiva.';
  end if;

  v_action:=case
    when p_habitacion_id=v_before.habitacion_id
      and p_fecha_entrada=v_before.fecha_entrada
      and p_fecha_salida is not null
      and p_fecha_salida is distinct from v_before.fecha_salida then 'resize'
    else 'move'
  end;

  v_after:=public.hl_move_reservation_atomic(p_reserva_id,p_habitacion_id,p_fecha_entrada,p_fecha_salida);

  if p_reprice and p_habitacion_id is distinct from v_before.habitacion_id then
    v_units:=case
      when coalesce(v_after.tipo_estadia,'overnight')='day_use' then 1
      else greatest(1,coalesce(v_after.noches,v_after.fecha_salida-v_after.fecha_entrada,1))
    end;
    v_old_room_component:=greatest(0,coalesce(v_after.tarifa_noche,0)*v_units);
    v_non_room:=greatest(0,case
      when coalesce(v_after.subtotal,0)>0 then v_after.subtotal-v_old_room_component
      else coalesce(v_after.cochera_total,0)+coalesce(v_after.extra,0)+coalesce(v_after.early_checkin_importe,0)+coalesce(v_after.late_checkout_importe,0)+coalesce(v_after.mascotas_total,0)
    end);
    v_subtotal:=greatest(0,coalesce(v_room.precio,0)*v_units+v_non_room);
    v_discount:=case
      when lower(coalesce(v_after.descuento_tipo,'')) in ('porcentaje','percent','percentage')
        then v_subtotal*least(100,greatest(0,coalesce(v_after.descuento_valor,0)))/100
      else greatest(0,coalesce(v_after.descuento_importe,v_after.descuento_valor,0))
    end;
    v_total:=greatest(0,v_subtotal-v_discount);

    update public.reservas
    set tarifa_noche=coalesce(v_room.precio,0),
        subtotal=v_subtotal,
        descuento_importe=v_discount,
        precio_total=v_total,
        precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,
        habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (
          select coalesce(jsonb_agg(
            case
              when nullif(elem->>'habitacion_id','')::bigint=p_habitacion_id
                then jsonb_set(elem,'{tarifa_noche}',to_jsonb(coalesce(v_room.precio,0)),true)
              else elem
            end
          ),'[]'::jsonb)
          from jsonb_array_elements(habitaciones_detalle) elem
        ) else habitaciones_detalle end
    where id=v_after.id
    returning * into v_after;
  end if;

  insert into public.hotel_planning_operation_log(
    operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by
  ) values (
    v_group,v_before.property_id,v_action,v_before.id,
    private.hl_planning_reservation_state(v_before),
    private.hl_planning_reservation_state(v_after),
    jsonb_build_object(
      'guest',v_before.nombre_huesped,
      'code',v_before.numero_reserva,
      'reprice',coalesce(p_reprice,false),
      'old_room_id',v_before.habitacion_id,
      'new_room_id',p_habitacion_id,
      'old_rate',v_before.tarifa_noche,
      'new_rate',v_after.tarifa_noche
    ),
    auth.uid()
  );

  return v_after;
end;
$function$;

revoke all on function public.hl_planning_move_reservation_priced_atomic(bigint,bigint,date,date,boolean) from public;
revoke execute on function public.hl_planning_move_reservation_priced_atomic(bigint,bigint,date,date,boolean) from anon;
grant execute on function public.hl_planning_move_reservation_priced_atomic(bigint,bigint,date,date,boolean) to authenticated;
