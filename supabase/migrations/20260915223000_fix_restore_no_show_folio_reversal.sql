-- Corrige la reapertura de No Show para que la decisión sobre la penalidad
-- sea consistente entre la reserva, los servicios y el folio.
--
-- Reglas:
--   * remove: quita el servicio No Show, libera sus aplicaciones de pago y
--             anula (status=void) el cargo no facturado, conservando trazabilidad.
--   * keep:   conserva importe/estado de la penalidad y sus cargos.
--   * si el cargo ya quedó vinculado a un comprobante, no se altera en silencio:
--             requiere resolver primero el documento fiscal correspondiente.

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
  v_voided_folio_count integer := 0;
  v_invoiced_penalty_count integer := 0;
  v_penalty_item_ids uuid[] := '{}'::uuid[];
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Tenés que iniciar sesión.';
  end if;

  select * into v
  from public.reservas
  where id=p_reserva_id
  for update;

  if not found then
    raise exception using errcode='P0002', message='Reserva inexistente.';
  end if;

  if not private.user_has_property_role(
    v.property_id,
    array['owner','admin','manager','reception','night_audit']::text[]
  ) then
    raise exception using errcode='42501', message='No tenés permisos para reabrir un No Show.';
  end if;

  if not coalesce(v.no_show,false) then
    return v;
  end if;

  if v_action not in ('remove','keep') then
    raise exception using errcode='22023', message='Indicá si querés quitar o mantener la penalidad.';
  end if;

  v_previous_penalty := greatest(0,coalesce(v.no_show_penalty_amount,0));
  v_previous_status := coalesce(v.no_show_penalty_status,'none');
  v_services := coalesce(v.servicios,'[]'::jsonb);

  if v_action='remove' then
    -- Nunca se modifica en silencio una penalidad que ya forma parte de un
    -- comprobante. La corrección fiscal debe resolverse explícitamente.
    select count(*)
      into v_invoiced_penalty_count
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
      );

    if v_invoiced_penalty_count>0 then
      raise exception using
        errcode='22023',
        message='La penalidad de No Show ya está vinculada a un comprobante. Resolvé primero el ajuste fiscal correspondiente o reabrí la reserva manteniendo la penalidad.';
    end if;

    -- Quita del JSON operativo únicamente el servicio que representa la
    -- penalidad. El resto de los consumos/servicios permanece intacto.
    select
      coalesce(jsonb_agg(s order by ord) filter (where not is_penalty),'[]'::jsonb),
      count(*) filter (where is_penalty)
    into v_services,v_removed_count
    from (
      select
        s,
        ord,
        (
          lower(coalesce(s->>'no_show_penalty','false'))='true'
          or s->>'id'='no-show-penalty-'||v.id::text
          or (
            lower(trim(coalesce(s->>'nombre','')))='penalidad no show'
            and lower(trim(coalesce(s->>'categoria','')))='fee'
          )
        ) as is_penalty
      from jsonb_array_elements(coalesce(v.servicios,'[]'::jsonb))
        with ordinality t(s,ord)
    ) q;

    select coalesce(array_agg(i.id),'{}'::uuid[])
      into v_penalty_item_ids
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

    if cardinality(v_penalty_item_ids)>0 then
      -- El pago no se elimina: sólo deja de aplicarse a la penalidad y vuelve
      -- a quedar disponible como crédito de la estadía.
      delete from public.hotel_folio_item_payment_allocations
      where reservation_id=v.id
        and folio_item_id=any(v_penalty_item_ids);

      -- No se borra el cargo: se anula para conservar una pista financiera
      -- completa de lo ocurrido.
      update public.hotel_folio_items
      set status='void',
          metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'void_reason','no_show_restored',
            'voided_at',now(),
            'voided_by',auth.uid(),
            'previous_no_show_penalty_amount',v_previous_penalty,
            'previous_no_show_penalty_status',v_previous_status
          ),
          updated_at=now()
      where id=any(v_penalty_item_ids)
        and status='active'
        and invoice_document_id is null;

      get diagnostics v_voided_folio_count = row_count;
    end if;
  end if;

  insert into public.hotel_no_show_history(
    property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,original_noches,
    original_tarifa_noche,original_precio_total,currency,release_date,penalty_amount,penalty_status,
    had_guarantee,guarantee_id,note,snapshot,created_by
  ) values(
    v.property_id,v.id,'restored',v.fecha_entrada,v.fecha_salida,
    coalesce(v.noches,greatest(1,v.fecha_salida-v.fecha_entrada)),v.tarifa_noche,v.precio_total,
    coalesce(v.moneda,'ARS'),v.no_show_release_date,v_previous_penalty,v_previous_status,false,null,
    nullif(trim(coalesce(p_note,'')),''),
    jsonb_build_object(
      'previous_no_show_at',v.no_show_at,
      'penalty_action',v_action,
      'previous_penalty_amount',v_previous_penalty,
      'previous_penalty_status',v_previous_status,
      'removed_penalty_services',v_removed_count,
      'voided_penalty_folio_items',v_voided_folio_count,
      'penalty_folio_item_ids',to_jsonb(v_penalty_item_ids)
    ),auth.uid()
  );

  update public.reservas
  set no_show=false,
      no_show_at=null,
      no_show_release_date=null,
      no_show_penalty_amount=case
        when v_action='remove' then 0
        else v_previous_penalty
      end,
      no_show_penalty_status=case
        when v_action='remove' then 'none'
        else v_previous_status
      end,
      no_show_note=null,
      servicios=case when v_action='remove' then v_services else servicios end
  where id=v.id
  returning * into v;

  insert into public.hotel_reservation_events(
    property_id,reservation_id,event_type,title,detail,payload,actor_user_id
  ) values(
    v.property_id,v.id,'no_show_restored','No Show reabierto',
    case when v_action='remove'
      then 'La reserva volvió a estado operativo y la penalidad de No Show fue anulada. Cualquier pago ya registrado permanece a cuenta de la estadía.'
      else 'La reserva volvió a estado operativo y recepción decidió mantener la penalidad de No Show.'
    end,
    jsonb_build_object(
      'restored',true,
      'penalty_action',v_action,
      'previous_penalty_amount',v_previous_penalty,
      'previous_penalty_status',v_previous_status,
      'removed_penalty_services',v_removed_count,
      'voided_penalty_folio_items',v_voided_folio_count,
      'penalty_folio_item_ids',to_jsonb(v_penalty_item_ids)
    ),auth.uid()
  );

  return v;
end;
$function$;

revoke all on function public.hl_restore_no_show_atomic(bigint,text,text) from public;
revoke all on function public.hl_restore_no_show_atomic(bigint,text,text) from anon;
grant execute on function public.hl_restore_no_show_atomic(bigint,text,text) to authenticated;
