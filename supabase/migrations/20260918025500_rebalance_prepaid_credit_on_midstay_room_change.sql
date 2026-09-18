create or replace function private.hl_rebalance_split_payment_allocations(
  p_reservation_id bigint,
  p_source_room_id bigint,
  p_target_room_id bigint
)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_source_folio uuid;
  v_target_folio uuid;
  v_source_charges numeric:=0;
  v_source_payments numeric:=0;
  v_target_charges numeric:=0;
  v_target_payments numeric:=0;
  v_transfer numeric:=0;
  v_move numeric:=0;
  v_alloc record;
begin
  select id into v_source_folio from public.hotel_folios
  where reservation_id=p_reservation_id and room_id=p_source_room_id
    and folio_type='room' and status<>'void'
  order by created_at limit 1;

  select id into v_target_folio from public.hotel_folios
  where reservation_id=p_reservation_id and room_id=p_target_room_id
    and folio_type='room' and status<>'void'
  order by created_at limit 1;

  if v_source_folio is null or v_target_folio is null then return; end if;

  select coalesce(sum(total),0) into v_source_charges
  from public.hotel_folio_items where folio_id=v_source_folio and status='active';

  select coalesce(sum(amount),0) into v_source_payments
  from public.hotel_folio_payment_allocations where folio_id=v_source_folio;

  select coalesce(sum(total),0) into v_target_charges
  from public.hotel_folio_items where folio_id=v_target_folio and status='active';

  select coalesce(sum(amount),0) into v_target_payments
  from public.hotel_folio_payment_allocations where folio_id=v_target_folio;

  v_transfer:=least(
    greatest(0,v_source_payments-v_source_charges),
    greatest(0,v_target_charges-v_target_payments)
  );

  if v_transfer<=.009 then return; end if;

  for v_alloc in
    select * from public.hotel_folio_payment_allocations
    where folio_id=v_source_folio and amount>0
    order by created_at desc,id
    for update
  loop
    exit when v_transfer<=.009;
    v_move:=least(v_transfer,v_alloc.amount);

    if v_alloc.amount-v_move<=.009 then
      delete from public.hotel_folio_payment_allocations where id=v_alloc.id;
    else
      update public.hotel_folio_payment_allocations
      set amount=round(amount-v_move,2),updated_at=now()
      where id=v_alloc.id;
    end if;

    insert into public.hotel_folio_payment_allocations(
      property_id,reservation_id,folio_id,payment_id,amount,currency,source,created_by
    ) values(
      v_alloc.property_id,v_alloc.reservation_id,v_target_folio,v_alloc.payment_id,
      round(v_move,2),v_alloc.currency,v_alloc.source,v_alloc.created_by
    )
    on conflict(payment_id,folio_id) do update
    set amount=public.hotel_folio_payment_allocations.amount+excluded.amount,
        updated_at=now();

    v_transfer:=v_transfer-v_move;
  end loop;
end;
$function$;

do $patch$
declare
  v_def text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.hl_move_inhouse_room_segment_atomic(bigint,bigint,bigint,date,boolean,text)'::regprocedure) into v_def;
  if position('hl_rebalance_split_payment_allocations' in v_def)=0 then
    v_old:='  perform private.hl_sync_reservation_folios_internal(v_after.id);';
    v_new:=v_old||chr(10)||'  perform private.hl_rebalance_split_payment_allocations(v_after.id,p_from_room_id,p_to_room_id);';
    if position(v_old in v_def)=0 then raise exception 'No se encontró sincronización de folios en hl_move_inhouse_room_segment_atomic'; end if;
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;

  select pg_get_functiondef('public.hl_move_inhouse_group_room_segment_atomic(bigint,bigint,bigint,date,boolean)'::regprocedure) into v_def;
  if position('hl_rebalance_split_payment_allocations' in v_def)=0 then
    v_old:='  perform private.hl_sync_reservation_folios_internal(v_after.id);';
    v_new:=v_old||chr(10)||'  perform private.hl_rebalance_split_payment_allocations(v_after.id,p_from_room_id,p_to_room_id);';
    if position(v_old in v_def)=0 then raise exception 'No se encontró sincronización de folios en hl_move_inhouse_group_room_segment_atomic'; end if;
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;
end
$patch$;
