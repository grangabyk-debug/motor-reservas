-- Permite cerrar exactamente un saldo cuando el redondeo a centavos de la moneda recibida
-- genera una diferencia minima de cambio. El monto contable sigue siendo el aplicado al folio.

create or replace function private.hl_normalize_payment_currency()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_reservation_currency text;
  v_payment_currency text;
  v_payment_amount numeric;
  v_fx numeric;
  v_expected numeric;
  v_requested numeric;
  v_tolerance numeric;
begin
  select upper(coalesce(r.moneda,'ARS'))
    into v_reservation_currency
  from public.reservas r
  where r.id=new.reserva_id
    and (new.property_id is null or r.property_id=new.property_id);

  if v_reservation_currency is null then raise exception 'No se encontró la reserva asociada al pago.'; end if;
  if v_reservation_currency not in ('ARS','USD') then raise exception 'La moneda contable de la reserva no es válida.'; end if;

  v_payment_currency:=upper(coalesce(nullif(trim(new.payment_currency),''),nullif(trim(new.moneda),''),v_reservation_currency));
  if v_payment_currency not in ('ARS','USD') then raise exception 'La moneda del cobro debe ser ARS o USD.'; end if;

  v_payment_amount:=coalesce(new.payment_amount,new.monto);
  if coalesce(v_payment_amount,0)<=0 then raise exception 'El importe recibido debe ser mayor a cero.'; end if;

  v_requested:=coalesce(new.monto,0);
  new.moneda:=v_reservation_currency;
  new.payment_currency:=v_payment_currency;
  new.payment_amount:=round(v_payment_amount,2);

  if v_payment_currency=v_reservation_currency then
    new.fx_rate:=1;
    new.monto:=round(v_payment_amount,2);
    new.fx_source:=coalesce(nullif(trim(new.fx_source),''),'Misma moneda');
  else
    v_fx:=coalesce(new.fx_rate,0);
    if v_fx<=0 then raise exception 'Falta una cotización USD/ARS válida para registrar el cobro.'; end if;
    new.fx_rate:=v_fx;
    v_expected:=case
      when v_reservation_currency='USD' and v_payment_currency='ARS' then round(v_payment_amount/v_fx,2)
      when v_reservation_currency='ARS' and v_payment_currency='USD' then round(v_payment_amount*v_fx,2)
      else round(v_payment_amount,2)
    end;
    v_tolerance:=case when v_reservation_currency='ARS' and v_payment_currency='USD' then greatest(.01,v_fx/200) else .01 end;
    new.monto:=case when v_requested>0 and abs(v_requested-v_expected)<=v_tolerance then round(v_requested,2) else v_expected end;
    new.fx_source:=coalesce(nullif(trim(new.fx_source),''),'Manual');
    new.fx_as_of:=coalesce(new.fx_as_of,current_date);
  end if;
  return new;
end;
$$;

revoke all on function private.hl_normalize_payment_currency() from public;
