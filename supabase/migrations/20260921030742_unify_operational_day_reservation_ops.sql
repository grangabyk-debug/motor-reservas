create or replace function public.hl_operational_date(
  p_property_id uuid,
  p_at timestamptz default now()
)
returns date
language plpgsql
stable
security invoker
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_timezone text:='America/Argentina/Buenos_Aires';
  v_cutoff integer:=12;
  v_raw_cutoff text;
  v_local timestamp without time zone;
begin
  select
    coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires'),
    nullif(settings->'preferences'->>'hotel_day_cutoff_hour','')
  into v_timezone,v_raw_cutoff
  from public.property_settings
  where property_id=p_property_id;

  v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');
  begin
    v_cutoff:=coalesce(v_raw_cutoff::integer,12);
  exception when others then
    v_cutoff:=12;
  end;
  v_cutoff:=least(23,greatest(0,v_cutoff));

  begin
    v_local:=p_at at time zone v_timezone;
  exception when others then
    v_local:=p_at at time zone 'America/Argentina/Buenos_Aires';
  end;

  return case
    when extract(hour from v_local)::integer<v_cutoff then v_local::date-1
    else v_local::date
  end;
end
$function$;

revoke execute on function public.hl_operational_date(uuid,timestamptz) from public,anon;
grant execute on function public.hl_operational_date(uuid,timestamptz) to authenticated,service_role;

do $migration$
declare
  v_def text;
  v_new text;
begin
  select pg_get_functiondef('public.hl_checkin_reservation_rooms_atomic(bigint,bigint[])'::regprocedure) into v_def;
  v_new:=replace(v_def,'if v.fecha_entrada>v_local_date then','v_local_date:=public.hl_operational_date(v.property_id,v_now);'||E'\n\n  if v.fecha_entrada>v_local_date then');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_checkin_reservation_rooms_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_checkout_reservation_atomic(bigint)'::regprocedure) into v_def;
  v_new:=replace(v_def,'v_room_ids:=case when v.habitaciones_ids','v_local_date:=public.hl_operational_date(v.property_id);v_room_ids:=case when v.habitaciones_ids');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_checkout_reservation_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_checkout_reservation_room_atomic(bigint,bigint)'::regprocedure) into v_def;
  v_new:=replace(v_def,'update public.hotel_reservation_guests set checked_out_at=coalesce','v_local_date:=public.hl_operational_date(v.property_id);'||E'\n update public.hotel_reservation_guests set checked_out_at=coalesce');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_checkout_reservation_room_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_checkout_reservation_guest_atomic(uuid)'::regprocedure) into v_def;
  v_new:=replace(v_def,'if g.checked_out_at is null then','v_local_date:=public.hl_operational_date(r.property_id);'||E'\n\n  if g.checked_out_at is null then');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_checkout_reservation_guest_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_cancel_group_room_atomic(bigint,bigint,date,numeric,boolean,text)'::regprocedure) into v_def;
  v_new:=replace(v_def,'v_effective:=coalesce(p_effective_date,case when v.estado=''alojado'' then v_local_date else v_start end);','v_local_date:=public.hl_operational_date(v.property_id);v_effective:=coalesce(p_effective_date,case when v.estado=''alojado'' then v_local_date else v_start end);');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_cancel_group_room_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_cancel_reservation_policy_atomic(bigint,text,text)'::regprocedure) into v_def;
  v_new:=replace(v_def,'perform private.hl_sync_reservation_folios_internal(v.id);','v_local_date:=public.hl_operational_date(v.property_id);'||E'\n   perform private.hl_sync_reservation_folios_internal(v.id);');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_cancel_reservation_policy_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text)'::regprocedure) into v_def;
  v_new:=replace(v_def,'v_scheduled:=p_effective_date>v_today;','v_scheduled:=false;');
  if v_new=v_def then raise exception 'No se pudo neutralizar fecha previa en hl_move_inhouse_room_segment_atomic'; end if;
  v_def:=v_new;
  v_new:=replace(v_def,'if not found then raise exception using errcode=''P0002'',message=''Reserva inexistente.''; end if;','if not found then raise exception using errcode=''P0002'',message=''Reserva inexistente.''; end if;'||E'\n  v_today:=public.hl_operational_date(v_before.property_id);'||E'\n  v_scheduled:=p_effective_date>v_today;');
  if v_new=v_def then raise exception 'No se pudo actualizar día operativo en hl_move_inhouse_room_segment_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('private.hl_materialize_due_room_moves()'::regprocedure) into v_def;
  v_new:=replace(v_def,'select x into d','v_local_date:=public.hl_operational_date(r.property_id);'||E'\n\n    select x into d');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_materialize_due_room_moves'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_mark_no_show_atomic(bigint,date,numeric,text,text)'::regprocedure) into v_def;
  v_new:=replace(v_def,'v_release:=coalesce(p_release_date,current_date);','v_release:=least(coalesce(p_release_date,public.hl_operational_date(v.property_id)),public.hl_operational_date(v.property_id),v.fecha_salida);');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_mark_no_show_atomic'; end if;
  execute v_new;

  select pg_get_functiondef('public.hl_mark_group_room_no_show_atomic(bigint,bigint,date,numeric,text,text)'::regprocedure) into v_def;
  v_new:=replace(v_def,'v_release:=coalesce(p_release_date,current_date);','v_release:=least(coalesce(p_release_date,public.hl_operational_date(v_before.property_id)),public.hl_operational_date(v_before.property_id));');
  if v_new=v_def then raise exception 'No se pudo actualizar hl_mark_group_room_no_show_atomic'; end if;
  execute v_new;
end
$migration$;
