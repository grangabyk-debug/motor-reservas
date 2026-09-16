-- Blindaje de reapertura No Show.
-- 1) La firma legacy de 2 parámetros delega al flujo nuevo y quita la penalidad por defecto.
-- 2) Si la penalidad ya fue facturada, no se borra: se crea una contrapartida negativa trazable.

create or replace function public.hl_restore_no_show_atomic(
  p_reserva_id bigint,
  p_note text,
  p_penalty_action text
)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  v_action text := lower(trim(coalesce(p_penalty_action,'remove')));
  v_services jsonb := '[]'::jsonb;
  v_previous_penalty numeric := 0;
  v_previous_status text := 'none';
  v_removed_count integer := 0;
  v_uninvoiced_penalty_item_ids uuid[] := '{}'::uuid[];
  v_invoiced_item public.hotel_folio_items%rowtype;
  v_reversal_key text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v
  from public.reservas
  where id=p_reserva_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='Reserva inexistente.';
  end if;

  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para reabrir un No Show.';
  end if;

  if not coalesce(v.no_show,false) then
    return v;
  end if;

  if v_action not in ('remove','keep') then
    raise exception using errcode='22023',message='Indicá si querés quitar o mantener la penalidad.';
  end if;

  v_previous_penalty:=greatest(0,coalesce(v.no_show_penalty_amount,0));
  v_previous_status:=coalesce(v.no_show_penalty_status,'none');
  v_services:=coalesce(v.servicios,'[]'::jsonb);

  if v_action='remove' then
    -- Quitamos del snapshot operativo la penalidad para que el sincronizador
    -- anule cualquier línea auto-sincronizada todavía no facturada.
    select coalesce(jsonb_agg(s order by ord) filter(where not is_penalty),'[]'::jsonb),
           count(*) filter(where is_penalty)
    into v_services,v_removed_count
    from (
      select s,ord,
        (
          lower(coalesce(s->>'no_show_penalty','false'))='true'
          or s->>'id'='no-show-penalty-'||v.id::text
          or (
            lower(trim(coalesce(s->>'nombre','')))='penalidad no show'
            and lower(trim(coalesce(s->>'categoria','')))='fee'
          )
        ) as is_penalty
      from jsonb_array_elements(coalesce(v.servicios,'[]'::jsonb)) with ordinality t(s,ord)
    ) q;

    select coalesce(array_agg(i.id),'{}'::uuid[])
    into v_uninvoiced_penalty_item_ids
    from public.hotel_folio_items i
    where i.reservation_id=v.id
      and i.status='active'
      and i.invoice_document_id is null
      and (
        i.source_key='service:no-show-penalty-'||v.id::text
        or (
          lower(trim(coalesce(i.description,'')))='penalidad no show'
          and lower(trim(coalesce(i.source_type,'')))='fee'
        )
        or lower(coalesce(i.metadata->'source_payload'->>'no_show_penalty','false'))='true'
      );

    if cardinality(v_uninvoiced_penalty_item_ids)>0 then
      delete from public.hotel_folio_item_payment_allocations
      where reservation_id=v.id
        and folio_item_id=any(v_uninvoiced_penalty_item_ids);
    end if;

    -- Un cargo ya incluido en un comprobante emitido es inmutable. En lugar
    -- de borrarlo, registramos una contrapartida negativa en el mismo folio.
    for v_invoiced_item in
      select i.*
      from public.hotel_folio_items i
      where i.reservation_id=v.id
        and i.status='active'
        and i.invoice_document_id is not null
        and (
          i.source_key='service:no-show-penalty-'||v.id::text
          or (
            lower(trim(coalesce(i.description,'')))='penalidad no show'
            and lower(trim(coalesce(i.source_type,'')))='fee'
          )
          or lower(coalesce(i.metadata->'source_payload'->>'no_show_penalty','false'))='true'
        )
    loop
      v_reversal_key:='no-show-penalty-reversal:'||v_invoiced_item.id::text;
      insert into public.hotel_folio_items(
        property_id,folio_id,reservation_id,room_id,source_type,source_key,
        description,detail,service_date,quantity,unit_price,discount,tax_rate,tax,
        subtotal,total,currency,status,metadata,created_by
      ) values(
        v_invoiced_item.property_id,
        v_invoiced_item.folio_id,
        v_invoiced_item.reservation_id,
        v_invoiced_item.room_id,
        'adjustment',
        v_reversal_key,
        'Reversión penalidad No Show',
        'Huésped presentado · reversión del cargo previamente facturado',
        current_date,
        1,
        -abs(coalesce(v_invoiced_item.subtotal,v_invoiced_item.total,0)),
        0,
        coalesce(v_invoiced_item.tax_rate,0),
        -abs(coalesce(v_invoiced_item.tax,0)),
        -abs(coalesce(v_invoiced_item.subtotal,v_invoiced_item.total,0)),
        -abs(coalesce(v_invoiced_item.total,0)),
        coalesce(v_invoiced_item.currency,v.moneda,'ARS'),
        'active',
        jsonb_build_object(
          'no_show_penalty_reversal',true,
          'reverses_folio_item_id',v_invoiced_item.id,
          'original_invoice_document_id',v_invoiced_item.invoice_document_id,
          'reason','guest_arrived_after_no_show'
        ),
        auth.uid()
      )
      on conflict (reservation_id,source_key) where source_key is not null
      do nothing;
    end loop;
  end if;

  insert into public.hotel_no_show_history(
    property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,
    original_noches,original_tarifa_noche,original_precio_total,currency,release_date,
    penalty_amount,penalty_status,had_guarantee,guarantee_id,note,snapshot,created_by
  ) values(
    v.property_id,v.id,'restored',v.fecha_entrada,v.fecha_salida,
    coalesce(v.noches,greatest(1,v.fecha_salida-v.fecha_entrada)),v.tarifa_noche,v.precio_total,
    coalesce(v.moneda,'ARS'),v.no_show_release_date,v_previous_penalty,v_previous_status,
    false,null,nullif(trim(coalesce(p_note,'')),''),
    jsonb_build_object(
      'previous_no_show_at',v.no_show_at,
      'penalty_action',v_action,
      'previous_penalty_amount',v_previous_penalty,
      'previous_penalty_status',v_previous_status,
      'removed_penalty_services',v_removed_count
    ),auth.uid()
  );

  update public.reservas
  set no_show=false,
      no_show_at=null,
      no_show_release_date=null,
      no_show_penalty_amount=0,
      no_show_penalty_status='none',
      no_show_note=null,
      servicios=case when v_action='remove' then v_services else servicios end
  where id=v.id
  returning * into v;

  insert into public.hotel_reservation_events(
    property_id,reservation_id,event_type,title,detail,payload,actor_user_id
  ) values(
    v.property_id,v.id,'no_show_restored','No Show reabierto',
    case when v_action='remove'
      then 'La reserva volvió a estado operativo y la penalidad de No Show fue revertida. Cualquier pago ya registrado permanece a cuenta de la estadía.'
      else 'La reserva volvió a estado operativo y recepción decidió mantener la penalidad de No Show.'
    end,
    jsonb_build_object(
      'restored',true,
      'penalty_action',v_action,
      'previous_penalty_amount',v_previous_penalty,
      'previous_penalty_status',v_previous_status,
      'removed_penalty_services',v_removed_count
    ),auth.uid()
  );

  return v;
end;
$function$;

-- Compatibilidad: cualquier cliente viejo que aún use la firma de 2 parámetros
-- cae en el comportamiento seguro por defecto (quitar la penalidad).
create or replace function public.hl_restore_no_show_atomic(
  p_reserva_id bigint,
  p_note text default null
)
returns public.reservas
language sql
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select public.hl_restore_no_show_atomic(p_reserva_id,p_note,'remove');
$function$;

revoke all on function public.hl_restore_no_show_atomic(bigint,text,text) from public;
revoke all on function public.hl_restore_no_show_atomic(bigint,text,text) from anon;
grant execute on function public.hl_restore_no_show_atomic(bigint,text,text) to authenticated;
revoke all on function public.hl_restore_no_show_atomic(bigint,text) from public;
revoke all on function public.hl_restore_no_show_atomic(bigint,text) from anon;
grant execute on function public.hl_restore_no_show_atomic(bigint,text) to authenticated;
