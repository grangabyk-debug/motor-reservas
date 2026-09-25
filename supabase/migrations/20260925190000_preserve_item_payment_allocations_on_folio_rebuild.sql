-- Preserva la imputación original cargo por cargo al regenerar folios.
-- Los cargos anulados que fueron absorbidos, como un Late convertido en noches,
-- se remapean al cargo activo correspondiente de la misma habitación.

CREATE OR REPLACE FUNCTION private.hl_rebuild_item_payment_allocations_from_folios(p_reservation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_payment public.pagos%rowtype;
  v_entry jsonb;
  v_original public.hotel_folio_items%rowtype;
  v_target public.hotel_folio_items%rowtype;
  v_new_allocations jsonb;
  v_amount numeric;
  v_all_resolved boolean;
  v_special_late boolean;
  v_alloc record;
  v_item record;
  v_left numeric;
  v_take numeric;
  v_prior numeric;
begin
  delete from public.hotel_folio_item_payment_allocations
  where reservation_id=p_reservation_id;

  for v_payment in
    select *
    from public.pagos
    where reserva_id=p_reservation_id
      and lower(coalesce(estado,'')) not in ('anulado','anulada','cancelado','cancelada','void','rechazado','rechazada','cancelled','rejected')
    order by created_at,id
  loop
    if jsonb_typeof(coalesce(v_payment.charge_allocations,'[]'::jsonb))='array'
       and jsonb_array_length(coalesce(v_payment.charge_allocations,'[]'::jsonb))>0 then
      v_new_allocations:='[]'::jsonb;
      v_all_resolved:=true;

      for v_entry in select value from jsonb_array_elements(v_payment.charge_allocations)
      loop
        v_amount:=greatest(0,coalesce(nullif(v_entry->>'amount','')::numeric,0));
        v_original:=null;
        v_target:=null;

        begin
          select * into v_original
          from public.hotel_folio_items
          where id=(v_entry->>'folio_item_id')::uuid
            and reservation_id=p_reservation_id;
        exception when others then
          v_original:=null;
        end;

        if v_original.id is not null and v_original.status='active' then
          v_target:=v_original;
        elsif v_original.id is not null then
          select * into v_target
          from public.hotel_folio_items i
          where i.reservation_id=p_reservation_id
            and i.status='active'
            and nullif(i.source_key,'')=nullif(v_original.source_key,'')
          order by i.updated_at desc,i.created_at desc
          limit 1;

          v_special_late:=
            lower(coalesce(v_original.source_key,'')) like 'service:late-room-%'
            or lower(coalesce(v_original.description,'')) like 'late check-out%'
            or lower(coalesce(v_original.metadata->'source_payload'->>'special_stay',''))='late';

          if v_target.id is null and v_special_late and v_original.room_id is not null then
            select * into v_target
            from public.hotel_folio_items i
            where i.reservation_id=p_reservation_id
              and i.status='active'
              and i.room_id=v_original.room_id
              and lower(coalesce(i.source_type,''))='lodging'
            order by i.created_at,i.id
            limit 1;
          end if;

          if v_target.id is null
             and lower(coalesce(v_original.source_type,''))='lodging'
             and v_original.room_id is not null then
            select * into v_target
            from public.hotel_folio_items i
            where i.reservation_id=p_reservation_id
              and i.status='active'
              and i.room_id=v_original.room_id
              and lower(coalesce(i.source_type,''))='lodging'
            order by i.created_at,i.id
            limit 1;
          end if;

          if v_target.id is null
             and v_original.room_id is not null
             and nullif(v_original.source_type,'') is not null then
            select * into v_target
            from public.hotel_folio_items i
            where i.reservation_id=p_reservation_id
              and i.status='active'
              and i.room_id=v_original.room_id
              and lower(coalesce(i.source_type,''))=lower(v_original.source_type)
            order by
              case when nullif(v_original.description,'') is not null
                     and lower(coalesce(i.description,''))=lower(v_original.description) then 0 else 1 end,
              i.created_at,i.id
            limit 1;
          end if;
        end if;

        if v_target.id is null or v_amount<=.009 then
          v_all_resolved:=false;
          exit;
        end if;

        v_new_allocations:=v_new_allocations||jsonb_build_array(
          jsonb_build_object('folio_item_id',v_target.id,'amount',v_amount)
        );
      end loop;

      if v_all_resolved
         and abs(
           coalesce((select sum((x->>'amount')::numeric) from jsonb_array_elements(v_new_allocations) x),0)
           - coalesce(v_payment.monto,0)
         )<=.01 then
        update public.pagos
        set charge_allocations=v_new_allocations
        where id=v_payment.id;
      end if;
    else
      for v_alloc in
        select *
        from public.hotel_folio_payment_allocations
        where payment_id=v_payment.id
          and amount>.009
        order by created_at,id
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

          select coalesce(sum(a.amount),0)
          into v_prior
          from public.hotel_folio_item_payment_allocations a
          join public.pagos p on p.id=a.payment_id
          where a.folio_item_id=v_item.id
            and a.payment_id<>v_payment.id
            and lower(coalesce(p.estado,'')) not in ('anulado','anulada','cancelado','cancelada','void','rechazado','rechazada','cancelled','rejected');

          v_take:=least(v_left,greatest(0,v_item.total-v_prior));
          if v_take>.009 then
            insert into public.hotel_folio_item_payment_allocations(
              property_id,reservation_id,folio_id,folio_item_id,payment_id,
              amount,currency,source,created_by
            ) values(
              v_alloc.property_id,v_alloc.reservation_id,v_alloc.folio_id,v_item.id,
              v_alloc.payment_id,round(v_take,2),v_alloc.currency,'legacy_folio_rebuild',v_alloc.created_by
            )
            on conflict(payment_id,folio_item_id) do update
            set amount=excluded.amount,folio_id=excluded.folio_id,currency=excluded.currency,source=excluded.source;

            v_left:=round(v_left-v_take,2);
          end if;
        end loop;
      end loop;
    end if;
  end loop;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.hl_extend_group_rooms_atomic(p_reserva_id bigint, p_room_ids bigint[], p_new_end date)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  r public.reservas%rowtype;
  h public.habitaciones%rowtype;
  rid bigint;
  ids bigint[];
  active_count integer:=0;
  details jsonb;
  services jsonb;
  checkout jsonb;
  d jsonb;
  d_ord bigint;
  old_start date;
  old_end date;
  old_nights integer;
  new_nights integer;
  old_rate numeric;
  old_room_total numeric;
  new_room_total numeric;
  new_avg numeric;
  q jsonb;
  extra_nights integer;
  extra_booked numeric;
  extra_final numeric;
  late_credit numeric;
  service_late_credit numeric;
  total_delta numeric:=0;
  current_net numeric;
  next_net numeric;
  vat_rate numeric;
  next_vat numeric;
  next_total numeric;
  new_global_end date;
  total_rate numeric;
  guest_rows integer:=0;
  guest_rows_total integer:=0;
  extensions jsonb:='[]'::jsonb;
  nightly jsonb;
  room_name text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into r from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(r.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para extender esta reserva.'; end if;
  if r.estado in('cancelada','finalizada','fusionada') or coalesce(r.no_show,false) then raise exception using errcode='P0001',message='La reserva ya no admite extensiones.'; end if;

  select coalesce(array_agg(distinct x order by x),array[]::bigint[]) into ids
  from unnest(coalesce(p_room_ids,array[]::bigint[])) x where x is not null;
  if cardinality(ids)=0 then raise exception using errcode='22023',message='Elegí al menos una habitación para extender.'; end if;

  details:=case when jsonb_typeof(r.habitaciones_detalle)='array' then r.habitaciones_detalle else '[]'::jsonb end;
  services:=case when jsonb_typeof(r.servicios)='array' then r.servicios else '[]'::jsonb end;
  checkout:=coalesce(r.room_checkout_dates,'{}'::jsonb);

  select count(*) into active_count
  from unnest(coalesce(r.habitaciones_ids,array[]::bigint[])||case when r.habitacion_id is null then array[]::bigint[] else array[r.habitacion_id]::bigint[] end) x
  where x is not null
    and not (coalesce(checkout->>x::text,'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
    and not exists(
      select 1 from jsonb_array_elements(details) e
      where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$'
        and (e->>'habitacion_id')::bigint=x
        and lower(coalesce(e->>'segment_role','active_room')) in('previous_room','transient_room','cancelled_room','no_show_room')
    );
  if active_count<=1 then raise exception using errcode='22023',message='Este flujo es para reservas grupales con más de una habitación activa.'; end if;

  if exists(
    select 1 from public.hotel_finance_documents doc
    where doc.property_id=r.property_id and doc.reservation_id=r.id and coalesce(doc.total,0)>0
      and lower(coalesce(doc.document_type,'')) not like '%proforma%'
      and lower(coalesce(doc.document_type,'')) not like '%presupuesto%'
      and lower(coalesce(doc.status,'')) not in('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void')
      and (doc.issued_at is not null or lower(coalesce(doc.status,'')) in('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))
  ) then raise exception using errcode='P0001',message='La estadía ya tiene un comprobante emitido. Rectificá la facturación antes de extender habitaciones.'; end if;

  foreach rid in array ids loop
    if not (rid=any(coalesce(r.habitaciones_ids,array[]::bigint[])||case when r.habitacion_id is null then array[]::bigint[] else array[r.habitacion_id]::bigint[] end)) then
      select nombre into room_name from public.habitaciones where id=rid and property_id=r.property_id;
      raise exception using errcode='22023',message=format('Hab. %s no pertenece a la reserva.',coalesce(room_name,rid::text));
    end if;

    select * into h from public.habitaciones where id=rid and property_id=r.property_id and activa is distinct from false;
    if not found then raise exception using errcode='P0002',message='Habitación inexistente o inactiva.'; end if;
    room_name:=coalesce(h.nombre,rid::text);

    if coalesce(checkout->>rid::text,'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception using errcode='22023',message=format('Hab. %s ya tiene check-out y no se puede extender.',room_name);
    end if;

    select e,ord into d,d_ord
    from jsonb_array_elements(details) with ordinality t(e,ord)
    where coalesce(e->>'habitacion_id','') ~ '^[0-9]+$'
      and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by ord desc limit 1;
    if d is null then raise exception using errcode='22023',message=format('Hab. %s ya no está activa dentro de la reserva grupal.',room_name); end if;

    old_start:=public.hl_reservation_room_start_date(details,rid,r.fecha_entrada);
    old_end:=public.hl_reservation_room_planned_end_date(details,rid,r.fecha_salida);
    if p_new_end is null or p_new_end<=old_end then raise exception using errcode='22023',message=format('La nueva salida de Hab. %s debe ser posterior a %s.',room_name,old_end); end if;

    if exists(
      select 1
      from public.reservas o
      cross join lateral (
        select public.hl_reservation_room_start_date(o.habitaciones_detalle,rid,o.fecha_entrada) as room_start,
               public.hl_reservation_room_planned_end_date(o.habitaciones_detalle,rid,o.fecha_salida) as room_end
      ) base
      where o.property_id=r.property_id and o.id<>r.id and o.estado not in('cancelada','fusionada') and coalesce(o.no_show,false)=false
        and rid=any(coalesce(o.habitaciones_ids,array[]::bigint[])||case when o.habitacion_id is null then array[]::bigint[] else array[o.habitacion_id]::bigint[] end)
        and public.hl_reservation_inventory_start_date(base.room_start,public.hl_reservation_room_early_checkin(o.habitaciones_detalle,rid,base.room_start,o.fecha_entrada,o.early_checkin))<p_new_end
        and public.hl_reservation_room_inventory_end_date(o.room_checkout_dates,rid,base.room_end,public.hl_reservation_room_late_checkout(o.habitaciones_detalle,o.room_checkout_dates,rid,base.room_end,o.fecha_salida,o.late_checkout))>old_end
    ) then raise exception using errcode='23P01',message=format('Hab. %s no está disponible para toda la extensión.',room_name); end if;

    if exists(select 1 from public.bloqueos b where b.property_id=r.property_id and b.habitacion_id=rid and b.fecha_desde<p_new_end and b.fecha_hasta>old_end) then
      raise exception using errcode='23P01',message=format('Hab. %s tiene un bloqueo durante la extensión.',room_name);
    end if;

    perform private.hl_prepare_checkout_maintenance_ack(r.id,rid,p_new_end);
    q:=private.hl_room_addition_pricing_quote(r.id,rid,old_end,p_new_end);
    extra_nights:=greatest(1,coalesce(nullif(q->>'nights','')::integer,p_new_end-old_end));
    extra_booked:=greatest(0,coalesce(nullif(q->>'reservation_booked_total','')::numeric,0));
    extra_final:=greatest(0,coalesce(nullif(q->>'reservation_final_total','')::numeric,extra_booked));
    nightly:=case when jsonb_typeof(q->'nightly_rates')='array' then q->'nightly_rates' else '[]'::jsonb end;

    late_credit:=greatest(0,coalesce(nullif(d->>'late_checkout_net','')::numeric,0));
    select coalesce(max(greatest(0,coalesce(nullif(svc->>'precio','')::numeric,nullif(svc->>'total','')::numeric,0))),0)
    into service_late_credit
    from jsonb_array_elements(services) svc
    where coalesce(svc->>'room_id',svc->>'habitacion_id','') ~ '^[0-9]+$'
      and coalesce(svc->>'room_id',svc->>'habitacion_id')::bigint=rid
      and (lower(coalesce(svc->>'special_stay',''))='late' or coalesce(svc->>'id','')='late-room-'||rid::text or svc ? 'late_checkout_time');
    late_credit:=greatest(late_credit,coalesce(service_late_credit,0));

    if late_credit>0 or coalesce(d->>'late_checkout_requested','false')='true' or checkout ? ('late:'||rid::text) then
      d:=(d-'late_checkout_time'-'late_checkout_net'-'late_checkout_percent')||jsonb_build_object('late_checkout_requested',false);
      checkout:=checkout-('late:'||rid::text);

      select coalesce(jsonb_agg(svc order by ord),'[]'::jsonb) into services
      from jsonb_array_elements(services) with ordinality x(svc,ord)
      where not(
        coalesce(svc->>'room_id',svc->>'habitacion_id','') ~ '^[0-9]+$'
        and coalesce(svc->>'room_id',svc->>'habitacion_id')::bigint=rid
        and (lower(coalesce(svc->>'special_stay',''))='late' or coalesce(svc->>'id','')='late-room-'||rid::text or svc ? 'late_checkout_time')
      );
    end if;

    old_rate:=greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,0));
    old_nights:=greatest(1,old_end-old_start);
    new_nights:=greatest(1,p_new_end-old_start);
    old_room_total:=round(old_rate*old_nights,2);
    new_room_total:=round(old_room_total+extra_booked,2);
    new_avg:=round(new_room_total/new_nights,6);

    d:=d||jsonb_build_object(
      'fecha_salida',p_new_end,'noches',new_nights,'tarifa_noche',new_avg,'tarifa_snapshot_at',now(),
      'extension_from',old_end,'extension_nights',extra_nights,
      'extension_rate_net',coalesce(nullif(q->>'reservation_booked_avg_rate','')::numeric,0),
      'extension_net_total',extra_booked,
      'tarifas_por_noche',(case when jsonb_typeof(d->'tarifas_por_noche')='array' then d->'tarifas_por_noche' else '[]'::jsonb end)||nightly,
      'rate_segments',(case when jsonb_typeof(d->'rate_segments')='array' then d->'rate_segments' else '[]'::jsonb end)||jsonb_build_array(jsonb_build_object('kind','extension','from',old_end,'to',p_new_end,'nights',extra_nights,'booked_total',extra_booked,'final_total',extra_final))
    );

    select coalesce(jsonb_agg(case when ord=d_ord then d else e end order by ord),'[]'::jsonb) into details
    from jsonb_array_elements(details) with ordinality t(e,ord);

    update public.hotel_reservation_guests
    set stay_to=p_new_end,updated_at=now()
    where property_id=r.property_id and reservation_id=r.id and room_id=rid and checked_out_at is null and (stay_to is null or stay_to>=old_end);
    get diagnostics guest_rows=row_count;
    guest_rows_total:=guest_rows_total+guest_rows;

    total_delta:=total_delta+extra_booked-late_credit;
    extensions:=extensions||jsonb_build_array(jsonb_build_object(
      'room_id',rid,'room_name',room_name,'old_end',old_end,'new_end',p_new_end,'extra_nights',extra_nights,
      'extension_booked_total',extra_booked,'extension_final_total',extra_final,'late_credit_booked',late_credit,
      'net_delta_booked',extra_booked-late_credit,'guest_rows_extended',guest_rows
    ));
  end loop;

  select max((e->>'fecha_salida')::date) into new_global_end
  from jsonb_array_elements(details) e
  where coalesce(e->>'fecha_salida','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');
  new_global_end:=coalesce(new_global_end,r.fecha_salida);

  select coalesce(sum(greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0))),0) into total_rate
  from jsonb_array_elements(details) e
  where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    and not (coalesce(checkout->>coalesce(e->>'habitacion_id',''),'') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

  current_net:=greatest(0,coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,case when coalesce(r.impuestos_desglosados,false) then coalesce(r.precio_total,0)-coalesce(r.iva_importe,0) else r.precio_total end,0));
  next_net:=greatest(0,round(current_net+total_delta,2));
  vat_rate:=case when coalesce(r.impuestos_desglosados,false) then greatest(0,coalesce(r.iva_porcentaje,0)) else 0 end;
  next_vat:=round(next_net*vat_rate/100,2);
  next_total:=round(next_net+next_vat,2);

  update public.reservas
  set habitaciones_detalle=details,servicios=services,room_checkout_dates=checkout,fecha_salida=new_global_end,
      noches=greatest(1,new_global_end-fecha_entrada),tarifa_noche=total_rate,late_checkout=false,late_checkout_importe=0,
      subtotal=next_net,precio_sin_impuestos_nacionales=next_net,iva_importe=next_vat,precio_total=next_total,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(next_total/tipo_cambio,2) else precio_total_usd end
  where id=r.id returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(r.property_id,r.id,'group_room_extension','Extensión de noches',
    format('Noches extendidas en %s habitación(es) hasta %s.',cardinality(ids),p_new_end),
    jsonb_build_object('room_ids',ids,'new_end',p_new_end,'extensions',extensions,'booked_delta',total_delta,'price_total',r.precio_total,'currency',r.moneda,'guest_rows_extended',guest_rows_total),
    auth.uid());

  return r;
end;
$function$
;

revoke all on function public.hl_extend_group_rooms_atomic(bigint,bigint[],date) from public,anon;
grant execute on function public.hl_extend_group_rooms_atomic(bigint,bigint[],date) to authenticated;
