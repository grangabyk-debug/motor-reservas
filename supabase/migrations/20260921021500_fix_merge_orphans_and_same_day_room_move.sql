-- Cierra los pendientes de QA de fusión y cambio same-day.
-- 1) una reserva fusionada nunca debe recrear folios vacíos;
-- 2) el RPC same-day debe recibir correctamente el resultado compuesto;
-- 3) UI y backend usan la misma lógica de día operativo (timezone/corte de la propiedad).

create or replace function private.hl_reservation_folio_sync_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if new.estado='fusionada' or new.merged_into_id is not null then
    return new;
  end if;
  perform private.hl_sync_reservation_folios_internal(new.id);
  return new;
end
$function$;

delete from public.hotel_folios f
using public.reservas r
where f.reservation_id=r.id
  and (r.estado='fusionada' or r.merged_into_id is not null)
  and not exists(select 1 from public.hotel_folio_items i where i.folio_id=f.id)
  and not exists(select 1 from public.pagos p where p.folio_id=f.id)
  and not exists(select 1 from public.hotel_finance_documents d where d.folio_id=f.id)
  and not exists(select 1 from public.hotel_folio_payment_allocations a where a.folio_id=f.id)
  and not exists(select 1 from public.hotel_folio_item_payment_allocations ia where ia.folio_id=f.id);

do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='hl_move_inhouse_same_day_room_atomic'
  limit 1;

  if v_def is null then
    raise exception 'No existe hl_move_inhouse_same_day_room_atomic';
  end if;

  v_old := $old$
  v_local_now timestamp:=now() at time zone 'America/Argentina/Buenos_Aires';
  v_today date;
$old$;
  v_new := $new$
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_cutoff_hour integer:=12;
  v_local_now timestamp;
  v_today date;
$new$;
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
  elsif position('v_cutoff_hour integer:=12;' in v_def)=0 then
    raise exception 'No se reconoció el bloque de fecha operativa';
  end if;

  v_old := $old$
begin
  v_today:=case when v_local_now::time<time '12:00' then v_local_now::date-1 else v_local_now::date end;

  if v_actor is null then
$old$;
  v_new := $new$
begin
  if v_actor is null then
$new$;
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
  end if;

  v_old := $old$
  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

$old$;
  v_new := $new$
  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;

  select
    coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires'),
    least(23,greatest(0,coalesce(nullif(settings->'preferences'->>'hotel_day_cutoff_hour','')::integer,12)))
  into v_timezone,v_cutoff_hour
  from public.property_settings
  where property_id=v_before.property_id;

  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  v_cutoff_hour:=least(23,greatest(0,coalesce(v_cutoff_hour,12)));
  begin
    v_local_now:=now() at time zone v_timezone;
  exception when others then
    v_timezone:='America/Argentina/Buenos_Aires';
    v_local_now:=now() at time zone v_timezone;
  end;
  v_today:=case when extract(hour from v_local_now)::integer<v_cutoff_hour then v_local_now::date-1 else v_local_now::date end;

$new$;
  if position('hotel_day_cutoff_hour' in v_def)=0 then
    if position(v_old in v_def)=0 then raise exception 'No se encontró la carga de reserva para fecha operativa'; end if;
    v_def:=replace(v_def,v_old,v_new);
  end if;

  v_old := $old$
  if v_stored_room_count>1 then
    select public.hl_change_group_reservation_room_atomic(
      p_reserva_id,p_from_room_id,p_to_room_id,p_reprice
    ) into v_after;
  else
    select public.hl_change_reservation_room_atomic(
      p_reserva_id,p_to_room_id,p_reprice
    ) into v_after;
  end if;
$old$;
  v_new := $new$
  if v_stored_room_count>1 then
    select * into v_after
    from public.hl_change_group_reservation_room_atomic(
      p_reserva_id,p_from_room_id,p_to_room_id,p_reprice
    );
  else
    select * into v_after
    from public.hl_change_reservation_room_atomic(
      p_reserva_id,p_to_room_id,p_reprice
    );
  end if;
$new$;
  if position(v_old in v_def)>0 then
    v_def:=replace(v_def,v_old,v_new);
  elsif position('select * into v_after' in v_def)=0 then
    raise exception 'No se reconoció el bloque de resultado compuesto';
  end if;

  execute v_def;
end
$patch$;
