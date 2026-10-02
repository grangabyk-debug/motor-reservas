create or replace function private.hl_rebalance_split_payment_allocations(
  p_reservation_id bigint,
  p_source_room_id bigint,
  p_target_room_id bigint
)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_source_folio uuid;
  v_target_folio uuid;
  v_source_lodging_item uuid;
  v_target_lodging_item uuid;
  v_source_charges numeric:=0;
  v_source_payments numeric:=0;
  v_target_charges numeric:=0;
  v_target_payments numeric:=0;
  v_transfer numeric:=0;
  v_move numeric:=0;
  v_source_nominal numeric:=0;
  v_new_allocations jsonb;
  v_alloc record;
  v_payment public.pagos%rowtype;
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

  select id into v_source_lodging_item
  from public.hotel_folio_items
  where folio_id=v_source_folio and status='active'
    and lower(coalesce(source_type,''))='lodging'
  order by created_at,id limit 1;

  select id into v_target_lodging_item
  from public.hotel_folio_items
  where folio_id=v_target_folio and status='active'
    and lower(coalesce(source_type,''))='lodging'
  order by created_at,id limit 1;

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
      select a.*
      from public.hotel_folio_payment_allocations a
      left join public.pagos p on p.id=a.payment_id
      where a.folio_id=v_source_folio and a.amount>0
      order by
        case when v_source_lodging_item is not null
          and jsonb_typeof(coalesce(p.charge_allocations,'[]'::jsonb))='array'
          and exists(
            select 1 from jsonb_array_elements(coalesce(p.charge_allocations,'[]'::jsonb)) e
            where e->>'folio_item_id'=v_source_lodging_item::text
              and coalesce(nullif(e->>'amount','')::numeric,0)>.009
          )
        then 0 else 1 end,
        a.created_at desc,a.id
      for update of a
    loop
      exit when v_transfer<=.009;

      select * into v_payment
      from public.pagos
      where id=v_alloc.payment_id
      for update;

      v_source_nominal:=0;
      if v_source_lodging_item is not null
         and v_target_lodging_item is not null
         and v_payment.id is not null
         and jsonb_typeof(coalesce(v_payment.charge_allocations,'[]'::jsonb))='array'
         and jsonb_array_length(coalesce(v_payment.charge_allocations,'[]'::jsonb))>0
      then
        select coalesce(sum(coalesce(nullif(e->>'amount','')::numeric,0)),0)
        into v_source_nominal
        from jsonb_array_elements(v_payment.charge_allocations) e
        where e->>'folio_item_id'=v_source_lodging_item::text;

        v_move:=least(v_transfer,v_alloc.amount,v_source_nominal);

        if v_move>.009 then
          with entries as (
            select e->>'folio_item_id' as item_id,
                   greatest(0,coalesce(nullif(e->>'amount','')::numeric,0)) as amount
            from jsonb_array_elements(v_payment.charge_allocations) e
          ),
          shifted as (
            select item_id,
                   case when item_id=v_source_lodging_item::text
                        then greatest(0,amount-v_move)
                        else amount end as amount
            from entries
            union all
            select v_target_lodging_item::text,v_move
          ),
          grouped as (
            select item_id,round(sum(amount),2) as amount
            from shifted
            group by item_id
          )
          select coalesce(
            jsonb_agg(
              jsonb_build_object('folio_item_id',item_id,'amount',amount)
              order by item_id
            ) filter(where amount>.009),
            '[]'::jsonb
          )
          into v_new_allocations
          from grouped;

          update public.pagos
          set charge_allocations=v_new_allocations
          where id=v_payment.id;

          v_transfer:=round(v_transfer-v_move,2);
          continue;
        end if;
      end if;

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

      v_transfer:=round(v_transfer-v_move,2);
    end loop;
  end if;

  perform private.hl_rebuild_item_payment_allocations_from_folios(p_reservation_id);
end;
$$;
