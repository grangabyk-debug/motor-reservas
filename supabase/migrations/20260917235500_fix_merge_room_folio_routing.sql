-- Keep room-level folios consistent after reservation merges and preserve
-- room ownership for payments/documents migrated from the secondary reservation.

create or replace function private.hl_rehome_auto_room_folio_items(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  update public.hotel_folio_items i
  set folio_id=(
        select f.id
        from public.hotel_folios f
        where f.reservation_id=i.reservation_id
          and f.room_id=i.room_id
          and f.folio_type='room'
          and f.status<>'void'
        order by f.is_primary desc,f.sort_order,f.created_at
        limit 1
      ),
      updated_at=now()
  where i.reservation_id=p_reservation_id
    and i.status='active'
    and i.room_id is not null
    and (
      coalesce(i.metadata->>'auto_synced','false')='true'
      or i.source_type='lodging'
      or i.source_key like 'lodging:%'
      or i.source_key like 'reservation:adjustment:%'
    )
    and exists(
      select 1 from public.hotel_folios f
      where f.reservation_id=i.reservation_id
        and f.room_id=i.room_id
        and f.folio_type='room'
        and f.status<>'void'
        and f.id is distinct from i.folio_id
    );
end;
$function$;

create or replace function private.hl_sync_reservation_folios_internal(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare r public.reservas%rowtype; master_folio uuid; discount_title text;
begin
 perform private.hl_sync_reservation_folios_internal_legacy(p_reservation_id);
 select * into r from public.reservas where id=p_reservation_id;
 if not found then return; end if;

 update public.hotel_folio_items i
 set service_date=public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada),
     quantity=greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
     unit_price=coalesce((select nullif(e->>'tarifa_noche','')::numeric from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$' and (e->>'habitacion_id')::bigint=i.room_id limit 1),i.unit_price,0),
     detail=coalesce(r.regimen,'Alojamiento')||' · '||public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)::text||' → '||public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)::text,
     subtotal=coalesce((select nullif(e->>'tarifa_noche','')::numeric from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$' and (e->>'habitacion_id')::bigint=i.room_id limit 1),i.unit_price,0)*greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
     total=coalesce((select nullif(e->>'tarifa_noche','')::numeric from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$' and (e->>'habitacion_id')::bigint=i.room_id limit 1),i.unit_price,0)*greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
     metadata=coalesce(i.metadata,'{}'::jsonb)||jsonb_build_object('room_start',public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada),'room_end',public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)),
     updated_at=now()
 where i.reservation_id=p_reservation_id and i.source_type='lodging' and i.room_id is not null and i.invoice_document_id is null and coalesce(i.metadata->>'auto_synced','false')='true';

 update public.hotel_folio_items
 set status='void',updated_at=now()
 where reservation_id=p_reservation_id and source_type='adjustment' and source_key like 'reservation:adjustment%' and invoice_document_id is null and coalesce(metadata->>'auto_synced','false')='true';

 if coalesce(r.impuestos_desglosados,false) then
   update public.hotel_folio_items
   set tax_rate=coalesce(r.iva_porcentaje,0),
       tax=round(coalesce(subtotal,0)*coalesce(r.iva_porcentaje,0)/100,2),
       total=round(coalesce(subtotal,0)+(coalesce(subtotal,0)*coalesce(r.iva_porcentaje,0)/100),2),
       metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('tax_breakdown',true,'vat_rate',coalesce(r.iva_porcentaje,0),'tax_source','reservation_snapshot'),
       updated_at=now()
   where reservation_id=p_reservation_id and status='active' and source_type<>'adjustment' and invoice_document_id is null and coalesce(metadata->>'auto_synced','false')='true';
 else
   update public.hotel_folio_items
   set tax_rate=0,tax=0,total=coalesce(subtotal,0),
       metadata=coalesce(metadata,'{}'::jsonb)-'tax_breakdown'-'vat_rate'-'tax_source',
       updated_at=now()
   where reservation_id=p_reservation_id and status='active' and source_type<>'adjustment' and invoice_document_id is null and coalesce(metadata->>'auto_synced','false')='true';
 end if;

 if coalesce(r.descuento_importe,0)>0 then
   select id into master_folio from public.hotel_folios where reservation_id=p_reservation_id and folio_type='master' and status<>'void' order by sort_order,created_at limit 1;
   discount_title:=case when r.descuento_tipo in('percent','porcentaje') and coalesce(r.descuento_valor,0)>0 then 'Descuento '||trim(to_char(r.descuento_valor,'FM999999990.##'))||'%' else 'Descuento aplicado' end;
   update public.hotel_folio_items
   set folio_id=coalesce(master_folio,folio_id),
       room_id=case when master_folio is not null then null else room_id end,
       description=discount_title,
       detail=coalesce(nullif(trim(r.descuento_motivo,''),'Descuento ingresado manualmente en la reserva.')),
       metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('discount_type',r.descuento_tipo,'discount_value',r.descuento_valor,'discount_amount',r.descuento_importe,'discount_reason',r.descuento_motivo,'discount_origin',coalesce(r.descuento_origen,'manual'),'explicit_discount',true),
       updated_at=now()
   where reservation_id=p_reservation_id and source_key='legacy:discount' and invoice_document_id is null;
 end if;

 perform private.hl_rehome_auto_room_folio_items(p_reservation_id);
 perform private.hl_reconcile_reservation_rounding(p_reservation_id);
 perform private.hl_rehome_auto_room_folio_items(p_reservation_id);
end
$function$;

create or replace function public.hl_merge_reservations_atomic(p_primary_id bigint,p_secondary_id bigint)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_result public.reservas%rowtype;
begin
  create temporary table if not exists pg_temp.hl_merge_folio_map(
    kind text not null,
    record_id text not null,
    room_id bigint
  ) on commit drop;
  truncate pg_temp.hl_merge_folio_map;

  insert into pg_temp.hl_merge_folio_map(kind,record_id,room_id)
  select 'payment',p.id::text,f.room_id
  from public.pagos p join public.hotel_folios f on f.id=p.folio_id
  where p.reserva_id=p_secondary_id and f.room_id is not null;

  insert into pg_temp.hl_merge_folio_map(kind,record_id,room_id)
  select 'doc',d.id::text,f.room_id
  from public.hotel_finance_documents d join public.hotel_folios f on f.id=d.folio_id
  where d.reservation_id=p_secondary_id and f.room_id is not null;

  insert into pg_temp.hl_merge_folio_map(kind,record_id,room_id)
  select 'allocation',a.id::text,f.room_id
  from public.hotel_folio_payment_allocations a join public.hotel_folios f on f.id=a.folio_id
  where a.reservation_id=p_secondary_id and f.room_id is not null;

  insert into pg_temp.hl_merge_folio_map(kind,record_id,room_id)
  select 'item_allocation',a.id::text,f.room_id
  from public.hotel_folio_item_payment_allocations a join public.hotel_folios f on f.id=a.folio_id
  where a.reservation_id=p_secondary_id and f.room_id is not null;

  perform set_config('app.hl_merge_secondary_id',p_secondary_id::text,true);
  v_result:=public.hl_merge_reservations_atomic_impl_v1(p_primary_id,p_secondary_id);
  perform set_config('app.hl_merge_secondary_id','',true);

  perform private.hl_sync_reservation_folios_internal(p_primary_id);

  update public.pagos p
  set folio_id=(
        select f2.id from public.hotel_folios f2
        where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void'
        order by f2.sort_order,f2.created_at limit 1
      ),
      updated_at=now()
  from pg_temp.hl_merge_folio_map m
  where m.kind='payment' and p.id::text=m.record_id
    and exists(select 1 from public.hotel_folios f2 where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void');

  update public.hotel_finance_documents d
  set folio_id=(
        select f2.id from public.hotel_folios f2
        where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void'
        order by f2.sort_order,f2.created_at limit 1
      ),
      updated_at=now()
  from pg_temp.hl_merge_folio_map m
  where m.kind='doc' and d.id::text=m.record_id
    and exists(select 1 from public.hotel_folios f2 where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void');

  update public.hotel_folio_payment_allocations a
  set folio_id=(
        select f2.id from public.hotel_folios f2
        where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void'
        order by f2.sort_order,f2.created_at limit 1
      ),
      updated_at=now()
  from pg_temp.hl_merge_folio_map m
  where m.kind='allocation' and a.id::text=m.record_id
    and exists(select 1 from public.hotel_folios f2 where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void');

  update public.hotel_folio_item_payment_allocations a
  set folio_id=(
        select f2.id from public.hotel_folios f2
        where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void'
        order by f2.sort_order,f2.created_at limit 1
      )
  from pg_temp.hl_merge_folio_map m
  where m.kind='item_allocation' and a.id::text=m.record_id
    and exists(select 1 from public.hotel_folios f2 where f2.reservation_id=p_primary_id and f2.room_id=m.room_id and f2.folio_type='room' and f2.status<>'void');

  perform private.hl_rehome_auto_room_folio_items(p_primary_id);
  select * into v_result from public.reservas where id=p_primary_id;
  return v_result;
exception when others then
  perform set_config('app.hl_merge_secondary_id','',true);
  raise;
end
$function$;

do $repair$
declare rid bigint;
begin
  for rid in
    select distinct i.reservation_id
    from public.hotel_folio_items i
    join public.hotel_folios f on f.id=i.folio_id
    where i.status='active'
      and i.room_id is not null
      and f.folio_type='room'
      and f.room_id is distinct from i.room_id
  loop
    perform private.hl_sync_reservation_folios_internal(rid);
  end loop;
end
$repair$;
