-- Habitación Llena · ARCA / WSFEv1 fiscal foundation
-- Port de la arquitectura multi-tenant probada en Comercio Lleno, aislada por property_id.

create table if not exists public.hotel_arca_settings (
  property_id uuid primary key references public.properties(id) on delete cascade,
  enabled boolean not null default false,
  environment text not null default 'homologacion' check (environment in ('homologacion','produccion')),
  tax_id text not null check (tax_id ~ '^\d{11}$'),
  legal_name text,
  trade_name text,
  fiscal_address text,
  issuer_iva_condition text not null default 'monotributo' check (issuer_iva_condition in ('monotributo','responsable_inscripto','exento')),
  point_of_sale integer not null default 1 check (point_of_sale between 1 and 99999),
  default_receipt_type integer not null default 11 check (default_receipt_type in (1,6,11)),
  credential_slot text not null default 'tenant_vault' check (credential_slot = 'tenant_vault'),
  prices_include_vat boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hotel_arca_settings enable row level security;
revoke all on public.hotel_arca_settings from anon;
revoke insert,update,delete on public.hotel_arca_settings from authenticated;
grant select on public.hotel_arca_settings to authenticated;
grant all on public.hotel_arca_settings to service_role;
drop policy if exists hotel_arca_settings_read_property on public.hotel_arca_settings;
create policy hotel_arca_settings_read_property on public.hotel_arca_settings
for select to authenticated using (private.user_has_property_access(property_id));

create table if not exists public.hotel_arca_credentials (
  property_id uuid primary key references public.properties(id) on delete cascade,
  private_key_secret_id uuid,
  certificate_secret_id uuid,
  csr_pem text,
  certificate_subject text,
  certificate_expires_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.hotel_arca_credentials enable row level security;
revoke all on public.hotel_arca_credentials from public,anon,authenticated;
grant all on public.hotel_arca_credentials to service_role;

create table if not exists public.hotel_arca_wsaa_cache (
  property_id uuid not null references public.properties(id) on delete cascade,
  service text not null default 'wsfe',
  token text not null,
  sign text not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key(property_id,service)
);
alter table public.hotel_arca_wsaa_cache enable row level security;
revoke all on public.hotel_arca_wsaa_cache from public,anon,authenticated;
grant all on public.hotel_arca_wsaa_cache to service_role;

create table if not exists public.hotel_arca_invoice_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  request_id text not null,
  reservation_id bigint references public.reservas(id) on delete set null,
  finance_document_id uuid references public.hotel_finance_documents(id) on delete set null,
  receipt_type integer not null check (receipt_type in (1,6,11)),
  point_of_sale integer not null check (point_of_sale between 1 and 99999),
  currency text not null default 'ARS',
  amount numeric not null check (amount > 0),
  net_amount numeric not null default 0,
  vat_amount numeric not null default 0,
  exempt_amount numeric not null default 0,
  recipient_doc_type integer not null default 99,
  recipient_doc_number text not null default '0',
  recipient_iva_condition_id integer,
  status text not null default 'pending' check (status in ('pending','authorized','rejected','error')),
  receipt_number bigint,
  cae text,
  cae_expiration date,
  request_payload jsonb not null default '{}'::jsonb,
  response jsonb,
  error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,request_id)
);
create index if not exists hotel_arca_requests_property_created_idx on public.hotel_arca_invoice_requests(property_id,created_at desc);
create index if not exists hotel_arca_requests_reservation_idx on public.hotel_arca_invoice_requests(property_id,reservation_id,created_at desc);
create index if not exists hotel_arca_requests_document_idx on public.hotel_arca_invoice_requests(property_id,finance_document_id,created_at desc);
alter table public.hotel_arca_invoice_requests enable row level security;
revoke all on public.hotel_arca_invoice_requests from anon;
revoke insert,update,delete on public.hotel_arca_invoice_requests from authenticated;
grant select on public.hotel_arca_invoice_requests to authenticated;
grant all on public.hotel_arca_invoice_requests to service_role;
drop policy if exists hotel_arca_requests_read_property on public.hotel_arca_invoice_requests;
create policy hotel_arca_requests_read_property on public.hotel_arca_invoice_requests
for select to authenticated using (private.user_has_property_access(property_id));

create or replace function public.hl_arca_vault_upsert_secret(p_secret_id uuid,p_name text,p_secret text,p_description text default '')
returns uuid
language plpgsql
security definer
set search_path='public','vault','pg_temp'
as $$
declare
  v_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
  v_id uuid;
begin
  if v_role <> 'service_role' then raise exception 'Operación restringida'; end if;
  if p_secret is null or length(p_secret)<16 then raise exception 'Secreto inválido'; end if;
  if p_secret_id is null then
    v_id:=vault.create_secret(p_secret,p_name,p_description);
  else
    perform vault.update_secret(p_secret_id,p_secret,p_name,p_description);
    v_id:=p_secret_id;
  end if;
  return v_id;
end;$$;

create or replace function public.hl_arca_vault_read_secret(p_secret_id uuid)
returns text
language plpgsql
security definer
set search_path='public','vault','pg_temp'
as $$
declare
  v_role text:=coalesce(current_setting('request.jwt.claim.role',true),'');
  v_secret text;
begin
  if v_role <> 'service_role' then raise exception 'Operación restringida'; end if;
  select decrypted_secret into v_secret from vault.decrypted_secrets where id=p_secret_id;
  return v_secret;
end;$$;

revoke all on function public.hl_arca_vault_upsert_secret(uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.hl_arca_vault_read_secret(uuid) from public,anon,authenticated;
grant execute on function public.hl_arca_vault_upsert_secret(uuid,text,text,text) to service_role;
grant execute on function public.hl_arca_vault_read_secret(uuid) to service_role;
