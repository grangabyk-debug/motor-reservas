-- Accounting parity for Habitación Llena, localized for Argentina.
-- Creates a tenant-safe chart of accounts, expenses, accounting periods,
-- export history and a real-time double-entry ledger derived from hotel movements.

create table if not exists public.hotel_chart_accounts (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  code text not null,
  name text not null,
  kind text not null check (kind in ('asset','liability','equity','revenue','expense','tax')),
  system_key text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,code)
);
create unique index if not exists hotel_chart_accounts_system_key_uq
  on public.hotel_chart_accounts(property_id,system_key) where system_key is not null;
create index if not exists hotel_chart_accounts_property_kind_idx on public.hotel_chart_accounts(property_id,kind,code);

create table if not exists public.hotel_accounting_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  occurred_on date not null default current_date,
  supplier_name text,
  supplier_tax_id text,
  concept text not null,
  category text not null default 'Operativo',
  account_id uuid references public.hotel_chart_accounts(id) on delete set null,
  amount numeric(14,2) not null check (amount > 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0 and tax_amount <= amount),
  currency text not null default 'ARS',
  payment_method text not null default 'Transferencia',
  document_number text,
  reference text,
  status text not null default 'posted' check (status in ('posted','void')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hotel_accounting_expenses_property_date_idx on public.hotel_accounting_expenses(property_id,occurred_on desc);
create index if not exists hotel_accounting_expenses_supplier_idx on public.hotel_accounting_expenses(property_id,supplier_name);
create index if not exists hotel_accounting_expenses_account_idx on public.hotel_accounting_expenses(account_id);
create index if not exists hotel_accounting_expenses_created_by_idx on public.hotel_accounting_expenses(created_by);

create table if not exists public.hotel_accounting_periods (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  period_year integer not null check (period_year between 2000 and 2200),
  period_month integer not null check (period_month between 1 and 12),
  status text not null default 'open' check (status in ('open','closed')),
  notes text,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  reopened_at timestamptz,
  reopened_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,period_year,period_month)
);
create index if not exists hotel_accounting_periods_property_status_idx on public.hotel_accounting_periods(property_id,status,period_year desc,period_month desc);
create index if not exists hotel_accounting_periods_closed_by_idx on public.hotel_accounting_periods(closed_by);
create index if not exists hotel_accounting_periods_reopened_by_idx on public.hotel_accounting_periods(reopened_by);

create table if not exists public.hotel_accounting_exports (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  target text not null default 'generic_csv',
  format text not null default 'csv',
  rows_count integer not null default 0,
  file_name text,
  status text not null default 'generated' check (status in ('generated','sent','failed')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists hotel_accounting_exports_property_created_idx on public.hotel_accounting_exports(property_id,created_at desc);
create index if not exists hotel_accounting_exports_created_by_idx on public.hotel_accounting_exports(created_by);

alter table public.hotel_chart_accounts enable row level security;
alter table public.hotel_accounting_expenses enable row level security;
alter table public.hotel_accounting_periods enable row level security;
alter table public.hotel_accounting_exports enable row level security;

create policy hotel_chart_accounts_select_access on public.hotel_chart_accounts
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_chart_accounts_insert_manage on public.hotel_chart_accounts
  for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy hotel_chart_accounts_update_manage on public.hotel_chart_accounts
  for update to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin']))
  with check (private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy hotel_chart_accounts_delete_manage on public.hotel_chart_accounts
  for delete to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin']));

create policy hotel_accounting_expenses_select_access on public.hotel_accounting_expenses
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_accounting_expenses_insert_manage on public.hotel_accounting_expenses
  for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin','night_audit']));
create policy hotel_accounting_expenses_update_manage on public.hotel_accounting_expenses
  for update to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin','night_audit']))
  with check (private.user_has_property_role(property_id,array['owner','manager','admin','night_audit']));
create policy hotel_accounting_expenses_delete_manage on public.hotel_accounting_expenses
  for delete to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin']));

create policy hotel_accounting_periods_select_access on public.hotel_accounting_periods
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_accounting_periods_insert_manage on public.hotel_accounting_periods
  for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin']));
create policy hotel_accounting_periods_update_manage on public.hotel_accounting_periods
  for update to authenticated using (private.user_has_property_role(property_id,array['owner','manager','admin']))
  with check (private.user_has_property_role(property_id,array['owner','manager','admin']));

create policy hotel_accounting_exports_select_access on public.hotel_accounting_exports
  for select to authenticated using (private.user_has_property_access(property_id));
create policy hotel_accounting_exports_insert_access on public.hotel_accounting_exports
  for insert to authenticated with check (private.user_has_property_role(property_id,array['owner','manager','admin','night_audit']));

revoke all on public.hotel_chart_accounts from anon;
revoke all on public.hotel_accounting_expenses from anon;
revoke all on public.hotel_accounting_periods from anon;
revoke all on public.hotel_accounting_exports from anon;
grant select,insert,update,delete on public.hotel_chart_accounts to authenticated;
grant select,insert,update,delete on public.hotel_accounting_expenses to authenticated;
grant select,insert,update on public.hotel_accounting_periods to authenticated;
grant select,insert on public.hotel_accounting_exports to authenticated;

insert into public.hotel_chart_accounts(property_id,code,name,kind,system_key)
select p.id,v.code,v.name,v.kind,v.system_key
from public.properties p
cross join (values
 ('1101','Clientes / cuentas por cobrar','asset','accounts_receivable'),
 ('1102','Caja','asset','cash'),
 ('1103','Bancos y transferencias','asset','bank'),
 ('1104','Mercado Pago y tarjetas','asset','wallets'),
 ('1301','IVA crédito fiscal','tax','vat_input'),
 ('2101','IVA débito fiscal','tax','vat_output'),
 ('2102','Proveedores / cuentas por pagar','liability','accounts_payable'),
 ('2103','Anticipos de huéspedes','liability','guest_advances'),
 ('4101','Ingresos por alojamiento','revenue','lodging_revenue'),
 ('4201','Otros ingresos operativos','revenue','other_revenue'),
 ('5101','Gastos operativos','expense','operating_expense'),
 ('5102','Comisiones OTA','expense','ota_commission'),
 ('5103','Limpieza y lavandería','expense','housekeeping_expense'),
 ('5104','Mantenimiento','expense','maintenance_expense'),
 ('5105','Alimentos y bebidas','expense','food_beverage_expense'),
 ('5201','Impuestos y tasas','expense','tax_expense')
) as v(code,name,kind,system_key)
on conflict(property_id,code) do update set
  name=excluded.name,kind=excluded.kind,system_key=coalesce(public.hotel_chart_accounts.system_key,excluded.system_key),updated_at=now();

create or replace function private.hl_seed_default_chart_accounts()
returns trigger language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  insert into public.hotel_chart_accounts(property_id,code,name,kind,system_key)
  select new.id,v.code,v.name,v.kind,v.system_key
  from (values
   ('1101','Clientes / cuentas por cobrar','asset','accounts_receivable'),
   ('1102','Caja','asset','cash'),
   ('1103','Bancos y transferencias','asset','bank'),
   ('1104','Mercado Pago y tarjetas','asset','wallets'),
   ('1301','IVA crédito fiscal','tax','vat_input'),
   ('2101','IVA débito fiscal','tax','vat_output'),
   ('2102','Proveedores / cuentas por pagar','liability','accounts_payable'),
   ('2103','Anticipos de huéspedes','liability','guest_advances'),
   ('4101','Ingresos por alojamiento','revenue','lodging_revenue'),
   ('4201','Otros ingresos operativos','revenue','other_revenue'),
   ('5101','Gastos operativos','expense','operating_expense'),
   ('5102','Comisiones OTA','expense','ota_commission'),
   ('5103','Limpieza y lavandería','expense','housekeeping_expense'),
   ('5104','Mantenimiento','expense','maintenance_expense'),
   ('5105','Alimentos y bebidas','expense','food_beverage_expense'),
   ('5201','Impuestos y tasas','expense','tax_expense')
  ) as v(code,name,kind,system_key)
  on conflict(property_id,code) do nothing;
  return new;
end $$;
revoke all on function private.hl_seed_default_chart_accounts() from public,anon,authenticated;
drop trigger if exists trg_seed_default_chart_accounts on public.properties;
create trigger trg_seed_default_chart_accounts
after insert on public.properties for each row execute function private.hl_seed_default_chart_accounts();

create or replace function public.hl_accounting_period_closed(p_property_id uuid,p_date date)
returns boolean language sql stable security invoker set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.hotel_accounting_periods p
    where p.property_id=p_property_id and p.period_year=extract(year from p_date)::int
      and p.period_month=extract(month from p_date)::int and p.status='closed'
  )
$$;

create or replace function public.hl_accounting_guard_closed_period()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  v_property uuid;
  v_old_date date;
  v_new_date date;
begin
  v_property := case when tg_op='DELETE' then old.property_id else new.property_id end;
  if tg_table_name='hotel_accounting_expenses' then
    if tg_op<>'INSERT' then v_old_date:=old.occurred_on; end if;
    if tg_op<>'DELETE' then v_new_date:=new.occurred_on; end if;
  elsif tg_table_name='hotel_finance_documents' then
    if tg_op<>'INSERT' then v_old_date:=coalesce(old.issued_at::date,old.created_at::date); end if;
    if tg_op<>'DELETE' then v_new_date:=coalesce(new.issued_at::date,new.created_at::date); end if;
  elsif tg_table_name='pagos' then
    if tg_op<>'INSERT' then v_old_date:=old.created_at::date; end if;
    if tg_op<>'DELETE' then v_new_date:=new.created_at::date; end if;
  elsif tg_table_name='hotel_cash_movements' then
    if tg_op<>'INSERT' then v_old_date:=old.created_at::date; end if;
    if tg_op<>'DELETE' then v_new_date:=new.created_at::date; end if;
  end if;
  if v_old_date is not null and public.hl_accounting_period_closed(v_property,v_old_date) then
    raise exception 'El período contable % está cerrado. Reabrilo antes de modificar movimientos.',to_char(v_old_date,'MM/YYYY');
  end if;
  if v_new_date is not null and public.hl_accounting_period_closed(v_property,v_new_date) then
    raise exception 'El período contable % está cerrado. Reabrilo antes de registrar movimientos.',to_char(v_new_date,'MM/YYYY');
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

drop trigger if exists trg_accounting_lock_expenses on public.hotel_accounting_expenses;
create trigger trg_accounting_lock_expenses before insert or update or delete on public.hotel_accounting_expenses for each row execute function public.hl_accounting_guard_closed_period();
drop trigger if exists trg_accounting_lock_finance_documents on public.hotel_finance_documents;
create trigger trg_accounting_lock_finance_documents before insert or update or delete on public.hotel_finance_documents for each row execute function public.hl_accounting_guard_closed_period();
drop trigger if exists trg_accounting_lock_payments on public.pagos;
create trigger trg_accounting_lock_payments before insert or update or delete on public.pagos for each row execute function public.hl_accounting_guard_closed_period();
drop trigger if exists trg_accounting_lock_cash_movements on public.hotel_cash_movements;
create trigger trg_accounting_lock_cash_movements before insert or update or delete on public.hotel_cash_movements for each row execute function public.hl_accounting_guard_closed_period();

create or replace function public.hl_close_accounting_period(p_property_id uuid,p_year integer,p_month integer,p_notes text default null)
returns public.hotel_accounting_periods language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_row public.hotel_accounting_periods; begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if p_year<2000 or p_year>2200 or p_month<1 or p_month>12 then raise exception 'Período inválido.'; end if;
  if not private.user_has_property_role(p_property_id,array['owner','manager','admin']) then raise exception 'No tenés permiso para cerrar períodos contables.'; end if;
  insert into public.hotel_accounting_periods(property_id,period_year,period_month,status,notes,closed_at,closed_by,updated_at)
  values(p_property_id,p_year,p_month,'closed',nullif(p_notes,''),now(),auth.uid(),now())
  on conflict(property_id,period_year,period_month) do update set status='closed',notes=coalesce(nullif(excluded.notes,''),public.hotel_accounting_periods.notes),closed_at=now(),closed_by=auth.uid(),updated_at=now()
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.hl_reopen_accounting_period(p_property_id uuid,p_year integer,p_month integer)
returns public.hotel_accounting_periods language plpgsql security invoker set search_path=public,pg_temp as $$
declare v_row public.hotel_accounting_periods; begin
  if auth.uid() is null then raise exception 'Tenés que iniciar sesión.'; end if;
  if not private.user_has_property_role(p_property_id,array['owner','manager','admin']) then raise exception 'No tenés permiso para reabrir períodos contables.'; end if;
  update public.hotel_accounting_periods set status='open',reopened_at=now(),reopened_by=auth.uid(),updated_at=now()
  where property_id=p_property_id and period_year=p_year and period_month=p_month returning * into v_row;
  if v_row.id is null then
    insert into public.hotel_accounting_periods(property_id,period_year,period_month,status,reopened_at,reopened_by)
    values(p_property_id,p_year,p_month,'open',now(),auth.uid()) returning * into v_row;
  end if;
  return v_row;
end $$;

grant execute on function public.hl_close_accounting_period(uuid,integer,integer,text) to authenticated;
grant execute on function public.hl_reopen_accounting_period(uuid,integer,integer) to authenticated;
revoke execute on function public.hl_close_accounting_period(uuid,integer,integer,text) from anon;
revoke execute on function public.hl_reopen_accounting_period(uuid,integer,integer) from anon;
