create or replace function public.hl_refund_payment_atomic(
  p_payment_id bigint,
  p_amount numeric,
  p_reason text,
  p_external_refund_confirmed boolean default false
)
returns public.pagos
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_payment public.pagos%rowtype;
  v_result public.pagos%rowtype;
  v_remaining numeric;
  v_new_refunded numeric;
  v_reason text:=nullif(trim(coalesce(p_reason,'')),'');
  v_external boolean:=false;
  v_session_id uuid;
  v_physical_currency text;
  v_physical_total numeric;
  v_physical_refund numeric;
  v_reference text;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v_payment
  from public.pagos
  where id=p_payment_id
  for update;

  if not found then
    raise exception using errcode='P0002',message='No encontramos el pago.';
  end if;

  if not private.user_has_property_role(v_payment.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para registrar una devolución.';
  end if;

  if lower(coalesce(v_payment.estado,'')) in ('anulado','cancelado','void','rechazado','cancelled') then
    raise exception using errcode='P0001',message='Ese pago ya no está activo.';
  end if;

  if coalesce(v_payment.monto,0)<=0 then
    raise exception using errcode='P0001',message='El pago no tiene un importe reembolsable.';
  end if;

  if p_amount is null or p_amount<=0 then
    raise exception using errcode='22023',message='Ingresá un importe de devolución mayor a cero.';
  end if;

  if v_reason is null then
    raise exception using errcode='22023',message='Indicá el motivo de la devolución.';
  end if;

  v_remaining:=greatest(0,coalesce(v_payment.monto,0)-coalesce(v_payment.refunded_amount,0));
  if v_remaining<=.009 then
    raise exception using errcode='P0001',message='Ese pago ya fue devuelto por completo.';
  end if;
  if p_amount>v_remaining+.009 then
    raise exception using errcode='22023',message='La devolución supera el importe todavía disponible del pago.';
  end if;

  v_external:=nullif(trim(coalesce(v_payment.provider,'')),'') is not null
    or nullif(trim(coalesce(v_payment.external_ref,'')),'') is not null
    or lower(trim(coalesce(v_payment.source,''))) in ('mercadopago','online','payment_request','booking_engine','ota','channex');

  if v_external and not coalesce(p_external_refund_confirmed,false) then
    raise exception using errcode='P0001',message='Este pago provino de un proveedor externo. Confirmá primero la devolución en el proveedor y luego registrala en Habitación Llena.';
  end if;

  v_new_refunded:=least(coalesce(v_payment.monto,0),coalesce(v_payment.refunded_amount,0)+p_amount);

  update public.pagos
  set refunded_amount=v_new_refunded,
      estado=case when v_new_refunded>=coalesce(monto,0)-.009 then 'reembolsado' else estado end,
      updated_at=now()
  where id=v_payment.id
  returning * into v_result;

  v_physical_currency:=upper(coalesce(nullif(v_payment.payment_currency,''),nullif(v_payment.moneda,''),'ARS'));
  v_physical_total:=greatest(0,coalesce(v_payment.payment_amount,v_payment.monto,0));
  v_physical_refund:=case
    when coalesce(v_payment.monto,0)>0 then round((p_amount/v_payment.monto)*v_physical_total,2)
    else p_amount
  end;

  select id into v_session_id
  from public.hotel_cash_sessions
  where property_id=v_payment.property_id and status='open'
  order by opened_at desc
  limit 1;

  v_reference:='refund:pago:'||v_payment.id::text||':'||replace(gen_random_uuid()::text,'-','');
  insert into public.hotel_cash_movements(
    property_id,session_id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by
  ) values(
    v_payment.property_id,v_session_id,v_payment.reserva_id,'refund',v_payment.metodo,
    v_physical_refund,v_physical_currency,
    'Devolución de pago · '||v_reason,v_reference,auth.uid()
  );

  insert into public.hotel_reservation_events(
    property_id,reservation_id,event_type,title,detail,payload,actor_user_id
  ) values(
    v_payment.property_id,v_payment.reserva_id,'payment_refunded','Pago devuelto',
    coalesce(v_payment.metodo,'Pago')||' · '||coalesce(v_payment.moneda,'ARS')||' '||round(p_amount,2)::text||' · '||v_reason,
    jsonb_build_object(
      'payment_id',v_payment.id,
      'refund_amount',p_amount,
      'currency',coalesce(v_payment.moneda,'ARS'),
      'physical_refund_amount',v_physical_refund,
      'physical_currency',v_physical_currency,
      'previous_refunded_amount',coalesce(v_payment.refunded_amount,0),
      'new_refunded_amount',v_new_refunded,
      'full_refund',v_new_refunded>=coalesce(v_payment.monto,0)-.009,
      'external_payment',v_external,
      'external_refund_confirmed',coalesce(p_external_refund_confirmed,false),
      'reason',v_reason,
      'cash_movement_reference',v_reference
    ),auth.uid()
  );

  return v_result;
end;
$function$;

revoke all on function public.hl_refund_payment_atomic(bigint,numeric,text,boolean) from public;
revoke all on function public.hl_refund_payment_atomic(bigint,numeric,text,boolean) from anon;
grant execute on function public.hl_refund_payment_atomic(bigint,numeric,text,boolean) to authenticated;
