begin;

create table if not exists public.hotel_reservation_operation_discounts(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  operation_type text not null,
  discount_type text not null check(discount_type in('percent','amount')),
  discount_value numeric not null check(discount_value>0),
  net_amount numeric not null check(net_amount>0),
  final_amount numeric not null check(final_amount>0),
  reason text,
  room_ids bigint[] not null default array[]::bigint[],
  start_date date,
  end_date date,
  currency text not null default 'ARS',
  metadata jsonb not null default '{}'::jsonb,
  status text not null default 'active' check(status in('active','void')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_reservation_operation_discounts_reservation_idx on public.hotel_reservation_operation_discounts(reservation_id,status,created_at);
alter table public.hotel_reservation_operation_discounts enable row level security;
drop policy if exists hotel_reservation_operation_discounts_read on public.hotel_reservation_operation_discounts;
create policy hotel_reservation_operation_discounts_read on public.hotel_reservation_operation_discounts for select to authenticated using(private.user_has_property_role(property_id,array['owner','admin','manager','reception']::text[]));

create or replace function private.hl_sync_operation_discounts_to_folios(p_reservation_id bigint)
returns void language plpgsql security definer set search_path to 'public','private','pg_temp'
as $$
declare r public.reservas%rowtype;master_folio uuid;rec record;title text;
begin
  select * into r from public.reservas where id=p_reservation_id;if not found then return;end if;
  select id into master_folio from public.hotel_folios where reservation_id=p_reservation_id and folio_type='master' and status<>'void' order by sort_order,created_at limit 1;
  if master_folio is null then return;end if;
  update public.hotel_folio_items i set status='void',updated_at=now()
  where i.reservation_id=p_reservation_id and i.source_type='discount' and i.source_key like 'operation-discount:%' and i.invoice_document_id is null
    and not exists(select 1 from public.hotel_reservation_operation_discounts od where od.reservation_id=p_reservation_id and od.status='active' and i.source_key='operation-discount:'||od.id::text);
  for rec in select * from public.hotel_reservation_operation_discounts where reservation_id=p_reservation_id and status='active' order by created_at loop
    title:=case when rec.discount_type='percent' then 'Descuento extensión '||trim(to_char(rec.discount_value,'FM999999990.##'))||'%' else 'Descuento extensión' end;
    update public.hotel_folio_items set folio_id=master_folio,room_id=null,status='active',description=title,detail=coalesce(nullif(trim(rec.reason),''),'Descuento aplicado a la extensión'),service_date=coalesce(rec.start_date,r.fecha_entrada),quantity=1,unit_price=-rec.net_amount,discount=0,tax_rate=case when coalesce(r.impuestos_desglosados,false) then coalesce(r.iva_porcentaje,0) else 0 end,subtotal=-rec.net_amount,tax=case when coalesce(r.impuestos_desglosados,false) then -(rec.final_amount-rec.net_amount) else 0 end,total=-rec.final_amount,currency=rec.currency,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('auto_synced',true,'operation_discount',true,'operation_discount_id',rec.id,'operation_type',rec.operation_type,'discount_type',rec.discount_type,'discount_value',rec.discount_value,'room_ids',rec.room_ids,'start_date',rec.start_date,'end_date',rec.end_date),updated_at=now()
    where reservation_id=p_reservation_id and source_key='operation-discount:'||rec.id::text and invoice_document_id is null;
    if not found then insert into public.hotel_folio_items(property_id,folio_id,reservation_id,room_id,source_type,source_key,description,detail,service_date,quantity,unit_price,discount,tax_rate,tax,subtotal,total,currency,status,metadata,created_by)
      values(r.property_id,master_folio,r.id,null,'discount','operation-discount:'||rec.id::text,title,coalesce(nullif(trim(rec.reason),''),'Descuento aplicado a la extensión'),coalesce(rec.start_date,r.fecha_entrada),1,-rec.net_amount,0,case when coalesce(r.impuestos_desglosados,false) then coalesce(r.iva_porcentaje,0) else 0 end,case when coalesce(r.impuestos_desglosados,false) then -(rec.final_amount-rec.net_amount) else 0 end,-rec.net_amount,-rec.final_amount,rec.currency,'active',jsonb_build_object('auto_synced',true,'operation_discount',true,'operation_discount_id',rec.id,'operation_type',rec.operation_type,'discount_type',rec.discount_type,'discount_value',rec.discount_value,'room_ids',rec.room_ids,'start_date',rec.start_date,'end_date',rec.end_date),rec.created_by);
    end if;
  end loop;
end;
$$;

create or replace function public.hl_extend_group_rooms_with_custom_discount_atomic(p_reserva_id bigint,p_room_ids bigint[],p_new_end date,p_discount_type text default null,p_discount_value numeric default 0,p_discount_reason text default null)
returns public.reservas language plpgsql security definer set search_path to 'public','private','pg_temp'
as $$
declare before_row public.reservas%rowtype;r public.reservas%rowtype;dtype text:=lower(trim(coalesce(p_discount_type,'')));dvalue numeric:=greatest(0,coalesce(p_discount_value,0));extension_net numeric:=0;extension_final numeric:=0;discount_net numeric:=0;discount_final numeric:=0;vat_rate numeric:=0;next_net numeric:=0;next_vat numeric:=0;next_total numeric:=0;start_date date;discount_id uuid;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;
  select * into before_row from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;
  if dtype not in('','none','percent','amount') then raise exception using errcode='22023',message='Tipo de descuento inválido.';end if;
  select min(public.hl_reservation_room_planned_end_date(before_row.habitaciones_detalle,x,before_row.fecha_salida)) into start_date from unnest(coalesce(p_room_ids,array[]::bigint[])) x;
  r:=public.hl_extend_group_rooms_with_plan_atomic(p_reserva_id,p_room_ids,p_new_end);
  if dtype in('','none') or dvalue<=0 then return r;end if;
  select coalesce(sum(greatest(0,coalesce(nullif(e->>'extension_net_total','')::numeric,0))),0) into extension_net from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=any(coalesce(p_room_ids,array[]::bigint[])) and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');
  vat_rate:=case when coalesce(r.impuestos_desglosados,false) then greatest(0,coalesce(r.iva_porcentaje,0)) else 0 end;extension_final:=round(extension_net*(1+vat_rate/100),2);
  if extension_net<=0 then raise exception using errcode='22023',message='No se pudo calcular el importe de las noches nuevas.';end if;
  if dtype='percent' then if dvalue>100 then raise exception using errcode='22023',message='El descuento porcentual no puede superar 100%.';end if;discount_net:=round(extension_net*dvalue/100,6);discount_final:=round(extension_final*dvalue/100,2);else discount_final:=least(extension_final,round(dvalue,2));discount_net:=case when vat_rate>0 then round(discount_final/(1+vat_rate/100),6) else discount_final end;end if;
  next_net:=greatest(0,round(coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,r.precio_total,0)-discount_net,2));next_vat:=case when vat_rate>0 then round(next_net*vat_rate/100,2) else 0 end;next_total:=round(next_net+next_vat,2);
  update public.reservas set subtotal=next_net,precio_sin_impuestos_nacionales=next_net,iva_importe=next_vat,precio_total=next_total,precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(next_total/tipo_cambio,2) else precio_total_usd end where id=r.id returning * into r;
  insert into public.hotel_reservation_operation_discounts(property_id,reservation_id,operation_type,discount_type,discount_value,net_amount,final_amount,reason,room_ids,start_date,end_date,currency,metadata,created_by)
  values(r.property_id,r.id,'extension',dtype,dvalue,discount_net,discount_final,coalesce(nullif(trim(p_discount_reason),''),'Descuento en extensión'),coalesce(p_room_ids,array[]::bigint[]),start_date,p_new_end,r.moneda,jsonb_build_object('extension_net',extension_net,'extension_final',extension_final),auth.uid()) returning id into discount_id;
  perform private.hl_sync_reservation_folios_internal(r.id);perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(r.property_id,r.id,'extension_discount','Descuento en extensión',format('%s aplicado sobre las noches nuevas.',case when dtype='percent' then trim(to_char(dvalue,'FM999990.##'))||'%' else r.moneda||' '||trim(to_char(discount_final,'FM999999990.00')) end),jsonb_build_object('discount_id',discount_id,'discount_type',dtype,'discount_value',dvalue,'discount_net',discount_net,'discount_final',discount_final,'extension_final',extension_final,'room_ids',coalesce(p_room_ids,array[]::bigint[]),'start_date',start_date,'end_date',p_new_end,'currency',r.moneda),auth.uid());
  return r;
end;
$$;
revoke all on function public.hl_extend_group_rooms_with_custom_discount_atomic(bigint,bigint[],date,text,numeric,text) from public,anon;
grant execute on function public.hl_extend_group_rooms_with_custom_discount_atomic(bigint,bigint[],date,text,numeric,text) to authenticated;

commit;
