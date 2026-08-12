create table if not exists public.comanda_cash_movements (
  id uuid primary key default gen_random_uuid(), account_id uuid not null references public.comanda_accounts(id) on delete cascade,
  cash_session_id uuid not null references public.comanda_cash_sessions(id) on delete cascade, staff_id uuid references public.comanda_staff(id) on delete set null,
  movement_type text not null check(movement_type in('income','expense')), amount numeric(14,2) not null check(amount>0), reason text not null,
  created_by uuid not null references auth.users(id) on delete restrict, created_at timestamptz not null default now()
);
alter table public.comanda_cash_movements enable row level security;
create policy comanda_cash_movements_access on public.comanda_cash_movements for all to authenticated using(private.comanda_has_account_access(account_id)) with check(private.comanda_has_account_access(account_id));
revoke all on public.comanda_cash_movements from anon; grant select,insert,update,delete on public.comanda_cash_movements to authenticated;
create index if not exists comanda_cash_movements_session_idx on public.comanda_cash_movements(cash_session_id,created_at desc);