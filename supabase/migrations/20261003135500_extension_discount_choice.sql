begin;

create or replace function public.hl_extend_group_rooms_with_discount_atomic(
  p_reserva_id bigint,
  p_room_ids bigint[],
  p_new_end date,
  p_apply_existing_discount boolean default false
)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype;
  r public.reservas%rowtype;
  v_discount_percent numeric:=0;
  v_extension_net numeric:=0;
  v_discount_net numeric:=0;
  v_next_net numeric:=0;
  v_next_vat numeric:=0;
  v_next_total numeric:=0;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into before_row
  from public.reservas
  where id=p_reserva_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='Reserva inexistente.';
  end if;

  if not private.user_has_property_role(before_row.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para extender esta reserva.';
  end if;

  if p_apply_existing_discount then
    if lower(coalesce(before_row.descuento_tipo,''))<>'percent'
       or coalesce(before_row.descuento_valor,0)<=0 then
      raise exception using errcode='22023',
        message='La reserva no tiene un descuento porcentual vigente para aplicar a las noches nuevas.';
    end if;
    v_discount_percent:=least(100,greatest(0,coalesce(before_row.descuento_valor,0)));
  end if;

  r:=public.hl_extend_group_rooms_with_plan_atomic(p_reserva_id,p_room_ids,p_new_end);

  if not p_apply_existing_discount or v_discount_percent<=0 then
    return r;
  end if;

  select coalesce(sum(greatest(0,coalesce(nullif(e->>'extension_net_total','')::numeric,0))),0)
    into v_extension_net
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=any(coalesce(p_room_ids,array[]::bigint[]))
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');

  v_discount_net:=round(v_extension_net*v_discount_percent/100,6);
  if v_discount_net<=0 then
    return r;
  end if;

  v_next_net:=greatest(0,round(coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,r.precio_total,0)-v_discount_net,2));
  v_next_vat:=case
    when coalesce(r.impuestos_desglosados,false)
      then round(v_next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2)
    else 0
  end;
  v_next_total:=round(v_next_net+v_next_vat,2);

  update public.reservas
     set descuento_importe=round(coalesce(descuento_importe,0)+v_discount_net,6),
         subtotal=v_next_net,
         precio_sin_impuestos_nacionales=v_next_net,
         iva_importe=v_next_vat,
         precio_total=v_next_total,
         precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_next_total/tipo_cambio,2) else precio_total_usd end
   where id=r.id
   returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);

  insert into public.hotel_reservation_events(
    property_id,reservation_id,event_type,title,detail,payload,actor_user_id
  )
  values(
    r.property_id,r.id,'extension_discount','Descuento en noches nuevas',
    format('Se aplicó %s%% de descuento a las noches nuevas de %s habitación(es).',
      trim(to_char(v_discount_percent,'FM999990.##')),cardinality(coalesce(p_room_ids,array[]::bigint[]))),
    jsonb_build_object(
      'room_ids',coalesce(p_room_ids,array[]::bigint[]),
      'new_end',p_new_end,
      'discount_percent',v_discount_percent,
      'extension_net_before_discount',round(v_extension_net,2),
      'discount_net',round(v_discount_net,2),
      'price_total',r.precio_total,
      'currency',r.moneda
    ),
    auth.uid()
  );

  return r;
end;
$$;

revoke all on function public.hl_extend_group_rooms_with_discount_atomic(bigint,bigint[],date,boolean) from public,anon;
grant execute on function public.hl_extend_group_rooms_with_discount_atomic(bigint,bigint[],date,boolean) to authenticated;

commit;
