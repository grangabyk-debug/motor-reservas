alter table public.reservas
  add column if not exists descuento_motivo text,
  add column if not exists descuento_origen text;

alter table public.reservas alter column descuento_tipo set default 'none';

alter table public.reservas drop constraint if exists reservas_descuento_tipo_check;
alter table public.reservas add constraint reservas_descuento_tipo_check
  check (descuento_tipo in ('none','percent','amount','porcentaje','monto'));

alter table public.reservas drop constraint if exists reservas_descuento_origen_check;
alter table public.reservas add constraint reservas_descuento_origen_check
  check (descuento_origen is null or descuento_origen in ('manual','rule','promotion','package','channel'));

alter table public.reservas drop constraint if exists reservas_descuento_motivo_required_check;
alter table public.reservas add constraint reservas_descuento_motivo_required_check
  check (coalesce(descuento_importe,0)<=0 or nullif(trim(coalesce(descuento_motivo,'')),'') is not null);

create or replace function public.hl_create_reservation_atomic(p_reservation jsonb, p_payments jsonb default '[]'::jsonb)
returns public.reservas
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  p jsonb;
  v_property uuid;
  v_user uuid;
  v_discount_type text;
  v_discount_value numeric;
  v_discount_amount numeric;
  v_discount_reason text;
  v_discount_origin text;
begin
  if p_reservation is null or jsonb_typeof(p_reservation)<>'object' then
    raise exception using errcode='22023',message='Datos de reserva inválidos.';
  end if;
  if p_payments is null then p_payments:='[]'::jsonb; end if;
  if jsonb_typeof(p_payments)<>'array' then
    raise exception using errcode='22023',message='Los pagos iniciales deben ser una lista.';
  end if;

  v_property:=nullif(p_reservation->>'property_id','')::uuid;
  v_user:=nullif(p_reservation->>'user_id','')::uuid;
  if v_property is null then
    raise exception using errcode='23502',message='Falta la propiedad de la reserva.';
  end if;

  v_discount_type:=coalesce(nullif(trim(coalesce(p_reservation->>'descuento_tipo','')),''),'none');
  v_discount_value:=greatest(0,coalesce(nullif(p_reservation->>'descuento_valor','')::numeric,0));
  v_discount_amount:=greatest(0,coalesce(nullif(p_reservation->>'descuento_importe','')::numeric,0));
  v_discount_reason:=nullif(trim(coalesce(p_reservation->>'descuento_motivo','')),'');
  v_discount_origin:=nullif(trim(coalesce(p_reservation->>'descuento_origen','')),'');

  if v_discount_amount>0 then
    if v_discount_type not in ('percent','amount','porcentaje','monto') then
      raise exception using errcode='22023',message='Elegí un tipo de descuento válido.';
    end if;
    if v_discount_reason is null then
      raise exception using errcode='22023',message='Indicá el motivo del descuento.';
    end if;
    if v_discount_origin is null then v_discount_origin:='manual'; end if;
  else
    v_discount_type:='none';
    v_discount_value:=0;
    v_discount_amount:=0;
    v_discount_reason:=null;
    v_discount_origin:=null;
  end if;

  insert into public.reservas(
    property_id,user_id,alojamiento_id,habitacion_id,habitaciones_ids,habitaciones_detalle,
    fecha_entrada,fecha_salida,tipo_estadia,nombre_huesped,email_huesped,telefono_huesped,dni_huesped,
    direccion_huesped,provincia_estado_huesped,pais_huesped,cantidad_huespedes,canal_reserva,codigo_canal,
    tarifa_noche,noches,subtotal,descuento_tipo,descuento_valor,descuento_importe,descuento_motivo,descuento_origen,
    precio_total,moneda,notas,partner_id,group_id,garantia_tipo,garantia_marca,garantia_ultimos4,garantia_vencimiento,
    medio_pago_preferido,vehiculos,tipo_vehiculo,dominio_vehiculo,cochera_total,mascotas,mascotas_total,servicios,pasajeros,
    hora_llegada_estimada,hora_salida_estimada,estado,no_show,cancellation_policy_id,cancellation_policy_snapshot
  ) values(
    v_property,v_user,nullif(p_reservation->>'alojamiento_id','')::bigint,nullif(p_reservation->>'habitacion_id','')::bigint,
    array(select value::bigint from jsonb_array_elements_text(coalesce(p_reservation->'habitaciones_ids','[]'::jsonb))),
    coalesce(p_reservation->'habitaciones_detalle','[]'::jsonb),nullif(p_reservation->>'fecha_entrada','')::date,
    nullif(p_reservation->>'fecha_salida','')::date,coalesce(nullif(p_reservation->>'tipo_estadia',''),'overnight'),
    coalesce(p_reservation->>'nombre_huesped',''),nullif(p_reservation->>'email_huesped',''),nullif(p_reservation->>'telefono_huesped',''),
    nullif(p_reservation->>'dni_huesped',''),nullif(p_reservation->>'direccion_huesped',''),nullif(p_reservation->>'provincia_estado_huesped',''),
    nullif(p_reservation->>'pais_huesped',''),greatest(1,coalesce(nullif(p_reservation->>'cantidad_huespedes','')::integer,1)),
    coalesce(nullif(p_reservation->>'canal_reserva',''),'Directa'),nullif(p_reservation->>'codigo_canal',''),
    coalesce(nullif(p_reservation->>'tarifa_noche','')::numeric,0),coalesce(nullif(p_reservation->>'noches','')::integer,0),
    coalesce(nullif(p_reservation->>'subtotal','')::numeric,0),v_discount_type,v_discount_value,v_discount_amount,v_discount_reason,v_discount_origin,
    coalesce(nullif(p_reservation->>'precio_total','')::numeric,0),coalesce(nullif(p_reservation->>'moneda',''),'ARS'),nullif(p_reservation->>'notas',''),
    nullif(p_reservation->>'partner_id','')::uuid,nullif(p_reservation->>'group_id','')::uuid,nullif(p_reservation->>'garantia_tipo',''),
    nullif(p_reservation->>'garantia_marca',''),nullif(p_reservation->>'garantia_ultimos4',''),nullif(p_reservation->>'garantia_vencimiento',''),
    nullif(p_reservation->>'medio_pago_preferido',''),greatest(0,coalesce(nullif(p_reservation->>'vehiculos','')::integer,0)),
    nullif(p_reservation->>'tipo_vehiculo',''),nullif(p_reservation->>'dominio_vehiculo',''),coalesce(nullif(p_reservation->>'cochera_total','')::numeric,0),
    coalesce(p_reservation->'mascotas','[]'::jsonb),coalesce(nullif(p_reservation->>'mascotas_total','')::numeric,0),
    coalesce(p_reservation->'servicios','[]'::jsonb),coalesce(p_reservation->'pasajeros','[]'::jsonb),
    nullif(p_reservation->>'hora_llegada_estimada',''),nullif(p_reservation->>'hora_salida_estimada',''),
    coalesce(nullif(p_reservation->>'estado',''),'confirmada'),coalesce(nullif(p_reservation->>'no_show','')::boolean,false),
    nullif(p_reservation->>'cancellation_policy_id','')::uuid,coalesce(p_reservation->'cancellation_policy_snapshot','{}'::jsonb)
  ) returning * into v;

  for p in select value from jsonb_array_elements(p_payments) loop
    if coalesce(nullif(p->>'monto','')::numeric,0)<=0 then
      raise exception using errcode='22023',message='Hay un pago inicial con monto inválido.';
    end if;
    if nullif(trim(coalesce(p->>'metodo','')),'') is null then
      raise exception using errcode='22023',message='Hay un pago inicial sin medio de pago.';
    end if;
    insert into public.pagos(property_id,user_id,reserva_id,monto,metodo,moneda,nota)
    values(v.property_id,coalesce(nullif(p->>'user_id','')::uuid,v_user),v.id,(p->>'monto')::numeric,trim(p->>'metodo'),coalesce(nullif(p->>'moneda',''),'ARS'),nullif(p->>'nota',''));
  end loop;
  return v;
end;
$function$;

do $do$
begin
  if to_regprocedure('private.hl_sync_reservation_folios_internal(bigint)') is not null
     and to_regprocedure('private.hl_sync_reservation_folios_internal_legacy(bigint)') is null then
    execute 'alter function private.hl_sync_reservation_folios_internal(bigint) rename to hl_sync_reservation_folios_internal_legacy';
  end if;
end
$do$;

create or replace function private.hl_sync_reservation_folios_internal(p_reservation_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  r public.reservas%rowtype;
  master_folio uuid;
  discount_title text;
begin
  perform private.hl_sync_reservation_folios_internal_legacy(p_reservation_id);

  update public.hotel_folio_items
  set status='void',updated_at=now()
  where reservation_id=p_reservation_id
    and source_type='adjustment'
    and source_key like 'reservation:adjustment%'
    and invoice_document_id is null
    and coalesce(metadata->>'auto_synced','false')='true';

  select * into r from public.reservas where id=p_reservation_id;
  if not found then return; end if;

  if coalesce(r.descuento_importe,0)>0 then
    select id into master_folio
    from public.hotel_folios
    where reservation_id=p_reservation_id and folio_type='master' and status<>'void'
    order by sort_order,created_at
    limit 1;

    discount_title := case
      when r.descuento_tipo in ('percent','porcentaje') and coalesce(r.descuento_valor,0)>0
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
end;
$function$;

update public.hotel_folio_items
set status='void',updated_at=now()
where source_type='adjustment'
  and source_key like 'reservation:adjustment%'
  and invoice_document_id is null
  and coalesce(metadata->>'auto_synced','false')='true';

drop trigger if exists trg_reservation_folio_sync on public.reservas;
create trigger trg_reservation_folio_sync
after insert or update of habitacion_id,habitaciones_ids,habitaciones_detalle,fecha_entrada,fecha_salida,noches,tarifa_noche,subtotal,precio_total,moneda,servicios,cochera_total,mascotas_total,early_checkin_importe,late_checkout_importe,extra,extra_descripcion,descuento_tipo,descuento_valor,descuento_importe,descuento_motivo,descuento_origen,regimen
on public.reservas
for each row execute function private.hl_reservation_folio_sync_trigger();
