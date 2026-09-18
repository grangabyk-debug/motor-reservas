create or replace function private.hl_rebuild_item_payment_allocations_from_folios(
  p_reservation_id bigint
)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_alloc record;
  v_item record;
  v_left numeric;
  v_take numeric;
begin
  delete from public.hotel_folio_item_payment_allocations
  where reservation_id=p_reservation_id;

  for v_alloc in
    select a.*
    from public.hotel_folio_payment_allocations a
    where a.reservation_id=p_reservation_id
      and a.amount>.009
    order by a.created_at,a.id
  loop
    v_left:=v_alloc.amount;

    for v_item in
      select i.id,i.folio_id,i.total
      from public.hotel_folio_items i
      where i.reservation_id=p_reservation_id
        and i.folio_id=v_alloc.folio_id
        and i.status='active'
        and i.total>.009
      order by i.created_at,i.id
    loop
      exit when v_left<=.009;
      v_take:=least(v_left,greatest(0,v_item.total));
      if v_take>.009 then
        insert into public.hotel_folio_item_payment_allocations(
          property_id,reservation_id,folio_id,folio_item_id,payment_id,
          amount,currency,source,created_by
        ) values(
          v_alloc.property_id,v_alloc.reservation_id,v_alloc.folio_id,v_item.id,
          v_alloc.payment_id,round(v_take,2),v_alloc.currency,'room_change_rebuild',v_alloc.created_by
        )
        on conflict(payment_id,folio_item_id) do update
        set amount=excluded.amount,folio_id=excluded.folio_id,currency=excluded.currency,source=excluded.source;
        v_left:=round(v_left-v_take,2);
      end if;
    end loop;
  end loop;
end;
$function$;

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
  select id into v_source_folio
  from public.hotel_folios
  where reservation_id=p_reservation_id and room_id=p_source_room_id
    and folio_type='room' and status<>'void'
  order by created_at limit 1;

  select id into v_target_folio
  from public.hotel_folios
  where reservation_id=p_reservation_id and room_id=p_target_room_id
    and folio_type='room' and status<>'void'
  order by created_at limit 1;

  if v_source_folio is null or v_target_folio is null then
    perform private.hl_rebuild_item_payment_allocations_from_folios(p_reservation_id);
    return;
  end if;

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

  if v_transfer>.009 then
    for v_alloc in
      select *
      from public.hotel_folio_payment_allocations
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
  end if;

  perform private.hl_rebuild_item_payment_allocations_from_folios(p_reservation_id);
end;
$function$;
