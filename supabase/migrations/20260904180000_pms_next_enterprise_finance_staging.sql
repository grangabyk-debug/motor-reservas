-- Habitación Llena PMS Next
-- PREPARADA PARA SUPABASE STAGING. No aplicar en producción sin QA de roles/RLS.

begin;

-- ---------------------------------------------------------------------------
-- 1. Helper general de permisos por propiedad/rol.
--    Un permiso explícito en hotel_role_permissions prevalece sobre el fallback.
-- ---------------------------------------------------------------------------
create or replace function private.hl_user_has_permission(
  p_property_id uuid,
  p_permission text,
  p_default_roles text[] default array[]::text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_override boolean;
begin
  if v_uid is null or p_property_id is null or coalesce(trim(p_permission),'')='' then
    return false;
  end if;

  if exists(select 1 from public.properties p where p.id=p_property_id and p.owner_id=v_uid) then
    return true;
  end if;

  select lower(pm.role) into v_role
  from public.property_members pm
  where pm.property_id=p_property_id and pm.user_id=v_uid
  limit 1;

  if v_role is null then return false; end if;

  select rp.allowed into v_override
  from public.hotel_role_permissions rp
  where rp.property_id=p_property_id
    and lower(rp.role)=v_role
    and rp.permission=p_permission
  limit 1;

  if found then return coalesce(v_override,false); end if;
  return v_role = any(coalesce(p_default_roles,array[]::text[]));
end;
$$;

revoke all on function private.hl_user_has_permission(uuid,text,text[]) from public;
grant execute on function private.hl_user_has_permission(uuid,text,text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Gastos recurrentes reales.
--    next_due_date es la autoridad para materialización y permite idempotencia.
-- ---------------------------------------------------------------------------
create table if not exists public.hotel_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  supplier_name text,
  supplier_tax_id text,
  concept text not null,
  category text not null default 'Operativo',
  amount numeric(14,2) not null check(amount>0),
  tax_amount numeric(14,2) not null default 0 check(tax_amount>=0),
  currency text not null default 'ARS',
  payment_method text not null default 'Transferencia',
  frequency text not null check(frequency in ('weekly','monthly','yearly')),
  interval_count integer not null default 1 check(interval_count between 1 and 120),
  next_due_date date not null,
  end_date date,
  auto_post boolean not null default true,
  active boolean not null default true,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_recurring_expenses_end_date_check check(end_date is null or end_date>=next_due_date)
);

create index if not exists hotel_recurring_expenses_property_due_idx
  on public.hotel_recurring_expenses(property_id,next_due_date)
  where active=true;

alter table public.hotel_recurring_expenses enable row level security;

drop policy if exists hotel_recurring_expenses_select on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_select on public.hotel_recurring_expenses
for select to authenticated
using(private.hl_user_has_permission(property_id,'module.finance.view',array['owner','manager']));

drop policy if exists hotel_recurring_expenses_insert on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_insert on public.hotel_recurring_expenses
for insert to authenticated
with check(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']));

drop policy if exists hotel_recurring_expenses_update on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_update on public.hotel_recurring_expenses
for update to authenticated
using(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']))
with check(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']));

drop policy if exists hotel_recurring_expenses_delete on public.hotel_recurring_expenses;
create policy hotel_recurring_expenses_delete on public.hotel_recurring_expenses
for delete to authenticated
using(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']));

-- La fila contable conserva el origen recurrente para evitar duplicados.
alter table public.hotel_accounting_expenses
  add column if not exists recurring_expense_id uuid references public.hotel_recurring_expenses(id) on delete set null;

create unique index if not exists hotel_accounting_expenses_recurring_due_unique
  on public.hotel_accounting_expenses(recurring_expense_id,occurred_on)
  where recurring_expense_id is not null and status<>'void';

-- ---------------------------------------------------------------------------
-- 3. Cálculo de próxima obligación.
-- ---------------------------------------------------------------------------
create or replace function private.hl_next_recurring_due(
  p_date date,
  p_frequency text,
  p_interval integer
)
returns date
language sql
immutable
set search_path = pg_catalog, pg_temp
as $$
  select case p_frequency
    when 'weekly' then p_date + (greatest(1,p_interval)*7)
    when 'monthly' then (p_date + make_interval(months=>greatest(1,p_interval)))::date
    when 'yearly' then (p_date + make_interval(years=>greatest(1,p_interval)))::date
    else null::date
  end
$$;

revoke all on function private.hl_next_recurring_due(date,text,integer) from public;

-- ---------------------------------------------------------------------------
-- 4. Materialización idempotente en libro de gastos.
--    Puede llamarse desde servidor/cron o manualmente por Finanzas.
-- ---------------------------------------------------------------------------
create or replace function public.hl_materialize_recurring_expenses(
  p_property_id uuid,
  p_until date default current_date
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  r public.hotel_recurring_expenses%rowtype;
  v_due date;
  v_next date;
  v_created integer := 0;
  v_loops integer;
begin
  if not private.hl_user_has_permission(p_property_id,'finance.manage',array['owner','manager']) then
    raise exception 'No tenés permisos para procesar gastos recurrentes.' using errcode='42501';
  end if;

  if p_until is null or p_until>current_date+interval '400 days' then
    raise exception 'El horizonte solicitado no es válido.' using errcode='22023';
  end if;

  for r in
    select * from public.hotel_recurring_expenses
    where property_id=p_property_id and active=true and auto_post=true
      and next_due_date<=p_until
    order by next_due_date,id
    for update
  loop
    v_due:=r.next_due_date;
    v_loops:=0;

    while v_due<=p_until and (r.end_date is null or v_due<=r.end_date) loop
      v_loops:=v_loops+1;
      if v_loops>400 then
        raise exception 'Se detectó una recurrencia inválida.' using errcode='22023';
      end if;

      insert into public.hotel_accounting_expenses(
        property_id,occurred_on,supplier_name,supplier_tax_id,concept,category,
        amount,tax_amount,currency,payment_method,reference,status,notes,created_by,
        recurring_expense_id
      ) values (
        r.property_id,v_due,r.supplier_name,r.supplier_tax_id,r.concept,r.category,
        r.amount,r.tax_amount,r.currency,r.payment_method,
        'Recurrente · '||r.name,'posted',r.notes,auth.uid(),r.id
      )
      on conflict (recurring_expense_id,occurred_on) where recurring_expense_id is not null and status<>'void'
      do nothing;

      if found then v_created:=v_created+1; end if;
      v_next:=private.hl_next_recurring_due(v_due,r.frequency,r.interval_count);
      if v_next is null or v_next<=v_due then
        raise exception 'No se pudo calcular la próxima fecha del gasto recurrente.' using errcode='22023';
      end if;
      v_due:=v_next;
    end loop;

    update public.hotel_recurring_expenses
    set next_due_date=v_due,
        active=case when end_date is not null and v_due>end_date then false else active end,
        updated_at=now()
    where id=r.id and property_id=p_property_id;
  end loop;

  return jsonb_build_object('property_id',p_property_id,'created',v_created,'processed_until',p_until);
end;
$$;

revoke all on function public.hl_materialize_recurring_expenses(uuid,date) from public;
grant execute on function public.hl_materialize_recurring_expenses(uuid,date) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS financiero: preparar políticas basadas en permisos configurables.
--    Reception/Night Audit mantienen fallback de caja/pagos hasta que la matriz
--    escriba overrides explícitos. Gastos contables quedan gerenciales por defecto.
-- ---------------------------------------------------------------------------
drop policy if exists hotel_accounting_expenses_select_access on public.hotel_accounting_expenses;
create policy hotel_accounting_expenses_select_access on public.hotel_accounting_expenses
for select to authenticated
using(private.hl_user_has_permission(property_id,'module.finance.view',array['owner','manager']));

drop policy if exists hotel_accounting_expenses_insert_management on public.hotel_accounting_expenses;
create policy hotel_accounting_expenses_insert_management on public.hotel_accounting_expenses
for insert to authenticated
with check(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']));

drop policy if exists hotel_accounting_expenses_update_management on public.hotel_accounting_expenses;
create policy hotel_accounting_expenses_update_management on public.hotel_accounting_expenses
for update to authenticated
using(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']))
with check(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']));

drop policy if exists hotel_accounting_expenses_delete_management on public.hotel_accounting_expenses;
create policy hotel_accounting_expenses_delete_management on public.hotel_accounting_expenses
for delete to authenticated
using(private.hl_user_has_permission(property_id,'finance.manage',array['owner','manager']));

-- No se cambian todavía pagos/caja en esta migración preparada: primero hay que
-- sincronizar la matriz de Configuración -> hotel_role_permissions y probar los
-- roles Reception/Night Audit en staging para no cortar su operación de caja.

commit;
