-- Sincroniza huéspedes por habitación y hace persistentes las asignaciones manuales de folio.

create table if not exists private.hl_folio_item_assignments(
  item_id uuid primary key references public.hotel_folio_items(id) on delete cascade,
  property_id uuid not null,
  reservation_id bigint not null,
  folio_id uuid not null references public.hotel_folios(id) on delete cascade,
  assignment_source text not null default 'manual',
  assigned_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hl_folio_item_assignments_reservation_idx
  on private.hl_folio_item_assignments(reservation_id);

create or replace function private.hl_restore_manual_folio_assignments(p_reservation_id bigint)
returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare v_count integer:=0;
begin
  update public.hotel_folio_items i
  set folio_id=a.folio_id,updated_at=now()
  from private.hl_folio_item_assignments a
  join public.hotel_folios f on f.id=a.folio_id and f.status<>'void'
  where a.item_id=i.id
    and a.reservation_id=p_reservation_id
    and i.reservation_id=p_reservation_id
    and i.invoice_document_id is null
    and i.folio_id is distinct from a.folio_id;
  get diagnostics v_count=row_count;
  return v_count;
end
$function$;


create or replace function private.hl_materialize_added_room_guests(
  p_reservation_id bigint,
  p_room_id bigint,
  p_start date,
  p_end date,
  p_guest_count integer,
  p_holder_name text,
  p_phone text default null,
  p_email text default null
) returns integer
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  r public.reservas%rowtype;
  h public.habitaciones%rowtype;
  v_existing integer:=0;
  v_needed integer:=0;
  v_inserted integer:=0;
  v_sort integer:=0;
  v_idx integer;
  v_has_any boolean:=false;
  v_name text;
begin
  select * into r from public.reservas where id=p_reservation_id;
  if not found or p_room_id is null or p_start is null or p_end is null or p_end<=p_start then return 0; end if;
  select * into h from public.habitaciones where id=p_room_id and property_id=r.property_id;
  if not found then return 0; end if;

  select count(*)::integer into v_existing
  from public.hotel_reservation_guests
  where property_id=r.property_id and reservation_id=r.id and room_id=p_room_id and checked_out_at is null;

  v_needed:=greatest(0,greatest(1,coalesce(p_guest_count,1))-v_existing);
  if v_needed=0 then return 0; end if;

  select exists(select 1 from public.hotel_reservation_guests where property_id=r.property_id and reservation_id=r.id) into v_has_any;
  select coalesce(max(sort_order),-1)+1 into v_sort
  from public.hotel_reservation_guests where property_id=r.property_id and reservation_id=r.id;

  for v_idx in 1..v_needed loop
    if v_existing=0 and v_idx=1 then
      v_name:=coalesce(nullif(trim(p_holder_name),''),'Huésped · Hab. '||coalesce(h.nombre,p_room_id::text));
    else
      v_name:='Acompañante '||(v_existing+v_idx)::text||' · Hab. '||coalesce(h.nombre,p_room_id::text);
    end if;

    insert into public.hotel_reservation_guests(
      property_id,reservation_id,room_id,guest_profile_id,role,full_name,email,phone,
      notes,sort_order,created_by,stay_from,stay_to
    ) values(
      r.property_id,r.id,p_room_id,null,
      case when not v_has_any and v_inserted=0 then 'primary' else 'companion' end,
      v_name,
      case when v_existing=0 and v_idx=1 then nullif(trim(p_email),'') else null end,
      case when v_existing=0 and v_idx=1 then nullif(trim(p_phone),'') else null end,
      case when v_existing=0 and v_idx=1 then 'Titular generado al añadir la habitación.'
           else 'Pasajero pendiente de completar · generado al añadir la habitación.' end,
      v_sort+v_inserted,
      auth.uid(),
      p_start,p_end
    );
    v_inserted:=v_inserted+1;
  end loop;

  return v_inserted;
end
$function$;

CREATE OR REPLACE FUNCTION public.hl_move_folio_item(p_item_id uuid, p_target_folio_id uuid)
 RETURNS hotel_folio_items
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare i public.hotel_folio_items%rowtype;f public.hotel_folios%rowtype;oldf public.hotel_folios%rowtype;
begin
 select * into i from public.hotel_folio_items where id=p_item_id;select * into f from public.hotel_folios where id=p_target_folio_id;select * into oldf from public.hotel_folios where id=i.folio_id;
 if i.id is null or f.id is null or i.property_id<>f.property_id or i.reservation_id<>f.reservation_id then raise exception 'Folio de destino inválido';end if;if not private.user_has_property_role(i.property_id,array['owner','manager','reception','admin','night_audit']) then raise exception 'No autorizado';end if;if i.invoice_document_id is not null then raise exception 'No se puede mover un consumo ya facturado';end if;
 update public.hotel_folio_items set folio_id=f.id,room_id=coalesce(f.room_id,room_id),updated_at=now() where id=i.id returning * into i;
 insert into private.hl_folio_item_assignments(item_id,property_id,reservation_id,folio_id,assignment_source,assigned_by)
 values(i.id,i.property_id,i.reservation_id,f.id,'manual',auth.uid())
 on conflict(item_id) do update set folio_id=excluded.folio_id,assignment_source='manual',assigned_by=excluded.assigned_by,updated_at=now();
 insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(i.property_id,i.reservation_id,'folio_item_moved','Consumo redistribuido',coalesce(i.description,'Consumo')||' · '||coalesce(oldf.label,'Folio anterior')||' → '||f.label,jsonb_build_object('item_id',i.id,'from_folio_id',oldf.id,'to_folio_id',f.id,'amount',i.total,'currency',i.currency),auth.uid());return i;
end $function$;

CREATE OR REPLACE FUNCTION public.hl_consolidate_folio(p_target_folio_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare f public.hotel_folios%rowtype; n integer;
begin
  select * into f from public.hotel_folios where id=p_target_folio_id;
  if f.id is null or not private.user_has_property_role(f.property_id,array['owner','manager','reception','admin','night_audit']) then raise exception 'No autorizado'; end if;

  insert into private.hl_folio_item_assignments(item_id,property_id,reservation_id,folio_id,assignment_source,assigned_by)
  select i.id,i.property_id,i.reservation_id,f.id,'consolidate',auth.uid()
  from public.hotel_folio_items i
  where i.reservation_id=f.reservation_id and i.property_id=f.property_id and i.status='active'
    and i.invoice_document_id is null and i.folio_id<>f.id
  on conflict(item_id) do update set folio_id=excluded.folio_id,assignment_source=excluded.assignment_source,assigned_by=excluded.assigned_by,updated_at=now();
  get diagnostics n=row_count;

  update public.hotel_folio_items
  set folio_id=f.id,updated_at=now()
  where reservation_id=f.reservation_id and property_id=f.property_id and status='active'
    and invoice_document_id is null and folio_id<>f.id;
  return n;
end;
$function$;
CREATE OR REPLACE FUNCTION private.hl_rehome_auto_room_folio_items(p_reservation_id bigint)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
    and not exists(select 1 from private.hl_folio_item_assignments a where a.item_id=i.id)
    and exists(
      select 1 from public.hotel_folios f
      where f.reservation_id=i.reservation_id
        and f.room_id=i.room_id
        and f.folio_type='room'
        and f.status<>'void'
        and f.id is distinct from i.folio_id
    );
  perform private.hl_restore_manual_folio_assignments(p_reservation_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.hl_add_room_to_reservation_atomic(p_reservation_id bigint, p_room jsonb)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare v_before public.reservas%rowtype; v_after public.reservas%rowtype; v_room public.habitaciones%rowtype; v_policy public.hotel_cancellation_policies%rowtype; v_room_id bigint; v_start date; v_end date; v_guests integer; v_rate numeric; v_nights integer; v_policy_id uuid; v_policy_snapshot jsonb; v_detail jsonb; v_details jsonb:='[]'::jsonb; v_existing jsonb; v_id bigint; v_new_start date; v_new_end date; v_added_net numeric; v_current_net numeric; v_new_net numeric; v_new_vat numeric; v_vat_rate numeric; v_total_rate numeric; v_quote jsonb; v_min_stay integer; v_cta boolean; v_ctd boolean;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if; if p_room is null or jsonb_typeof(p_room)<>'object' then raise exception using errcode='22023',message='Datos de la habitación inválidos.'; end if; select * into v_before from public.reservas where id=p_reservation_id for update; if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if; if not private.user_has_property_role(v_before.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para modificar esta reserva.'; end if; if v_before.estado in('cancelada','finalizada') or coalesce(v_before.no_show,false) then raise exception using errcode='P0001',message='Esta reserva ya no admite nuevas habitaciones.'; end if;
 if exists(select 1 from public.hotel_finance_documents d where d.property_id=v_before.property_id and d.reservation_id=v_before.id and coalesce(d.total,0)>0 and lower(coalesce(d.document_type,'')) not like '%proforma%' and lower(coalesce(d.document_type,'')) not like '%presupuesto%' and lower(coalesce(d.status,'')) not in('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void') and (d.issued_at is not null or lower(coalesce(d.status,'')) in('issued','emitida','emitido','sent','enviada','enviado','paid','pagada','pagado','final','fiscal'))) then raise exception using errcode='P0001',message='La reserva ya tiene un comprobante emitido. Rectificá el comprobante antes de sumar alojamiento.'; end if;
 v_room_id:=nullif(p_room->>'roomId','')::bigint; v_start:=nullif(p_room->>'start','')::date; v_end:=nullif(p_room->>'end','')::date; v_guests:=greatest(1,coalesce(nullif(p_room->>'guests','')::integer,1)); v_policy_id:=nullif(p_room->>'cancellationPolicyId','')::uuid; if v_room_id is null or v_start is null or v_end is null or v_end<=v_start then raise exception using errcode='22023',message='Elegí habitación, entrada y salida válidas.'; end if;
 select * into v_room from public.habitaciones where id=v_room_id and property_id=v_before.property_id and activa is distinct from false; if not found then raise exception using errcode='P0002',message='Habitación inexistente o inactiva.'; end if; if lower(coalesce(v_room.estado,'')) in('mantenimiento','fuera_servicio') then raise exception using errcode='P0001',message='La habitación seleccionada está fuera de servicio.'; end if; if v_guests>greatest(1,coalesce(v_room.capacidad,1)) then raise exception using errcode='22023',message='La cantidad de huéspedes supera la capacidad de la habitación.'; end if; if v_room_id=any(coalesce(v_before.habitaciones_ids,array[]::bigint[])||array[v_before.habitacion_id]) then raise exception using errcode='22023',message='Esa habitación ya forma parte de la reserva.'; end if;
 select * into v_policy from public.hotel_cancellation_policies where id=v_policy_id and property_id=v_before.property_id and active=true; if not found then raise exception using errcode='22023',message='Seleccioná una política de cancelación activa.'; end if; v_nights:=greatest(1,v_end-v_start); v_quote:=private.hl_room_addition_pricing_quote(v_before.id,v_room_id,v_start,v_end); v_rate:=greatest(0,coalesce((v_quote->>'reservation_booked_avg_rate')::numeric,0));
 if exists(select 1 from public.hotel_rate_calendar rc where rc.property_id=v_before.property_id and rc.habitacion_id=v_room_id and rc.stay_date>=v_start and rc.stay_date<v_end and rc.stop_sell=true) then raise exception using errcode='P0001',message='Hay una restricción Stop Sell activa dentro de la estadía.'; end if; select coalesce(min_stay,1),coalesce(closed_to_arrival,false) into v_min_stay,v_cta from public.hotel_rate_calendar where property_id=v_before.property_id and habitacion_id=v_room_id and stay_date=v_start; if coalesce(v_cta,false) then raise exception using errcode='P0001',message='La fecha de llegada está cerrada a arribos (CTA).'; end if; if coalesce(v_min_stay,1)>v_nights then raise exception using errcode='P0001',message='La tarifa exige una estadía mínima de '||v_min_stay::text||' noches.'; end if; select coalesce(closed_to_departure,false) into v_ctd from public.hotel_rate_calendar where property_id=v_before.property_id and habitacion_id=v_room_id and stay_date=v_end; if coalesce(v_ctd,false) then raise exception using errcode='P0001',message='La fecha de salida está cerrada a partidas (CTD).'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_before.property_id::text||':'||v_room_id::text,0)); if exists(select 1 from public.reservas r where r.property_id=v_before.property_id and r.id<>v_before.id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false and v_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id]) and public.hl_reservation_room_start_date(r.habitaciones_detalle,v_room_id,r.fecha_entrada)<v_end and public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,v_room_id,r.fecha_salida)>v_start) then raise exception using errcode='23P01',message=format('La habitación %s está ocupada entre %s y %s.',coalesce(v_room.nombre,v_room_id::text),v_start,v_end); end if; if exists(select 1 from public.bloqueos b where b.property_id=v_before.property_id and b.habitacion_id=v_room_id and b.fecha_desde<v_end and b.fecha_hasta>v_start) then raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo en esas fechas.',coalesce(v_room.nombre,v_room_id::text)); end if;
 v_policy_snapshot:=jsonb_build_object('id',v_policy.id,'code',v_policy.code,'name',v_policy.name,'description',v_policy.description,'policy_type',v_policy.policy_type,'language',v_policy.language,'currency',v_policy.currency,'cancellation_rules',coalesce(v_policy.cancellation_rules,'[]'::jsonb),'no_show_rule',coalesce(v_policy.no_show_rule,jsonb_build_object('charge_type','none','value',0)),'early_checkout_rule',coalesce(v_policy.early_checkout_rule,jsonb_build_object('charge_type','none','value',0)),'prepayment_required',coalesce(v_policy.prepayment_required,false),'prepayment_percent',coalesce(v_policy.prepayment_percent,0),'captured_at',now());
 foreach v_id in array coalesce(v_before.habitaciones_ids,array[v_before.habitacion_id]::bigint[]) loop select e into v_existing from jsonb_array_elements(coalesce(v_before.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','') ~ '^\d+$' and (e->>'habitacion_id')::bigint=v_id limit 1; if v_existing is null then select jsonb_build_object('habitacion_id',h.id,'nombre',h.nombre,'categoria_asignada',coalesce(h.tipo,'Habitación'),'categoria_vendida',coalesce(h.tipo,'Habitación'),'huespedes',case when h.id=v_before.habitacion_id then greatest(1,coalesce(v_before.cantidad_huespedes,1)) else 0 end,'tarifa_noche',case when h.id=v_before.habitacion_id then coalesce(v_before.tarifa_noche,h.precio,0) else coalesce(h.precio,0) end,'rooming',jsonb_build_object('matrimonial',0,'individual',0)) into v_existing from public.habitaciones h where h.id=v_id; end if; v_existing:=coalesce(v_existing,'{}'::jsonb)||jsonb_build_object('fecha_entrada',public.hl_reservation_room_start_date(v_before.habitaciones_detalle,v_id,v_before.fecha_entrada),'fecha_salida',public.hl_reservation_room_planned_end_date(v_before.habitaciones_detalle,v_id,v_before.fecha_salida)); v_details:=v_details||jsonb_build_array(v_existing); v_existing:=null; end loop;
 v_detail:=jsonb_build_object('habitacion_id',v_room_id,'nombre',v_room.nombre,'categoria_asignada',coalesce(v_room.tipo,'Habitación'),'categoria_vendida',coalesce(nullif(trim(p_room->>'soldAs'),''),v_room.tipo,'Habitación'),'huespedes',v_guests,'tarifa_noche',v_rate,'fecha_entrada',v_start,'fecha_salida',v_end,'titular_nombre',coalesce(nullif(trim(p_room->>'holderName'),''),v_before.nombre_huesped),'titular_telefono',nullif(trim(p_room->>'phone'),''),'titular_email',nullif(trim(p_room->>'email'),''),'canal_reserva',coalesce(nullif(trim(p_room->>'channel'),''),'Walk-in'),'codigo_canal',nullif(trim(p_room->>'voucher'),''),'cancellation_policy_id',v_policy.id,'cancellation_policy_snapshot',v_policy_snapshot,'notas',nullif(trim(p_room->>'notes'),''),'rooming',jsonb_build_object('matrimonial',greatest(0,coalesce(nullif(p_room->>'matrimonial','')::integer,0)),'individual',greatest(0,coalesce(nullif(p_room->>'individual','')::integer,0))),'tarifa_fuente','calendar_room','tarifa_manual',false,'tarifas_por_noche',coalesce(v_quote->'nightly_rates','[]'::jsonb),'tarifa_snapshot_at',now()); v_details:=v_details||jsonb_build_array(v_detail);
 select min(public.hl_reservation_room_start_date(v_details,x,v_before.fecha_entrada)),max(public.hl_reservation_room_planned_end_date(v_details,x,v_before.fecha_salida)) into v_new_start,v_new_end from unnest(coalesce(v_before.habitaciones_ids,array[v_before.habitacion_id]::bigint[])||array[v_room_id]) x; select coalesce(sum(coalesce(nullif(e->>'tarifa_noche','')::numeric,0)),0) into v_total_rate from jsonb_array_elements(v_details) e; v_added_net:=round(coalesce((v_quote->>'reservation_booked_total')::numeric,v_rate*v_nights),2); v_vat_rate:=case when coalesce(v_before.impuestos_desglosados,false) then greatest(0,coalesce(v_before.iva_porcentaje,0)) else 0 end; v_current_net:=greatest(0,case when coalesce(v_before.precio_sin_impuestos_nacionales,0)>0 then v_before.precio_sin_impuestos_nacionales when coalesce(v_before.impuestos_desglosados,false) then greatest(0,coalesce(v_before.precio_total,0)-coalesce(v_before.iva_importe,0)) when coalesce(v_before.precio_total,0)>0 then v_before.precio_total else coalesce(v_before.subtotal,0) end); v_new_net:=round(v_current_net+v_added_net,2); v_new_vat:=case when coalesce(v_before.impuestos_desglosados,false) then round(coalesce(v_before.iva_importe,0)+v_added_net*v_vat_rate/100,2) else 0 end;
 update public.reservas set habitaciones_ids=(select array_agg(distinct x order by x) from unnest(coalesce(v_before.habitaciones_ids,array[v_before.habitacion_id]::bigint[])||array[v_room_id]) x),habitaciones_detalle=v_details,fecha_entrada=v_new_start,fecha_salida=v_new_end,cantidad_huespedes=greatest(1,coalesce(v_before.cantidad_huespedes,1))+v_guests,tarifa_noche=v_total_rate,subtotal=v_new_net,precio_sin_impuestos_nacionales=v_new_net,iva_importe=v_new_vat,precio_total=round(v_new_net+v_new_vat,2) where id=v_before.id returning * into v_after;
 perform private.hl_materialize_added_room_guests(v_after.id,v_room_id,v_start,v_end,v_guests,coalesce(nullif(trim(p_room->>'holderName'),''),v_before.nombre_huesped),nullif(trim(p_room->>'phone'),''),nullif(trim(p_room->>'email'),''));
 return v_after;
end $function$;

CREATE OR REPLACE FUNCTION public.hl_extend_reservation_room_atomic(p_reserva_id bigint, p_room_id bigint, p_new_end date)
 RETURNS reservas
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v public.reservas%rowtype;
  v_room public.habitaciones%rowtype;
  v_detail jsonb;
  v_old_start date;
  v_old_end date;
  v_old_rate numeric;
  v_old_nights integer;
  v_new_nights integer;
  v_extra_nights integer;
  v_extra_net numeric;
  v_extra_avg numeric;
  v_new_room_total numeric;
  v_new_avg numeric;
  v_details jsonb;
  v_new_global_end date;
  v_new_net numeric;
  v_vat numeric;
  v_total numeric;
  v_total_rate numeric;
  v_guest_rows integer:=0;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para extender esta habitación.'; end if;
  if v.estado in('cancelada','finalizada','fusionada') or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva ya no admite extensiones.'; end if;
  if not(p_room_id=any(coalesce(v.habitaciones_ids,array[]::bigint[])||array[v.habitacion_id])) then raise exception using errcode='22023',message='La habitación no pertenece a la reserva.'; end if;
  if exists(select 1 from public.hotel_finance_documents d where d.property_id=v.property_id and d.reservation_id=v.id and coalesce(d.total,0)>0 and lower(coalesce(d.status,'')) not in('draft','borrador','cancelled','canceled','cancelada','anulado','anulada','void') and d.issued_at is not null) then raise exception using errcode='P0001',message='La reserva tiene comprobantes emitidos. Rectificá la facturación antes de extenderla.'; end if;

  select * into v_room from public.habitaciones where id=p_room_id and property_id=v.property_id and activa is distinct from false;
  if not found then raise exception using errcode='P0002',message='Habitación inexistente.'; end if;
  v_old_start:=public.hl_reservation_room_start_date(v.habitaciones_detalle,p_room_id,v.fecha_entrada);
  v_old_end:=public.hl_reservation_room_planned_end_date(v.habitaciones_detalle,p_room_id,v.fecha_salida);
  if p_new_end is null or p_new_end<=v_old_end then raise exception using errcode='22023',message='La nueva salida debe ser posterior a la salida actual de la habitación.'; end if;

  if exists(select 1 from public.reservas r where r.property_id=v.property_id and r.id<>v.id and r.estado not in('cancelada','fusionada') and coalesce(r.no_show,false)=false and p_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id]) and public.hl_reservation_room_start_date(r.habitaciones_detalle,p_room_id,r.fecha_entrada)<p_new_end and public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,p_room_id,r.fecha_salida)>v_old_end) then raise exception using errcode='23P01',message=format('La habitación %s no está disponible para toda la extensión.',coalesce(v_room.nombre,p_room_id::text)); end if;
  if exists(select 1 from public.bloqueos b where b.property_id=v.property_id and b.habitacion_id=p_room_id and b.fecha_desde<p_new_end and b.fecha_hasta>v_old_end) then raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo durante la extensión.',coalesce(v_room.nombre,p_room_id::text)); end if;

  perform private.hl_prepare_checkout_maintenance_ack(p_reserva_id,p_room_id,p_new_end);

  select q.nights,q.net_total,q.avg_rate into v_extra_nights,v_extra_net,v_extra_avg from private.hl_calendar_room_pricing(v.property_id,p_room_id,v_old_end,p_new_end) q;
  select e into v_detail from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id order by coalesce(nullif(e->>'fecha_salida','')::date,v.fecha_salida) desc limit 1;
  v_old_rate:=greatest(0,coalesce(nullif(v_detail->>'tarifa_noche','')::numeric,v.tarifa_noche,v_room.precio,0));
  v_old_nights:=greatest(1,v_old_end-v_old_start);
  v_new_nights:=greatest(1,p_new_end-v_old_start);
  v_new_room_total:=round(v_old_rate*v_old_nights+v_extra_net,2);
  v_new_avg:=round(v_new_room_total/v_new_nights,6);

  select coalesce(jsonb_agg(case when ord=target_ord then e||jsonb_build_object('fecha_salida',p_new_end,'noches',v_new_nights,'tarifa_noche',v_new_avg,'extension_from',v_old_end,'extension_nights',v_extra_nights,'extension_rate_net',v_extra_avg,'extension_net_total',v_extra_net,'rate_segments',coalesce(e->'rate_segments','[]'::jsonb)||jsonb_build_array(jsonb_build_object('kind','extension','from',v_old_end,'to',p_new_end,'nights',v_extra_nights,'avg_rate_net',v_extra_avg,'net_total',v_extra_net))) else e end order by ord),'[]'::jsonb) into v_details
  from (
    select e,ord,max(ord) filter(where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id) over() target_ord
    from jsonb_array_elements(coalesce((select habitaciones_detalle from public.reservas where id=v.id),'[]'::jsonb)) with ordinality t(e,ord)
  ) q;

  select coalesce(sum(case when coalesce(e->>'segment_role','') in('previous_room','cancelled_room') then 0 else greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0)) end),0) into v_total_rate from jsonb_array_elements(v_details) e;
  v_new_global_end:=greatest(v.fecha_salida,p_new_end);
  v_new_net:=round(coalesce(v.precio_sin_impuestos_nacionales,v.subtotal,v.precio_total,0)+v_extra_net,2);
  v_vat:=case when coalesce(v.impuestos_desglosados,false) then round(v_new_net*greatest(0,coalesce(v.iva_porcentaje,0))/100,2) else 0 end;
  v_total:=round(v_new_net+v_vat,2);
  update public.reservas set habitaciones_detalle=v_details,fecha_salida=v_new_global_end,tarifa_noche=v_total_rate,subtotal=v_new_net,precio_sin_impuestos_nacionales=v_new_net,iva_importe=v_vat,precio_total=v_total,precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end where id=v.id returning * into v;
  update public.hotel_reservation_guests
  set stay_to=p_new_end,updated_at=now()
  where property_id=v.property_id and reservation_id=v.id and room_id=p_room_id and checked_out_at is null
    and (stay_to is null or stay_to>=v_old_end);
  get diagnostics v_guest_rows=row_count;
  perform private.hl_sync_reservation_folios_internal(v.id);
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'room_extension','Extensión de habitación',format('Hab. %s · %s → %s · %s noche(s) nuevas con tarifa vigente',coalesce(v_room.nombre,p_room_id::text),v_old_end,p_new_end,v_extra_nights),jsonb_build_object('room_id',p_room_id,'old_end',v_old_end,'new_end',p_new_end,'extra_nights',v_extra_nights,'extra_net',v_extra_net,'extra_avg_rate',v_extra_avg,'guest_rows_extended',v_guest_rows),auth.uid());
  return v;
end;
$function$;


with latest as (
  select distinct on ((e.payload->>'item_id')::uuid)
    (e.payload->>'item_id')::uuid item_id,
    e.property_id,
    e.reservation_id,
    (e.payload->>'to_folio_id')::uuid folio_id,
    e.actor_user_id assigned_by,
    e.created_at
  from public.hotel_reservation_events e
  join public.hotel_folio_items i on i.id=(e.payload->>'item_id')::uuid
  join public.hotel_folios f on f.id=(e.payload->>'to_folio_id')::uuid and f.reservation_id=e.reservation_id
  where e.event_type='folio_item_moved'
    and coalesce(e.payload->>'item_id','') ~ '^[0-9a-fA-F-]{36}$'
    and coalesce(e.payload->>'to_folio_id','') ~ '^[0-9a-fA-F-]{36}$'
  order by (e.payload->>'item_id')::uuid,e.created_at desc
)
insert into private.hl_folio_item_assignments(item_id,property_id,reservation_id,folio_id,assignment_source,assigned_by,created_at,updated_at)
select item_id,property_id,reservation_id,folio_id,'event_backfill',assigned_by,created_at,now()
from latest
on conflict(item_id) do update set folio_id=excluded.folio_id,assignment_source='event_backfill',assigned_by=excluded.assigned_by,updated_at=now();

update public.hotel_folio_items i
set folio_id=a.folio_id,updated_at=now()
from private.hl_folio_item_assignments a
join public.hotel_folios f on f.id=a.folio_id and f.status<>'void'
where a.item_id=i.id and i.invoice_document_id is null and i.folio_id is distinct from a.folio_id;

