create or replace function public.hl_settle_payment_request(
  p_request_id uuid,
  p_provider_payment_id text,
  p_amount numeric,
  p_method text default 'Mercado Pago'::text
)
returns public.pagos
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_req public.hotel_payment_requests;
  v_payment public.pagos;
  v_user uuid := auth.uid();
  v_role text := coalesce(auth.role(), '');
  v_actor uuid;
begin
  select * into v_req
  from public.hotel_payment_requests
  where id = p_request_id
  for update;

  if v_req.id is null then
    raise exception 'Solicitud de pago no encontrada.';
  end if;

  if v_role <> 'service_role' then
    if v_user is null then
      raise exception 'Tenés que iniciar sesión.';
    end if;
    if not private.user_has_property_role(v_req.property_id, array['owner','manager','reception','admin','night_audit']) then
      raise exception 'No tenés permiso para confirmar este cobro.';
    end if;
  end if;

  v_actor := coalesce(v_user, v_req.created_by);
  if v_actor is null then
    raise exception 'La solicitud no tiene un usuario responsable para registrar el cobro.';
  end if;

  if abs(coalesce(p_amount,0) - v_req.amount) > 0.01 then
    raise exception 'El importe confirmado por la pasarela no coincide con la solicitud.';
  end if;

  select * into v_payment
  from public.pagos
  where property_id = v_req.property_id
    and provider = v_req.provider
    and external_ref = p_provider_payment_id
  limit 1;

  if v_payment.id is not null then
    if v_payment.reserva_id <> v_req.reserva_id then
      raise exception 'Ese cobro externo ya está vinculado a otra reserva.';
    end if;
  else
    insert into public.pagos(
      property_id,user_id,created_by,reserva_id,monto,metodo,moneda,nota,estado,
      source,provider,external_ref,referencia,payment_request_id
    ) values (
      v_req.property_id,v_actor,v_actor,v_req.reserva_id,v_req.amount,
      coalesce(nullif(p_method,''),'Mercado Pago'),v_req.currency,
      'Confirmado automáticamente por enlace de pago','confirmado','payment_link',
      v_req.provider,p_provider_payment_id,p_provider_payment_id,v_req.id
    )
    returning * into v_payment;
  end if;

  update public.hotel_payment_requests
  set status='approved',
      provider_payment_id=p_provider_payment_id,
      approved_at=coalesce(approved_at,now()),
      updated_at=now()
  where id=v_req.id;

  return v_payment;
end
$function$;
