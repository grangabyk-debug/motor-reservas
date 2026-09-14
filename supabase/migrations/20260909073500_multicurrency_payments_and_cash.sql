-- Multimoneda para cobros y arqueo de caja.
-- pagos.monto / pagos.moneda siguen siendo el importe contable en la moneda de la reserva.
-- payment_amount / payment_currency registran lo que efectivamente entrego el huesped.

alter table public.pagos
  add column if not exists payment_currency text,
  add column if not exists payment_amount numeric,
  add column if not exists fx_rate numeric,
  add column if not exists fx_source text,
  add column if not exists fx_as_of date;

update public.pagos
set payment_currency = case when upper(coalesce(moneda,'ARS')) in ('ARS','USD') then upper(coalesce(moneda,'ARS')) else 'ARS' end,
    payment_amount = monto,
    fx_rate = 1
where payment_currency is null or payment_amount is null or fx_rate is null;

alter table public.pagos
  alter column payment_currency set not null,
  alter column payment_amount set not null,
  alter column fx_rate set not null;

do $$ begin
  alter table public.pagos add constraint pagos_payment_currency_check check (payment_currency in ('ARS','USD'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pagos add constraint pagos_payment_amount_positive_check check (payment_amount > 0);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.pagos add constraint pagos_fx_rate_positive_check check (fx_rate > 0);
exception when duplicate_object then null; end $$;

alter table public.hotel_cash_sessions
  add column if not exists opening_amount_usd numeric not null default 0,
  add column if not exists closing_amount_usd numeric,
  add column if not exists expected_amount_usd numeric;

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
    new.monto:=case
      when v_reservation_currency='USD' and v_payment_currency='ARS' then round(v_payment_amount/v_fx,2)
      when v_reservation_currency='ARS' and v_payment_currency='USD' then round(v_payment_amount*v_fx,2)
      else round(v_payment_amount,2)
    end;
    new.fx_source:=coalesce(nullif(trim(new.fx_source),''),'Manual');
    new.fx_as_of:=coalesce(new.fx_as_of,current_date);
  end if;
  return new;
end;
$$;

revoke all on function private.hl_normalize_payment_currency() from public;

drop trigger if exists trg_payment_currency_normalize on public.pagos;
create trigger trg_payment_currency_normalize
before insert or update of reserva_id,property_id,moneda,payment_currency,payment_amount,fx_rate
on public.pagos
for each row execute function private.hl_normalize_payment_currency();

create or replace function public.hl_cash_from_cash_payment()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare v_session uuid; v_currency text; v_amount numeric;
begin
  if lower(trim(coalesce(new.metodo,''))) not in ('efectivo','cash') then return new; end if;
  select id into v_session from public.hotel_cash_sessions where property_id=new.property_id and status='open' order by opened_at desc limit 1;
  if v_session is null then return new; end if;
  v_currency:=upper(coalesce(new.payment_currency,new.moneda,'ARS'));
  v_amount:=coalesce(new.payment_amount,new.monto,0);
  if v_currency not in ('ARS','USD') or v_amount<=0 then return new; end if;
  insert into public.hotel_cash_movements(property_id,session_id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by)
  values(new.property_id,v_session,new.reserva_id,'income','Efectivo',v_amount,v_currency,'Cobro en efectivo · reserva '||new.reserva_id,'pago:'||new.id::text,coalesce(new.created_by,new.user_id,auth.uid()))
  on conflict do nothing;
  return new;
end;
$$;

create or replace function private.hl_log_reservation_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_row public.pagos%rowtype;
  v_actor uuid:=auth.uid();
  v_name text:=private.hl_event_actor_name();
  v_type text;
  v_title text;
  v_detail text;
begin
  v_row:=case when tg_op='DELETE' then old else new end;
  if v_row.reserva_id is null then return coalesce(new,old); end if;
  v_type:=case when tg_op='INSERT' then 'payment_added' when tg_op='DELETE' then 'payment_removed' else 'payment_changed' end;
  v_title:=case when tg_op='INSERT' then 'Pago añadido' when tg_op='DELETE' then 'Pago eliminado' else 'Pago modificado' end;
  v_detail:=coalesce(v_row.metodo,'Pago')||' · '||coalesce(v_row.moneda,'ARS')||' '||coalesce(v_row.monto,0)::text;
  if coalesce(v_row.payment_currency,v_row.moneda) is distinct from v_row.moneda then
    v_detail:=v_detail||' · recibido '||v_row.payment_currency||' '||coalesce(v_row.payment_amount,0)::text||' · TC '||coalesce(v_row.fx_rate,0)::text;
  end if;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
  values(v_row.property_id,v_row.reserva_id,v_type,v_title,v_detail,
    jsonb_build_object('payment_id',v_row.id,'amount',v_row.monto,'currency',v_row.moneda,'method',v_row.metodo,'note',v_row.nota,'payment_amount',v_row.payment_amount,'payment_currency',v_row.payment_currency,'fx_rate',v_row.fx_rate,'fx_source',v_row.fx_source,'fx_as_of',v_row.fx_as_of),v_actor,v_name);
  return coalesce(new,old);
end;
$$;
