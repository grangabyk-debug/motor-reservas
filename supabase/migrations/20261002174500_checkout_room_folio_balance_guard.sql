create or replace function private.hl_room_folio_balance(p_reservation_id bigint,p_room_id bigint)
returns numeric
language sql
security definer
set search_path to 'public','private','pg_temp'
as $$
  with room_folios as (
    select id from public.hotel_folios
    where reservation_id=p_reservation_id and room_id=p_room_id
  ),
  charges as (
    select coalesce(sum(i.total),0)::numeric as value
    from public.hotel_folio_items i
    where i.folio_id in(select id from room_folios) and i.status='active'
  ),
  paid as (
    select coalesce(sum(a.amount),0)::numeric as value
    from public.hotel_folio_payment_allocations a
    where a.folio_id in(select id from room_folios)
  )
  select greatest(0,(select value from charges)-(select value from paid));
$$;

CREATE OR REPLACE FUNCTION public.hl_checkout_reservation_room_atomic(p_reserva_id bigint, p_room_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v public.reservas%rowtype;v_room_ids bigint[];v_remaining bigint[];v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;v_room_name text;v_final public.reservas%rowtype;v_active_total integer:=0;v_details jsonb;v_room_balance numeric:=0;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;select * into v from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;
 if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.';end if;if v.estado='cancelada' or coalesce(v.no_show,false) or v.estado='finalizada' then raise exception using errcode='P0001',message='La reserva no admite check-out de habitación.';end if;if v.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in de la reserva.';end if;
 v_room_ids:=case when cardinality(coalesce(v.habitaciones_ids,array[]::bigint[]))>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;if not(p_room_id=any(v_room_ids)) then raise exception using errcode='22023',message='La habitación no pertenece a esta reserva.';end if;if not private.hl_room_is_checked_in(v.habitaciones_detalle,p_room_id) then raise exception using errcode='P0001',message='Primero realizá el check-in de esta habitación antes del check-out.';end if;select nombre into v_room_name from public.habitaciones where id=p_room_id and property_id=v.property_id;
 v_room_balance:=private.hl_room_folio_balance(v.id,p_room_id);
 if v_room_balance>0.01 then raise exception using errcode='P0001',message='La Habitación '||coalesce(v_room_name,p_room_id::text)||' tiene saldo pendiente de '||round(v_room_balance,2)::text||' '||coalesce(v.moneda,'ARS')||'. Cobralo o concilialo en su folio antes del check-out.';end if;
 select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=v.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;
 v_local_date:=public.hl_operational_date(v.property_id);
 update public.hotel_reservation_guests set checked_out_at=coalesce(checked_out_at,now()),checked_out_by=coalesce(checked_out_by,auth.uid()),stay_to=greatest(coalesce(stay_from,v.fecha_entrada),v_local_date),updated_at=now() where reservation_id=v.id and property_id=v.property_id and room_id=p_room_id and checked_out_at is null;
 v.room_checkout_dates:=jsonb_set(coalesce(v.room_checkout_dates,'{}'::jsonb),array[p_room_id::text],to_jsonb(v_local_date::text),true);
 select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' then e||jsonb_build_object('huespedes',0) else e end order by ord),'[]'::jsonb) into v_details from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);
 select count(*) into v_active_total from public.hotel_reservation_guests x where x.reservation_id=v.id and x.checked_out_at is null;
 update public.reservas set room_checkout_dates=v.room_checkout_dates,habitaciones_detalle=v_details,cantidad_huespedes=v_active_total where id=v.id returning * into v;
 update public.habitaciones set estado='sucia' where property_id=v.property_id and id=p_room_id;
 insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'room_checkout','Check-out de habitación','Se liberó la habitación '||coalesce(v_room_name,p_room_id::text)||' sin modificar la tarifa contratada.',jsonb_build_object('room_id',p_room_id,'room_name',v_room_name,'checkout_date',v_local_date),auth.uid());
 select coalesce(array_agg(x order by x),array[]::bigint[]) into v_remaining from unnest(v_room_ids) x where public.hl_reservation_room_effective_end_date(v.habitaciones_detalle,v.room_checkout_dates,x,v.fecha_salida)>v_local_date;
 if cardinality(v_remaining)=0 then v_final:=public.hl_checkout_reservation_atomic(v.id);return jsonb_build_object('reservation_id',v_final.id,'room_id',p_room_id,'checkout_date',v_local_date,'remaining_room_ids',v_remaining,'finalized',true,'estado',v_final.estado);end if;
 return jsonb_build_object('reservation_id',v.id,'room_id',p_room_id,'checkout_date',v_local_date,'remaining_room_ids',v_remaining,'finalized',false,'estado',v.estado);
end $function$
;

CREATE OR REPLACE FUNCTION public.hl_checkout_reservation_atomic(p_reserva_id bigint)
 RETURNS reservas
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v public.reservas%rowtype;v_paid numeric:=0;v_balance numeric:=0;v_room_ids bigint[];v_dirty_room_ids bigint[];v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;rid bigint;v_block_room_id bigint;v_block_balance numeric:=0;v_block_room_name text;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;select * into v from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.';end if;if v.estado='cancelada' or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva no admite check-out.';end if;if v.estado='finalizada' then return v;end if;if v.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in antes del check-out.';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e where nullif(e->>'checked_in_at','') is not null)
    and exists(
      select 1
      from unnest(case when cardinality(coalesce(v.habitaciones_ids,array[]::bigint[]))>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end) x
      where not (coalesce(v.room_checkout_dates,'{}'::jsonb) ? x::text)
        and not private.hl_room_is_checked_in(v.habitaciones_detalle,x)
    )
 then raise exception using errcode='P0001',message='Hay habitaciones pendientes de check-in. Completá sus ingresos antes de finalizar toda la reserva.';end if;
 select x,private.hl_room_folio_balance(v.id,x) into v_block_room_id,v_block_balance
 from unnest(case when cardinality(coalesce(v.habitaciones_ids,array[]::bigint[]))>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end) x
 where private.hl_room_folio_balance(v.id,x)>0.01
 order by x limit 1;
 if v_block_room_id is not null then
   select nombre into v_block_room_name from public.habitaciones where id=v_block_room_id and property_id=v.property_id;
   raise exception using errcode='P0001',message='La Habitación '||coalesce(v_block_room_name,v_block_room_id::text)||' tiene saldo pendiente de '||round(v_block_balance,2)::text||' '||coalesce(v.moneda,'ARS')||'. Resolvé el folio antes de finalizar la reserva.';
 end if;
 select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.reserva_id=v.id and p.property_id=v.property_id and lower(coalesce(p.estado,'')) not in('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');v_balance:=greatest(0,coalesce(v.precio_total,0)-v_paid);if v_balance>0.01 then raise exception using errcode='P0001',message='La reserva tiene saldo pendiente de '||round(v_balance,2)::text||' '||coalesce(v.moneda,'ARS')||'. Registrá o conciliá el pago antes del check-out.';end if;
 select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=v.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;v_local_date:=public.hl_operational_date(v.property_id);v_room_ids:=case when v.habitaciones_ids is not null and cardinality(v.habitaciones_ids)>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;
 select coalesce(array_agg(x order by x),array[]::bigint[]) into v_dirty_room_ids from unnest(v_room_ids) x where public.hl_reservation_room_effective_end_date(v.habitaciones_detalle,v.room_checkout_dates,x,v.fecha_salida)>v_local_date;
 foreach rid in array v_room_ids loop v.room_checkout_dates:=jsonb_set(coalesce(v.room_checkout_dates,'{}'::jsonb),array[rid::text],to_jsonb(v_local_date::text),true);end loop;
 update public.reservas set estado='finalizada',checkout_real_at=now(),room_checkout_dates=v.room_checkout_dates,cantidad_huespedes=0 where id=v.id returning * into v;
 update public.hotel_reservation_guests set checked_out_at=coalesce(checked_out_at,now()),checked_out_by=coalesce(checked_out_by,auth.uid()),stay_to=greatest(coalesce(stay_from,v.fecha_entrada),v_local_date),updated_at=now() where reservation_id=v.id and property_id=v.property_id and checked_out_at is null;
 if cardinality(v_dirty_room_ids)>0 then update public.habitaciones set estado='sucia' where property_id=v.property_id and id=any(v_dirty_room_ids);end if;
 insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'checkout','Check-out de reserva','Se finalizó la estadía y se liberaron todas las habitaciones.',jsonb_build_object('room_ids',v_room_ids,'checkout_date',v_local_date),auth.uid());return v;
end $function$
;
