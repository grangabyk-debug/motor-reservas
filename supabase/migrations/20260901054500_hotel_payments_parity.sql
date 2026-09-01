-- Payment operations parity for Habitación Llena.
-- Adds request links, deposits/guarantees ledger, OTA prepayments and atomic settlement.

alter table public.pagos add column if not exists estado text not null default 'confirmado';
alter table public.pagos add column if not exists source text not null default 'manual';
alter table public.pagos add column if not exists provider text;
alter table public.pagos add column if not exists external_ref text;
alter table public.pagos add column if not exists referencia text;
alter table public.pagos add column if not exists refunded_amount numeric(14,2) not null default 0;
alter table public.pagos add column if not exists updated_at timestamptz not null default now();
alter table public.pagos add column if not exists created_by uuid references auth.users(id) on delete set null;

create table if not exists public.hotel_payment_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reserva_id bigint not null references public.reservas(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS',
  status text not null default 'draft' check (status in ('draft','requested','pending','approved','failed','expired','cancelled')),
  provider text not null default 'mercadopago',
  provider_preference_id text,
  provider_payment_id text,
  init_point text,
  sandbox_init_point text,
  payer_email text,
  expires_at timestamptz,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pagos add column if not exists payment_request_id uuid references public.hotel_payment_requests(id) on delete set null;

create unique index if not exists hotel_payment_requests_provider_preference_uq
  on public.hotel_payment_requests(property_id,provider,provider_preference_id)
  where provider_preference_id is not null;
create unique index if not exists hotel_payment_requests_provider_payment_uq
  on public.hotel_payment_requests(property_id,provider,provider_payment_id)
  where provider_payment_id is not null;
create index if not exists hotel_payment_requests_reservation_idx
  on public.hotel_payment_requests(property_id,reserva_id,created_at desc);
create index if not exists hotel_payment_requests_status_idx
  on public.hotel_payment_requests(property_id,status,created_at desc);
create index if not exists pagos_payment_request_idx on public.pagos(payment_request_id);
create unique index if not exists pagos_provider_external_ref_uq
  on public.pagos(property_id,provider,external_ref)
  where provider is not null and external_ref is not null;

create table if not exists public.hotel_deposits (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reserva_id bigint not null references public.reservas(id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS',
  status text not null default 'held' check (status in ('held','applied','refunded','forfeited','cancelled')),
  method text not null default 'Depósito',
  reference text,
  notes text,
  held_at timestamptz not null default now(),
  applied_at timestamptz,
  refunded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_deposits_reservation_idx on public.hotel_deposits(property_id,reserva_id,created_at desc);
create index if not exists hotel_deposits_status_idx on public.hotel_deposits(property_id,status,created_at desc);

create table if not exists public.hotel_ota_prepayments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reserva_id bigint not null references public.reservas(id) on delete cascade,
  channel text not null,
  external_ref text not null,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'ARS',
  status text not null default 'reported' check (status in ('reported','converted','ignored')),
  raw_payload jsonb not null default '{}'::jsonb,
  reported_at timestamptz not null default now(),
  converted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,channel,external_ref)
);
create index if not exists hotel_ota_prepayments_reservation_idx on public.hotel_ota_prepayments(property_id,reserva_id,reported_at desc);
create index if not exists hotel_ota_prepayments_status_idx on public.hotel_ota_prepayments(property_id,status,reported_at desc);

alter table public.hotel_payment_requests enable row level security;
alter table public.hotel_deposits enable row level security;
alter table public.hotel_ota_prepayments enable row level security;

create policy hotel_payment_requests_select_access on public.hotel_payment_requests
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_payment_requests_write_operational on public.hotel_payment_requests
  for all to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));

create policy hotel_deposits_select_access on public.hotel_deposits
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_deposits_write_operational on public.hotel_deposits
  for all to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));

create policy hotel_ota_prepayments_select_access on public.hotel_ota_prepayments
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_ota_prepayments_write_operational on public.hotel_ota_prepayments
  for all to authenticated
  using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));

grant select,insert,update,delete on public.hotel_payment_requests to authenticated;
grant select,insert,update,delete on public.hotel_deposits to authenticated;
grant select,insert,update,delete on public.hotel_ota_prepayments to authenticated;

create or replace function public.hl_settle_payment_request(
  p_request_id uuid,
  p_provider_payment_id text,
  p_amount numeric,
  p_method text default 'Mercado Pago'
) returns public.pagos
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_req public.hotel_payment_requests;
  v_payment public.pagos;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Tenés que iniciar sesión.'; end if;
  select * into v_req from public.hotel_payment_requests where id=p_request_id for update;
  if v_req.id is null then raise exception 'Solicitud de pago no encontrada.'; end if;
  if not private.user_has_property_role(v_req.property_id,array['owner','manager','reception','admin','night_audit']) then
    raise exception 'No tenés permiso para confirmar este cobro.';
  end if;
  if abs(coalesce(p_amount,0)-v_req.amount) > 0.01 then
    raise exception 'El importe confirmado por la pasarela no coincide con la solicitud.';
  end if;
  select * into v_payment from public.pagos
    where property_id=v_req.property_id and provider=v_req.provider and external_ref=p_provider_payment_id
    limit 1;
  if v_payment.id is not null then
    if v_payment.reserva_id<>v_req.reserva_id then raise exception 'Ese cobro externo ya está vinculado a otra reserva.'; end if;
  else
    insert into public.pagos(property_id,user_id,created_by,reserva_id,monto,metodo,moneda,nota,estado,source,provider,external_ref,referencia,payment_request_id)
    values(v_req.property_id,v_user,v_user,v_req.reserva_id,v_req.amount,coalesce(nullif(p_method,''),'Mercado Pago'),v_req.currency,'Confirmado por enlace de pago','confirmado','payment_link',v_req.provider,p_provider_payment_id,p_provider_payment_id,v_req.id)
    returning * into v_payment;
  end if;
  update public.hotel_payment_requests
    set status='approved',provider_payment_id=p_provider_payment_id,approved_at=coalesce(approved_at,now()),updated_at=now()
    where id=v_req.id;
  return v_payment;
end $$;

create or replace function public.hl_apply_deposit(p_deposit_id uuid) returns public.pagos
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_dep public.hotel_deposits;
  v_payment public.pagos;
  v_ref text;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Tenés que iniciar sesión.'; end if;
  select * into v_dep from public.hotel_deposits where id=p_deposit_id for update;
  if v_dep.id is null then raise exception 'Depósito no encontrado.'; end if;
  if not private.user_has_property_role(v_dep.property_id,array['owner','manager','reception','admin','night_audit']) then raise exception 'No tenés permiso para aplicar depósitos.'; end if;
  v_ref:='deposit:'||v_dep.id::text;
  select * into v_payment from public.pagos where property_id=v_dep.property_id and provider='internal' and external_ref=v_ref limit 1;
  if v_payment.id is null then
    if v_dep.status<>'held' then raise exception 'Este depósito ya no está disponible para aplicar.'; end if;
    insert into public.pagos(property_id,user_id,created_by,reserva_id,monto,metodo,moneda,nota,estado,source,provider,external_ref,referencia)
    values(v_dep.property_id,v_user,v_user,v_dep.reserva_id,v_dep.amount,'Depósito aplicado',v_dep.currency,coalesce(v_dep.notes,'Depósito aplicado a la cuenta'),'confirmado','deposit','internal',v_ref,coalesce(v_dep.reference,v_ref))
    returning * into v_payment;
  end if;
  update public.hotel_deposits set status='applied',applied_at=coalesce(applied_at,now()),updated_at=now() where id=v_dep.id;
  return v_payment;
end $$;

create or replace function public.hl_refund_deposit(p_deposit_id uuid,p_note text default null) returns public.hotel_deposits
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare v_dep public.hotel_deposits; begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  select * into v_dep from public.hotel_deposits where id=p_deposit_id for update;
  if v_dep.id is null then raise exception 'Depósito no encontrado.'; end if;
  if not private.user_has_property_role(v_dep.property_id,array['owner','manager','admin','night_audit']) then raise exception 'Solo administración puede devolver depósitos.'; end if;
  if v_dep.status<>'held' then raise exception 'Solo se puede devolver un depósito que todavía está retenido.'; end if;
  update public.hotel_deposits set status='refunded',refunded_at=now(),notes=coalesce(nullif(p_note,''),notes),updated_at=now() where id=v_dep.id returning * into v_dep;
  return v_dep;
end $$;

create or replace function public.hl_convert_ota_prepayment(p_prepayment_id uuid) returns public.pagos
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
declare
  v_pre public.hotel_ota_prepayments;
  v_payment public.pagos;
  v_provider text;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Tenés que iniciar sesión.'; end if;
  select * into v_pre from public.hotel_ota_prepayments where id=p_prepayment_id for update;
  if v_pre.id is null then raise exception 'Prepago OTA no encontrado.'; end if;
  if not private.user_has_property_role(v_pre.property_id,array['owner','manager','reception','admin','night_audit']) then raise exception 'No tenés permiso para convertir prepagos.'; end if;
  v_provider:='ota:'||lower(regexp_replace(v_pre.channel,'[^a-zA-Z0-9]+','','g'));
  select * into v_payment from public.pagos where property_id=v_pre.property_id and provider=v_provider and external_ref=v_pre.external_ref limit 1;
  if v_payment.id is null then
    if v_pre.status<>'reported' then raise exception 'Este prepago ya fue procesado.'; end if;
    insert into public.pagos(property_id,user_id,created_by,reserva_id,monto,metodo,moneda,nota,estado,source,provider,external_ref,referencia)
    values(v_pre.property_id,v_user,v_user,v_pre.reserva_id,v_pre.amount,'Prepago '||v_pre.channel,v_pre.currency,'Convertido desde aviso del canal','confirmado','ota_prepayment',v_provider,v_pre.external_ref,v_pre.external_ref)
    returning * into v_payment;
  end if;
  update public.hotel_ota_prepayments set status='converted',converted_at=coalesce(converted_at,now()),updated_at=now() where id=v_pre.id;
  return v_payment;
end $$;

grant execute on function public.hl_settle_payment_request(uuid,text,numeric,text) to authenticated;
grant execute on function public.hl_apply_deposit(uuid) to authenticated;
grant execute on function public.hl_refund_deposit(uuid,text) to authenticated;
grant execute on function public.hl_convert_ota_prepayment(uuid) to authenticated;
revoke execute on function public.hl_settle_payment_request(uuid,text,numeric,text) from anon;
revoke execute on function public.hl_apply_deposit(uuid) from anon;
revoke execute on function public.hl_refund_deposit(uuid,text) from anon;
revoke execute on function public.hl_convert_ota_prepayment(uuid) from anon;

create unique index if not exists hotel_cash_movements_payment_ref_uq
  on public.hotel_cash_movements(property_id,reference)
  where reference like 'pago:%';

create or replace function public.hl_cash_from_cash_payment() returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
declare v_session uuid; begin
  if upper(coalesce(new.moneda,'ARS'))<>'ARS' or lower(trim(coalesce(new.metodo,''))) not in ('efectivo','cash') then return new; end if;
  select id into v_session from public.hotel_cash_sessions
    where property_id=new.property_id and status='open'
    order by opened_at desc limit 1;
  if v_session is null then return new; end if;
  insert into public.hotel_cash_movements(property_id,session_id,reservation_id,movement_type,method,amount,currency,concept,reference,created_by)
  values(new.property_id,v_session,new.reserva_id,'income','Efectivo',new.monto,'ARS','Cobro en efectivo · reserva '||new.reserva_id,'pago:'||new.id::text,coalesce(new.created_by,new.user_id,auth.uid()))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_cash_from_cash_payment on public.pagos;
create trigger trg_cash_from_cash_payment after insert on public.pagos for each row execute function public.hl_cash_from_cash_payment();
