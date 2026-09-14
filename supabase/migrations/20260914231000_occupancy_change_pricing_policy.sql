-- Property-level policy for an in-house occupancy increase that requires a room/category change.
-- Defaults to category_difference: charge only the difference between the booked room
-- and the target room for the remaining segment. Hotels can instead use an adult/child
-- supplement or a manual amount. The onboarding UI marks the decision as confirmed.

create or replace function private.hl_property_occupancy_pricing(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select jsonb_build_object(
    'mode','category_difference',
    'extra_adult_amount',0,
    'extra_child_amount',0,
    'charge_unit','per_night',
    'confirmed',false
  ) || coalesce((select settings->'preferences'->'occupancy_pricing' from public.property_settings where property_id=p_property_id),'{}'::jsonb)
$function$;

create or replace function public.hl_change_inhouse_occupancy_room_atomic(
  p_reserva_id bigint,
  p_to_room_id bigint,
  p_effective_date date,
  p_new_guest_count integer,
  p_added_adults integer default 0,
  p_added_children integer default 0,
  p_manual_amount numeric default null,
  p_reason text default null
)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_actor uuid:=auth.uid();
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_target public.habitaciones%rowtype;
  v_policy jsonb;
  v_mode text;
  v_unit text;
  v_confirmed boolean:=false;
  v_old_guests integer;
  v_added integer;
  v_end date;
  v_remaining_nights integer;
  v_adult_gross numeric:=0;
  v_child_gross numeric:=0;
  v_fee_gross numeric:=0;
  v_fee_net numeric:=0;
  v_vat_rate numeric:=0;
  v_new_net numeric:=0;
  v_new_vat numeric:=0;
  v_new_total numeric:=0;
  v_services jsonb;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_service_id text;
begin
  if v_actor is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  if p_new_guest_count is null or p_new_guest_count<1 then raise exception using errcode='22023',message='La nueva ocupación debe ser mayor a cero.'; end if;
  if greatest(0,coalesce(p_added_adults,0))+greatest(0,coalesce(p_added_children,0))<=0 then
    raise exception using errcode='22023',message='Indicá cuántos adultos o menores se agregan.';
  end if;
  if v_reason is null then raise exception using errcode='22023',message='Indicá el motivo del cambio de ocupación.'; end if;

  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para modificar esta reserva.';
  end if;
  if lower(coalesce(v_before.estado,'')) not in ('alojado','inhouse','in_house','in house') then
    raise exception using errcode='22023',message='El cambio de ocupación durante estadía requiere que el huésped ya esté alojado.';
  end if;
  if coalesce(cardinality(v_before.habitaciones_ids),case when v_before.habitacion_id is null then 0 else 1 end)>1 then
    raise exception using errcode='22023',message='Esta operación es para una reserva individual. En grupos modificá la habitación correspondiente.';
  end if;
  if p_to_room_id is null or p_to_room_id=v_before.habitacion_id then
    raise exception using errcode='22023',message='Elegí la nueva habitación/categoría para la ocupación ampliada.';
  end if;

  v_old_guests:=greatest(1,coalesce(v_before.cantidad_huespedes,1));
  v_added:=greatest(0,coalesce(p_added_adults,0))+greatest(0,coalesce(p_added_children,0));
  if p_new_guest_count<>v_old_guests+v_added then
    raise exception using errcode='22023',message=format('La ocupación debe pasar de %s a %s huéspedes según las personas agregadas.',v_old_guests,v_old_guests+v_added);
  end if;

  select * into v_target from public.habitaciones
  where id=p_to_room_id and property_id=v_before.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002',message='Habitación de destino inexistente o inactiva.'; end if;
  if greatest(1,coalesce(v_target.capacidad,1))<p_new_guest_count then
    raise exception using errcode='22023',message=format('La Habitación %s admite hasta %s huéspedes.',coalesce(v_target.nombre,p_to_room_id::text),coalesce(v_target.capacidad,1));
  end if;

  v_end:=public.hl_reservation_room_planned_end_date(v_before.habitaciones_detalle,v_before.habitacion_id,v_before.fecha_salida);
  if p_effective_date is null or v_end is null or p_effective_date>=v_end then
    raise exception using errcode='22007',message='La fecha del cambio debe ser anterior a la salida.';
  end if;
  v_remaining_nights:=greatest(1,v_end-p_effective_date);

  v_policy:=private.hl_property_occupancy_pricing(v_before.property_id);
  v_mode:=lower(coalesce(v_policy->>'mode','category_difference'));
  if v_mode not in ('category_difference','extra_person_fee','manual') then v_mode:='category_difference'; end if;
  v_unit:=lower(coalesce(v_policy->>'charge_unit','per_night'));
  if v_unit not in ('per_night','per_stay') then v_unit:='per_night'; end if;
  v_confirmed:=coalesce(nullif(v_policy->>'confirmed','')::boolean,false);

  if v_mode='category_difference' then
    v_after:=public.hl_move_inhouse_room_segment_atomic(
      v_before.id,v_before.habitacion_id,p_to_room_id,p_effective_date,true,v_reason
    );
  else
    v_after:=public.hl_move_inhouse_room_segment_atomic(
      v_before.id,v_before.habitacion_id,p_to_room_id,p_effective_date,false,v_reason
    );

    if v_mode='extra_person_fee' then
      v_adult_gross:=greatest(0,coalesce(nullif(v_policy->>'extra_adult_amount','')::numeric,0))*greatest(0,coalesce(p_added_adults,0));
      v_child_gross:=greatest(0,coalesce(nullif(v_policy->>'extra_child_amount','')::numeric,0))*greatest(0,coalesce(p_added_children,0));
      v_fee_gross:=v_adult_gross+v_child_gross;
      if v_unit='per_night' then v_fee_gross:=v_fee_gross*v_remaining_nights; end if;
    else
      if p_manual_amount is null or p_manual_amount<0 then
        raise exception using errcode='22023',message='La política del hotel requiere ingresar el importe manual del cambio de ocupación.';
      end if;
      v_fee_gross:=p_manual_amount;
    end if;

    v_vat_rate:=case when coalesce(v_after.impuestos_desglosados,false) then greatest(0,coalesce(v_after.iva_porcentaje,0)) else 0 end;
    v_fee_net:=case when v_vat_rate>0 then round(v_fee_gross/(1+v_vat_rate/100),2) else round(v_fee_gross,2) end;
    v_new_net:=round(greatest(0,coalesce(v_after.precio_sin_impuestos_nacionales,v_after.subtotal,v_after.precio_total,0)+v_fee_net),2);
    v_new_vat:=case when v_vat_rate>0 then round(v_new_net*v_vat_rate/100,2) else 0 end;
    v_new_total:=case when v_vat_rate>0 then round(v_new_net+v_new_vat,2) else round(coalesce(v_after.precio_total,0)+v_fee_gross,2) end;
    v_service_id:='occupancy-'||extract(epoch from clock_timestamp())::bigint::text;
    v_services:=coalesce(v_after.servicios,'[]'::jsonb);
    if v_fee_gross>0 then
      v_services:=v_services||jsonb_build_array(jsonb_build_object(
        'id',v_service_id,
        'categoria','fee',
        'nombre',case when v_mode='extra_person_fee' then 'Pasajero adicional' else 'Ajuste manual por cambio de ocupación' end,
        'detalle',format('%s · %s → %s huéspedes · Hab. %s · %s',v_reason,v_old_guests,p_new_guest_count,coalesce(v_target.nombre,p_to_room_id::text),case when v_mode='extra_person_fee' then case when v_unit='per_night' then v_remaining_nights||' noche(s)' else 'por estadía' end else 'importe manual' end),
        'cantidad',1,
        'precio',v_fee_net,
        'precio_comercial',round(v_fee_gross,2),
        'total',v_fee_net,
        'total_final',round(v_fee_gross,2),
        'price_tax_mode','tax_included',
        'habitacion_id',p_to_room_id,
        'created_at',now()
      ));
    end if;

    update public.reservas
    set servicios=v_services,
        subtotal=v_new_net,
        precio_sin_impuestos_nacionales=v_new_net,
        iva_importe=v_new_vat,
        precio_total=v_new_total,
        precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_new_total/tipo_cambio,2) else precio_total_usd end
    where id=v_after.id returning * into v_after;
  end if;

  update public.reservas
  set cantidad_huespedes=p_new_guest_count,
      habitaciones_detalle=case when jsonb_typeof(habitaciones_detalle)='array' then (
        select coalesce(jsonb_agg(
          case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_to_room_id and coalesce(e->>'segment_role','active_room')<>'previous_room'
            then e||jsonb_build_object('huespedes',p_new_guest_count,'occupancy_pricing_mode',v_mode,'occupancy_policy_confirmed',v_confirmed)
            else e end order by ord
        ),'[]'::jsonb)
        from jsonb_array_elements(habitaciones_detalle) with ordinality t(e,ord)
      ) else habitaciones_detalle end
  where id=v_after.id returning * into v_after;

  perform private.hl_sync_reservation_folios_internal(v_after.id);

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(
    v_after.property_id,v_after.id,'occupancy_change','Ocupación ampliada y cambio de habitación',
    format('%s → %s huéspedes · Hab. %s · %s',v_old_guests,p_new_guest_count,coalesce(v_target.nombre,p_to_room_id::text),
      case when v_mode='category_difference' then 'se cobró la diferencia de categoría'
           when v_mode='extra_person_fee' then 'se aplicó suplemento por pasajero'
           else 'se aplicó importe manual' end),
    jsonb_build_object(
      'before_guests',v_old_guests,'after_guests',p_new_guest_count,'added_adults',greatest(0,coalesce(p_added_adults,0)),
      'added_children',greatest(0,coalesce(p_added_children,0)),'from_room_id',v_before.habitacion_id,'to_room_id',p_to_room_id,
      'effective_date',p_effective_date,'remaining_nights',v_remaining_nights,'pricing_mode',v_mode,'policy_confirmed',v_confirmed,
      'charge_unit',v_unit,'fee_gross',round(v_fee_gross,2),'reason',v_reason
    ),v_actor
  );

  return v_after;
end;
$function$;
