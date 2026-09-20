-- Corrige el wrapper del cambio de habitación grupal durante estadía: la función legacy devuelve public.reservas.
CREATE OR REPLACE FUNCTION public.hl_move_inhouse_group_room_segment_atomic(p_reserva_id bigint, p_from_room_id bigint, p_to_room_id bigint, p_effective_date date, p_reprice boolean DEFAULT false)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_source_folio uuid;
  v_target_folio uuid;
  v_delta numeric;
  v_key text;
  v_target_name text;
  v_source_name text;
  v_move_at timestamptz:=now();
begin
  select * into v_before from public.reservas where id=p_reserva_id;
  if not found then
    raise exception using errcode='P0002',message='Reserva inexistente.';
  end if;

  v_source_folio:=private.hl_freeze_room_change_source_folio(p_reserva_id,p_from_room_id);

  select * into v_after
  from public.hl_move_inhouse_group_room_segment_atomic_legacy_folios_v1(
    p_reserva_id,p_from_room_id,p_to_room_id,p_effective_date,p_reprice
  );

  v_delta:=round(coalesce(v_after.precio_total,0)-coalesce(v_before.precio_total,0),2);
  v_key:='room-change-delta:'||p_from_room_id::text||':'||p_to_room_id::text||':'||
    replace(replace(v_move_at::text,' ','T'),'+','_');

  select nombre into v_target_name from public.habitaciones where id=p_to_room_id;
  select nombre into v_source_name from public.habitaciones where id=p_from_room_id;

  select id into v_target_folio
  from public.hotel_folios
  where reservation_id=p_reserva_id
    and room_id=p_to_room_id
    and folio_type='room'
    and status<>'void'
  order by created_at
  limit 1;

  if v_target_folio is null then
    insert into public.hotel_folios(
      property_id,reservation_id,room_id,folio_type,label,payer_type,payer_name,
      currency,status,is_primary,sort_order
    )
    values(
      v_after.property_id,v_after.id,p_to_room_id,'room',
      'Habitación '||coalesce(v_target_name,p_to_room_id::text),'guest',
      v_after.nombre_huesped,v_after.moneda,'open',true,
      coalesce((select max(sort_order)+1 from public.hotel_folios where reservation_id=v_after.id),1)
    )
    returning id into v_target_folio;
  end if;

  update public.hotel_folios
  set is_primary=false,updated_at=now()
  where reservation_id=p_reserva_id and folio_type='room' and id<>v_target_folio;
  update public.hotel_folios
  set is_primary=true,label='Habitación '||coalesce(v_target_name,p_to_room_id::text),updated_at=now()
  where id=v_target_folio;

  update public.reservas r
  set habitaciones_detalle=(
    select coalesce(jsonb_agg(
      case
        when coalesce(d->>'habitacion_id','')=p_to_room_id::text then
          d || jsonb_build_object(
            'financial_component_only',true,
            'financial_delta',v_delta,
            'financial_delta_source_key',v_key,
            'financial_from_room_name',coalesce(v_source_name,p_from_room_id::text),
            'financial_effective_date',p_effective_date,
            'financial_folio_id',v_target_folio
          )
        when coalesce(d->>'habitacion_id','')=p_from_room_id::text then
          d || jsonb_build_object(
            'financial_folio_id',v_source_folio,
            'financial_base_frozen',true
          )
        else d
      end
      order by ord
    ),'[]'::jsonb)
    from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(d,ord)
  )
  where r.id=p_reserva_id
  returning * into v_after;

  perform private.hl_apply_room_change_financial_folios_internal(p_reserva_id);
  perform private.hl_reconcile_reservation_rounding(p_reserva_id);
  perform private.hl_apply_room_change_financial_folios_internal(p_reserva_id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(p_reserva_id);

  update public.hotel_reservation_events
  set payload=coalesce(payload,'{}'::jsonb)||jsonb_build_object(
    'source_folio_id',v_source_folio,
    'target_folio_id',v_target_folio,
    'financial_delta_only',true,
    'financial_delta',v_delta,
    'source_folio_preserved',true
  )
  where id=(
    select id from public.hotel_reservation_events
    where reservation_id=p_reserva_id and event_type='room'
    order by created_at desc limit 1
  );

  select * into v_after from public.reservas where id=p_reserva_id;
  return v_after;
end;
$function$
;
