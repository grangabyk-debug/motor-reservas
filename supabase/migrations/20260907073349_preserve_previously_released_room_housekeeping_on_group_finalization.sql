create or replace function public.hl_checkout_reservation_atomic(p_reserva_id bigint)
returns reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  v_paid numeric:=0;
  v_balance numeric:=0;
  v_room_ids bigint[];
  v_dirty_room_ids bigint[];
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_local_date date;
  rid bigint;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.';
  end if;
  if v.estado='cancelada' or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva no admite check-out.'; end if;
  if v.estado='finalizada' then return v; end if;
  if v.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in antes del check-out.'; end if;

  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0)
  into v_paid
  from public.pagos p
  where p.reserva_id=v.id and p.property_id=v.property_id
    and lower(coalesce(p.estado,'')) not in ('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');
  v_balance:=greatest(0,coalesce(v.precio_total,0)-v_paid);
  if v_balance>0.01 then raise exception using errcode='P0001',message='La reserva tiene saldo pendiente de '||round(v_balance,2)::text||' '||coalesce(v.moneda,'ARS')||'. Registrá o conciliá el pago antes del check-out.'; end if;

  select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=v.property_id;
  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  begin v_local_date:=(now() at time zone v_timezone)::date; exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date; end;
  v_room_ids:=case when v.habitaciones_ids is not null and cardinality(v.habitaciones_ids)>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;
  select coalesce(array_agg(x order by x),array[]::bigint[]) into v_dirty_room_ids from unnest(v_room_ids) x where not (coalesce(v.room_checkout_dates,'{}'::jsonb) ? x::text);
  foreach rid in array v_room_ids loop
    v.room_checkout_dates:=jsonb_set(coalesce(v.room_checkout_dates,'{}'::jsonb),array[rid::text],to_jsonb(v_local_date::text),true);
  end loop;

  update public.reservas set estado='finalizada',checkout_real_at=now(),room_checkout_dates=v.room_checkout_dates where id=v.id returning * into v;
  update public.hotel_reservation_guests set checked_out_at=coalesce(checked_out_at,now()),checked_out_by=coalesce(checked_out_by,auth.uid()),updated_at=now() where reservation_id=v.id and property_id=v.property_id and checked_out_at is null;
  if cardinality(v_dirty_room_ids)>0 then
    update public.habitaciones set estado='sucia' where property_id=v.property_id and id=any(v_dirty_room_ids);
  end if;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(v.property_id,v.id,'checkout','Check-out de reserva','Se finalizó la estadía y se liberaron todas las habitaciones.',jsonb_build_object('room_ids',v_room_ids,'checkout_date',v_local_date),auth.uid());
  return v;
end;
$function$;
