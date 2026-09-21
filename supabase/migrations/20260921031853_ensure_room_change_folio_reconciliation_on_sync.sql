CREATE OR REPLACE FUNCTION private.hl_sync_reservation_folios_internal(p_reservation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  r public.reservas%rowtype;
  master_folio uuid;
  discount_title text;
begin
  perform private.hl_sync_reservation_folios_internal_legacy(p_reservation_id);

  select * into r
  from public.reservas
  where id=p_reservation_id;
  if not found then return; end if;

  update public.hotel_folio_items i
  set service_date=public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada),
      quantity=greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
      unit_price=coalesce((
        select nullif(e->>'tarifa_noche','')::numeric
        from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
        where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$'
          and (e->>'habitacion_id')::bigint=i.room_id
        limit 1
      ),i.unit_price,0),
      detail=coalesce(r.regimen,'Alojamiento')||' · '||
        public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)::text||
        ' → '||
        public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)::text,
      subtotal=coalesce((
        select nullif(e->>'tarifa_noche','')::numeric
        from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
        where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$'
          and (e->>'habitacion_id')::bigint=i.room_id
        limit 1
      ),i.unit_price,0) *
        greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
      total=coalesce((
        select nullif(e->>'tarifa_noche','')::numeric
        from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
        where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$'
          and (e->>'habitacion_id')::bigint=i.room_id
        limit 1
      ),i.unit_price,0) *
        greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
      metadata=coalesce(i.metadata,'{}'::jsonb)||jsonb_build_object(
        'room_start',public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada),
        'room_end',public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida),
        'nights',greatest(1,public.hl_reservation_room_planned_end_date(r.habitaciones_detalle,i.room_id,r.fecha_salida)-public.hl_reservation_room_start_date(r.habitaciones_detalle,i.room_id,r.fecha_entrada)),
        'room_rate',coalesce((
          select nullif(e->>'tarifa_noche','')::numeric
          from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
          where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$'
            and (e->>'habitacion_id')::bigint=i.room_id
          limit 1
        ),i.unit_price,0)
      ),
      updated_at=now()
  where i.reservation_id=p_reservation_id
    and i.source_type='lodging'
    and i.room_id is not null
    and i.invoice_document_id is null
    and coalesce(i.metadata->>'auto_synced','false')='true';

  update public.hotel_folio_items
  set status='void',updated_at=now()
  where reservation_id=p_reservation_id
    and source_type='adjustment'
    and source_key like 'reservation:adjustment%'
    and invoice_document_id is null
    and coalesce(metadata->>'auto_synced','false')='true';

  if coalesce(r.impuestos_desglosados,false) then
    update public.hotel_folio_items
    set tax_rate=coalesce(r.iva_porcentaje,0),
        tax=round(coalesce(subtotal,0)*coalesce(r.iva_porcentaje,0)/100,2),
        total=round(coalesce(subtotal,0)+(coalesce(subtotal,0)*coalesce(r.iva_porcentaje,0)/100),2),
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'tax_breakdown',true,
          'vat_rate',coalesce(r.iva_porcentaje,0),
          'tax_source','reservation_snapshot'
        ),
        updated_at=now()
    where reservation_id=p_reservation_id
      and status='active'
      and source_type<>'adjustment'
      and invoice_document_id is null
      and coalesce(metadata->>'auto_synced','false')='true';
  else
    update public.hotel_folio_items
    set tax_rate=0,
        tax=0,
        total=coalesce(subtotal,0),
        metadata=coalesce(metadata,'{}'::jsonb)-'tax_breakdown'-'vat_rate'-'tax_source',
        updated_at=now()
    where reservation_id=p_reservation_id
      and status='active'
      and source_type<>'adjustment'
      and invoice_document_id is null
      and coalesce(metadata->>'auto_synced','false')='true';
  end if;

  if coalesce(r.descuento_importe,0)>0 then
    select id into master_folio
    from public.hotel_folios
    where reservation_id=p_reservation_id
      and folio_type='master'
      and status<>'void'
    order by sort_order,created_at
    limit 1;

    discount_title:=case
      when r.descuento_tipo in('percent','porcentaje') and coalesce(r.descuento_valor,0)>0
        then 'Descuento '||trim(to_char(r.descuento_valor,'FM999999990.##'))||'%'
      else 'Descuento aplicado'
    end;

    update public.hotel_folio_items
    set folio_id=coalesce(master_folio,folio_id),
        room_id=case when master_folio is not null then null else room_id end,
        description=discount_title,
        detail=coalesce(nullif(trim(r.descuento_motivo),''),'Descuento ingresado manualmente en la reserva.'),
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'discount_type',r.descuento_tipo,
          'discount_value',r.descuento_valor,
          'discount_amount',r.descuento_importe,
          'discount_reason',r.descuento_motivo,
          'discount_origin',coalesce(r.descuento_origen,'manual'),
          'explicit_discount',true
        ),
        updated_at=now()
    where reservation_id=p_reservation_id
      and source_key='legacy:discount'
      and invoice_document_id is null;
  end if;

  perform private.hl_rehome_auto_room_folio_items(p_reservation_id);
  perform private.hl_apply_room_change_financial_folios_internal(p_reservation_id);
  perform private.hl_reconcile_reservation_rounding(p_reservation_id);
  perform private.hl_rehome_auto_room_folio_items(p_reservation_id);

  if coalesce(r.no_show,false) then
    update public.hotel_folio_items i
    set status='void',updated_at=now()
    where i.reservation_id=p_reservation_id
      and i.status='active'
      and i.invoice_document_id is null
      and coalesce(i.metadata->>'auto_synced','false')='true'
      and not (
        i.source_key='service:no-show-penalty-'||r.id::text
        or lower(coalesce(i.metadata->'source_payload'->>'no_show_penalty','false'))='true'
        or (
          lower(trim(coalesce(i.description,'')))='penalidad no show'
          and lower(trim(coalesce(i.source_type,'')))='fee'
        )
      );
  end if;
end
$function$
