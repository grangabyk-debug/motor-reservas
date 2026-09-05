-- Habitación Llena — gastos recurrentes empresariales
-- Aplicar primero en preview/staging.

begin;

create table if not exists public.hotel_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  concept text not null check (length(trim(concept)) between 1 and 180),
  category text not null default 'other',
  supplier_name text,
  supplier_tax_id text,
  account_id uuid references public.hotel_chart_accounts(id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  currency text not null default 'ARS',
  payment_method text not null default 'other',
  frequency text not null default 'monthly' check (frequency in ('weekly','monthly','quarterly','semiannual','annual')),
  day_of_month smallint check (day_of_month between 1 and 31),
  weekday smallint check (weekday between 0 and 6),
  start_date date not null default current_date,
  end_date date,
  next_due_on date,
  auto_create_expense boolean not null default false,
  active boolean not null default true,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists hotel_recurring_expenses_due_idx on public.hotel_recurring_expenses(property_id,active,next_due_on);
create index if not exists hotel_recurring_expenses_category_idx on public.hotel_recurring_expenses(property_id,category,active);

alter table public.hotel_recurring_expenses enable row level security;

drop policy if exists hotel_recurring_expenses_select_access on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_select_access on public.hotel_recurring_expenses
for select to authenticated using (private.user_has_property_access(property_id));

drop policy if exists hotel_recurring_expenses_insert_manage on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_insert_manage on public.hotel_recurring_expenses
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists hotel_recurring_expenses_update_manage on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_update_manage on public.hotel_recurring_expenses
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists hotel_recurring_expenses_delete_manage on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_delete_manage on public.hotel_recurring_expenses
for delete to authenticated using (private.user_has_property_role(property_id,array['owner','admin']::text[]));

create table if not exists public.hotel_recurring_expense_occurrences (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  recurring_expense_id uuid not null references public.hotel_recurring_expenses(id) on delete cascade,
  due_on date not null,
  amount numeric(14,2) not null check (amount >= 0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount >= 0),
  currency text not null,
  status text not null default 'pending' check (status in ('pending','paid','skipped','cancelled')),
  accounting_expense_id uuid references public.hotel_accounting_expenses(id) on delete set null,
  paid_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(recurring_expense_id,due_on)
);

create index if not exists hotel_recurring_expense_occurrences_month_idx on public.hotel_recurring_expense_occurrences(property_id,due_on,status);

alter table public.hotel_recurring_expense_occurrences enable row level security;

drop policy if exists hotel_recurring_occurrences_select_access on public.hotel_recurring_expense_occurrences;
create policy hotel_recurring_occurrences_select_access on public.hotel_recurring_expense_occurrences
for select to authenticated using (private.user_has_property_access(property_id));

drop policy if exists hotel_recurring_occurrences_write_manage on public.hotel_recurring_expense_occurrences;
create policy hotel_recurring_occurrences_write_manage on public.hotel_recurring_expense_occurrences
for all to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','night_audit']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager','night_audit']::text[]));

create or replace function private.hl_recurring_expense_occurrence_tenant_guard()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if not exists(select 1 from public.hotel_recurring_expenses r where r.id=new.recurring_expense_id and r.property_id=new.property_id) then
    raise exception using errcode='23514',message='El gasto recurrente no pertenece a la propiedad.';
  end if;
  if new.accounting_expense_id is not null and not exists(select 1 from public.hotel_accounting_expenses e where e.id=new.accounting_expense_id and e.property_id=new.property_id) then
    raise exception using errcode='23514',message='El gasto contable no pertenece a la propiedad.';
  end if;
  new.updated_at:=now();
  if new.status='paid' then new.paid_at:=coalesce(new.paid_at,now()); else new.paid_at:=null; end if;
  return new;
end
$function$;

drop trigger if exists hotel_recurring_expense_occurrence_tenant_guard on public.hotel_recurring_expense_occurrences;
create trigger hotel_recurring_expense_occurrence_tenant_guard before insert or update on public.hotel_recurring_expense_occurrences for each row execute function private.hl_recurring_expense_occurrence_tenant_guard();

commit;
