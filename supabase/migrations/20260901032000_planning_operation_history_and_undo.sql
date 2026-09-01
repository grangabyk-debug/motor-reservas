create table if not exists public.hotel_planning_operation_log (
  id uuid primary key default gen_random_uuid(),
  operation_group uuid not null,
  property_id uuid not null references public.properties(id) on delete cascade,
  action text not null check (action in ('move','resize','change_room','swap')),
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  before_state jsonb not null,
  after_state jsonb not null,
  meta jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users(id) on delete set null
);

create unique index if not exists hotel_planning_operation_log_group_reservation_uidx
  on public.hotel_planning_operation_log(operation_group,reservation_id);
create index if not exists hotel_planning_operation_log_property_created_idx
  on public.hotel_planning_operation_log(property_id,created_at desc);
create index if not exists hotel_planning_operation_log_reservation_idx
  on public.hotel_planning_operation_log(reservation_id,created_at desc);

alter table public.hotel_planning_operation_log enable row level security;

drop policy if exists hotel_planning_operation_log_select_access on public.hotel_planning_operation_log;
create policy hotel_planning_operation_log_select_access
on public.hotel_planning_operation_log for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_planning_operation_log_insert_staff on public.hotel_planning_operation_log;
create policy hotel_planning_operation_log_insert_staff
on public.hotel_planning_operation_log for insert to authenticated
with check (
  created_by=(select auth.uid())
  and private.user_has_property_role(property_id,array['owner','admin','manager','reception']::text[])
);

drop policy if exists hotel_planning_operation_log_update_staff on public.hotel_planning_operation_log;
create policy hotel_planning_operation_log_update_staff
on public.hotel_planning_operation_log for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','reception']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager','reception']::text[]));

create or replace function private.hl_planning_reservation_state(p public.reservas)
returns jsonb
language sql
stable
set search_path to 'public','private','pg_temp'
as $function$
  select jsonb_build_object(
    'habitacion_id',p.habitacion_id,
    'alojamiento_id',p.alojamiento_id,
    'habitaciones_ids',to_jsonb(p.habitaciones_ids),
    'habitaciones_detalle',p.habitaciones_detalle,
    'fecha_entrada',p.fecha_entrada,
    'fecha_salida',p.fecha_salida,
    'noches',p.noches,
    'tarifa_noche',p.tarifa_noche,
    'subtotal',p.subtotal,
    'descuento_importe',p.descuento_importe,
    'precio_total',p.precio_total,
    'precio_total_usd',p.precio_total_usd,
    'no_show',coalesce(p.no_show,false)
  );
$function$;

create or replace function public.hl_planning_move_reservation_atomic(
  p_reserva_id bigint,
  p_habitacion_id bigint,
  p_fecha_entrada date,
  p_fecha_salida date default null
)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_group uuid:=gen_random_uuid();
  v_action text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para operar el Planning.';
  end if;
  v_action:=case when p_habitacion_id=v_before.habitacion_id and p_fecha_entrada=v_before.fecha_entrada and p_fecha_salida is not null and p_fecha_salida is distinct from v_before.fecha_salida then 'resize' else 'move' end;
  v_after:=public.hl_move_reservation_atomic(p_reserva_id,p_habitacion_id,p_fecha_entrada,p_fecha_salida);
  insert into public.hotel_planning_operation_log(operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by)
  values(v_group,v_before.property_id,v_action,v_before.id,private.hl_planning_reservation_state(v_before),private.hl_planning_reservation_state(v_after),jsonb_build_object('guest',v_before.nombre_huesped,'code',v_before.numero_reserva),auth.uid());
  return v_after;
end;
$function$;

create or replace function public.hl_planning_change_room_atomic(
  p_reserva_id bigint,
  p_habitacion_id bigint,
  p_reprice boolean default false
)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_before public.reservas%rowtype;
  v_after public.reservas%rowtype;
  v_group uuid:=gen_random_uuid();
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v_before from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para operar el Planning.';
  end if;
  v_after:=public.hl_change_reservation_room_atomic(p_reserva_id,p_habitacion_id,p_reprice);
  insert into public.hotel_planning_operation_log(operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by)
  values(v_group,v_before.property_id,'change_room',v_before.id,private.hl_planning_reservation_state(v_before),private.hl_planning_reservation_state(v_after),jsonb_build_object('guest',v_before.nombre_huesped,'code',v_before.numero_reserva,'reprice',p_reprice),auth.uid());
  return v_after;
end;
$function$;

create or replace function public.hl_planning_swap_reservations_atomic(p_reserva_a bigint,p_reserva_b bigint)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  a_before public.reservas%rowtype;
  b_before public.reservas%rowtype;
  a_after public.reservas%rowtype;
  b_after public.reservas%rowtype;
  v_result jsonb;
  v_group uuid:=gen_random_uuid();
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into a_before from public.reservas where id=p_reserva_a;
  select * into b_before from public.reservas where id=p_reserva_b;
  if a_before.id is null or b_before.id is null then raise exception using errcode='P0002',message='No pudimos encontrar una de las reservas.'; end if;
  if a_before.property_id is distinct from b_before.property_id then raise exception using errcode='22023',message='Las reservas deben pertenecer al mismo hotel.'; end if;
  if not private.user_has_property_role(a_before.property_id,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para operar el Planning.';
  end if;
  v_result:=public.hl_swap_reservations_atomic(p_reserva_a,p_reserva_b);
  select * into a_after from public.reservas where id=p_reserva_a;
  select * into b_after from public.reservas where id=p_reserva_b;
  insert into public.hotel_planning_operation_log(operation_group,property_id,action,reservation_id,before_state,after_state,meta,created_by)
  values
    (v_group,a_before.property_id,'swap',a_before.id,private.hl_planning_reservation_state(a_before),private.hl_planning_reservation_state(a_after),jsonb_build_object('guest',a_before.nombre_huesped,'other_reservation_id',b_before.id),auth.uid()),
    (v_group,b_before.property_id,'swap',b_before.id,private.hl_planning_reservation_state(b_before),private.hl_planning_reservation_state(b_after),jsonb_build_object('guest',b_before.nombre_huesped,'other_reservation_id',a_before.id),auth.uid());
  return v_result||jsonb_build_object('operation_group',v_group);
end;
$function$;

create or replace function public.hl_undo_planning_operation_atomic(p_operation_group uuid)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_log public.hotel_planning_operation_log%rowtype;
  v_current public.reservas%rowtype;
  v_property uuid;
  v_count integer;
  v_ids bigint[];
  v_restored integer:=0;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select property_id,count(*),array_agg(reservation_id order by reservation_id)
    into v_property,v_count,v_ids
  from public.hotel_planning_operation_log
  where operation_group=p_operation_group and undone_at is null
  group by property_id;
  if v_property is null then raise exception using errcode='P0002',message='La operación ya fue deshecha o no existe.'; end if;
  if not private.user_has_property_role(v_property,array['owner','admin','manager','reception']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para deshacer esta operación.';
  end if;

  perform 1 from public.reservas where id=any(v_ids) order by id for update;

  for v_log in
    select * from public.hotel_planning_operation_log
    where operation_group=p_operation_group and undone_at is null
    order by reservation_id
  loop
    select * into v_current from public.reservas where id=v_log.reservation_id;
    if private.hl_planning_reservation_state(v_current) is distinct from v_log.after_state then
      raise exception using errcode='40001',message='No se puede deshacer: una de las reservas cambió después de esta operación.';
    end if;
  end loop;

  if v_count>1 then
    update public.reservas set no_show=true where id=any(v_ids);
  end if;

  for v_log in
    select * from public.hotel_planning_operation_log
    where operation_group=p_operation_group and undone_at is null
    order by reservation_id
  loop
    update public.reservas
    set habitacion_id=nullif(v_log.before_state->>'habitacion_id','')::bigint,
        alojamiento_id=nullif(v_log.before_state->>'alojamiento_id','')::bigint,
        habitaciones_ids=case when jsonb_typeof(v_log.before_state->'habitaciones_ids')='array' then array(select value::bigint from jsonb_array_elements_text(v_log.before_state->'habitaciones_ids')) else null end,
        habitaciones_detalle=v_log.before_state->'habitaciones_detalle',
        fecha_entrada=nullif(v_log.before_state->>'fecha_entrada','')::date,
        fecha_salida=nullif(v_log.before_state->>'fecha_salida','')::date,
        noches=nullif(v_log.before_state->>'noches','')::integer,
        tarifa_noche=nullif(v_log.before_state->>'tarifa_noche','')::numeric,
        subtotal=nullif(v_log.before_state->>'subtotal','')::numeric,
        descuento_importe=nullif(v_log.before_state->>'descuento_importe','')::numeric,
        precio_total=nullif(v_log.before_state->>'precio_total','')::numeric,
        precio_total_usd=nullif(v_log.before_state->>'precio_total_usd','')::numeric,
        no_show=case when v_count>1 then true else coalesce((v_log.before_state->>'no_show')::boolean,false) end
    where id=v_log.reservation_id;
    v_restored:=v_restored+1;
  end loop;

  if v_count>1 then
    update public.reservas r
    set no_show=coalesce((l.before_state->>'no_show')::boolean,false)
    from public.hotel_planning_operation_log l
    where l.operation_group=p_operation_group and l.reservation_id=r.id and r.id=any(v_ids);
  end if;

  update public.hotel_planning_operation_log
  set undone_at=now(),undone_by=auth.uid()
  where operation_group=p_operation_group and undone_at is null;

  return jsonb_build_object('operation_group',p_operation_group,'restored',v_restored);
end;
$function$;

revoke all on function public.hl_planning_move_reservation_atomic(bigint,bigint,date,date) from public;
revoke all on function public.hl_planning_change_room_atomic(bigint,bigint,boolean) from public;
revoke all on function public.hl_planning_swap_reservations_atomic(bigint,bigint) from public;
revoke all on function public.hl_undo_planning_operation_atomic(uuid) from public;
revoke execute on function public.hl_planning_move_reservation_atomic(bigint,bigint,date,date) from anon;
revoke execute on function public.hl_planning_change_room_atomic(bigint,bigint,boolean) from anon;
revoke execute on function public.hl_planning_swap_reservations_atomic(bigint,bigint) from anon;
revoke execute on function public.hl_undo_planning_operation_atomic(uuid) from anon;
grant execute on function public.hl_planning_move_reservation_atomic(bigint,bigint,date,date) to authenticated;
grant execute on function public.hl_planning_change_room_atomic(bigint,bigint,boolean) to authenticated;
grant execute on function public.hl_planning_swap_reservations_atomic(bigint,bigint) to authenticated;
grant execute on function public.hl_undo_planning_operation_atomic(uuid) to authenticated;
