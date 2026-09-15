create or replace function private.hl_reconcile_reservation_rounding(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  r public.reservas%rowtype;
  v_folio uuid;
  v_generated numeric:=0;
  v_delta numeric:=0;
begin
  select * into r from public.reservas where id=p_reservation_id;
  if not found then return; end if;

  select coalesce(sum(total),0) into v_generated
  from public.hotel_folio_items
  where reservation_id=p_reservation_id
    and status='active'
    and source_key is distinct from 'reservation:rounding';

  v_delta:=round(coalesce(r.precio_total,0)-v_generated,2);

  if abs(v_delta)<0.005 or abs(v_delta)>0.05 then
    update public.hotel_folio_items
      set status='void',updated_at=now()
    where reservation_id=p_reservation_id
      and source_key='reservation:rounding'
      and invoice_document_id is null
      and status<>'void';
    return;
  end if;

  select id into v_folio
  from public.hotel_folios
  where reservation_id=p_reservation_id and status<>'void'
  order by case when folio_type='master' then 0 when is_primary then 1 else 2 end,sort_order,created_at
  limit 1;
  if v_folio is null then return; end if;

  insert into public.hotel_folio_items(
    property_id,folio_id,reservation_id,room_id,source_type,source_key,
    description,detail,service_date,quantity,unit_price,discount,tax_rate,tax,
    subtotal,total,currency,status,metadata
  ) values(
    r.property_id,v_folio,r.id,null,'adjustment','reservation:rounding',
    'Ajuste de redondeo','Diferencia mínima de redondeo entre el total contractual y la suma de líneas del folio.',
    r.fecha_entrada,1,v_delta,0,0,0,v_delta,v_delta,r.moneda,'active',
    jsonb_build_object('auto_synced',true,'rounding_adjustment',true)
  )
  on conflict (reservation_id,source_key) where source_key is not null do update
    set folio_id=excluded.folio_id,room_id=null,description=excluded.description,detail=excluded.detail,
        service_date=excluded.service_date,quantity=1,unit_price=excluded.unit_price,discount=0,
        tax_rate=0,tax=0,subtotal=excluded.subtotal,total=excluded.total,currency=excluded.currency,
        status='active',metadata=excluded.metadata,updated_at=now()
  where public.hotel_folio_items.invoice_document_id is null;
end;
$function$;

do $$
declare
  v_def text;
  v_old text:=E'\nend $function$';
  v_new text:=E'\n  perform private.hl_reconcile_reservation_rounding(p_reservation_id);\nend $function$';
begin
  select pg_get_functiondef('private.hl_sync_reservation_folios_internal(bigint)'::regprocedure) into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el cierre esperado de hl_sync_reservation_folios_internal';
  end if;
  v_def:=replace(v_def,v_old,v_new);
  execute v_def;
end $$;
