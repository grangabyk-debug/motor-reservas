alter table public.hotel_group_quotes
  add column if not exists follow_up_at timestamptz,
  add column if not exists follow_up_channel text,
  add column if not exists follow_up_status text not null default 'none',
  add column if not exists follow_up_note text,
  add column if not exists last_contacted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='hotel_group_quotes_follow_up_status_check'
      and conrelid='public.hotel_group_quotes'::regclass
  ) then
    alter table public.hotel_group_quotes
      add constraint hotel_group_quotes_follow_up_status_check
      check (follow_up_status in ('none','pending','done','cancelled'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='hotel_group_quotes_follow_up_channel_check'
      and conrelid='public.hotel_group_quotes'::regclass
  ) then
    alter table public.hotel_group_quotes
      add constraint hotel_group_quotes_follow_up_channel_check
      check (follow_up_channel is null or follow_up_channel in ('email','whatsapp','phone','other'));
  end if;
end $$;

create index if not exists hotel_group_quotes_follow_up_due_idx
  on public.hotel_group_quotes(property_id,follow_up_at)
  where follow_up_status='pending' and follow_up_at is not null;

create or replace function public.hl_block_room_atomic(
  p_habitacion_id bigint,
  p_fecha_desde date,
  p_fecha_hasta date,
  p_motivo text default 'Bloqueo operativo'::text,
  p_detalle text default null::text
)
returns public.bloqueos
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_property uuid;
  v_user uuid := auth.uid();
  v_block public.bloqueos;
begin
  if v_user is null then raise exception 'Sesión requerida'; end if;
  if p_fecha_hasta <= p_fecha_desde then raise exception 'Rango de bloqueo inválido'; end if;

  select property_id into v_property
  from public.habitaciones
  where id=p_habitacion_id
  for update;

  if v_property is null then raise exception 'Habitación inexistente'; end if;
  if not private.user_has_property_role(v_property,array['owner','manager','reception','housekeeping']::text[]) then
    raise exception 'Sin permisos';
  end if;

  perform pg_advisory_xact_lock(p_habitacion_id);

  if exists (
    select 1
    from public.reservas r
    where r.property_id=v_property
      and r.estado not in ('cancelada','fusionada')
      and coalesce(r.no_show,false)=false
      and (r.checkout_real_at is null or r.estado <> 'finalizada')
      and (r.habitacion_id=p_habitacion_id or p_habitacion_id=any(coalesce(r.habitaciones_ids,'{}'::bigint[])))
      and p_fecha_desde < public.hl_reservation_room_effective_end_date(
        r.habitaciones_detalle,r.room_checkout_dates,p_habitacion_id,r.fecha_salida
      )
      and p_fecha_hasta > public.hl_reservation_room_start_date(
        r.habitaciones_detalle,p_habitacion_id,r.fecha_entrada
      )
  ) then
    raise exception using errcode='23P01', message='El bloqueo invade una reserva activa';
  end if;

  insert into public.bloqueos(property_id,user_id,habitacion_id,fecha_desde,fecha_hasta,motivo,detalle)
  values(
    v_property,v_user,p_habitacion_id,p_fecha_desde,p_fecha_hasta,
    coalesce(nullif(trim(p_motivo),''),'Bloqueo operativo'),p_detalle
  )
  returning * into v_block;

  return v_block;
end;
$function$;

create or replace function private.hl_freeze_room_change_source_folio(
  p_reservation_id bigint,
  p_room_id bigint
)
returns uuid
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  r public.reservas%rowtype;
  v_folio uuid;
  v_room_name text;
begin
  select * into r from public.reservas where id=p_reservation_id;
  if not found then return null; end if;

  perform private.hl_sync_reservation_folios_internal(p_reservation_id);
  perform private.hl_apply_room_change_financial_folios_internal(p_reservation_id);

  select h.nombre into v_room_name
  from public.habitaciones h
  where h.id=p_room_id and h.property_id=r.property_id;

  select id into v_folio
  from public.hotel_folios
  where reservation_id=p_reservation_id
    and room_id=p_room_id
    and folio_type='room'
    and status<>'void'
  order by is_primary desc,sort_order,created_at
  limit 1;

  if v_folio is null then
    insert into public.hotel_folios(
      property_id,reservation_id,room_id,folio_type,label,payer_type,payer_name,
      currency,status,is_primary,sort_order
    )
    values(
      r.property_id,r.id,p_room_id,'room',
      'Habitación '||coalesce(v_room_name,p_room_id::text),'guest',
      r.nombre_huesped,r.moneda,'open',true,
      coalesce((select max(sort_order)+1 from public.hotel_folios where reservation_id=r.id),1)
    )
    returning id into v_folio;
  end if;

  update public.hotel_folio_items
  set source_key='room-change-base:'||p_room_id::text||':'||id::text,
      metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'auto_synced',false,
        'room_change_base_frozen',true,
        'financial_room_id',p_room_id,
        'original_source_key',source_key
      ),
      updated_at=now()
  where reservation_id=p_reservation_id
    and room_id=p_room_id
    and source_type='lodging'
    and source_key='lodging:'||p_room_id::text
    and status='active'
    and invoice_document_id is null
    and coalesce(metadata->>'auto_synced','false')='true';

  return v_folio;
end;
$function$;
