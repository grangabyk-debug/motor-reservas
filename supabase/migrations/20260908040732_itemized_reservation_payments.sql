alter table public.pagos
  add column if not exists charge_allocations jsonb not null default '[]'::jsonb;

do $$ begin
  alter table public.pagos add constraint pagos_charge_allocations_array_chk
    check (jsonb_typeof(charge_allocations) = 'array');
exception when duplicate_object then null; end $$;

create table if not exists public.hotel_folio_item_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  reservation_id bigint not null,
  folio_id uuid not null references public.hotel_folios(id) on delete cascade,
  folio_item_id uuid not null references public.hotel_folio_items(id) on delete cascade,
  payment_id bigint not null references public.pagos(id) on delete cascade,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'ARS',
  source text not null default 'itemized',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique(payment_id, folio_item_id)
);

create index if not exists hotel_folio_item_payment_allocations_item_idx on public.hotel_folio_item_payment_allocations(folio_item_id, payment_id);
create index if not exists hotel_folio_item_payment_allocations_reservation_idx on public.hotel_folio_item_payment_allocations(property_id, reservation_id);
create index if not exists hotel_folio_item_payment_allocations_folio_idx on public.hotel_folio_item_payment_allocations(folio_id, payment_id);

alter table public.hotel_folio_item_payment_allocations enable row level security;
drop policy if exists hotel_folio_item_payment_allocations_select_access on public.hotel_folio_item_payment_allocations;
create policy hotel_folio_item_payment_allocations_select_access on public.hotel_folio_item_payment_allocations for select using (private.user_has_property_access(property_id));
drop policy if exists hotel_folio_item_payment_allocations_insert_operational on public.hotel_folio_item_payment_allocations;
create policy hotel_folio_item_payment_allocations_insert_operational on public.hotel_folio_item_payment_allocations for insert with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
drop policy if exists hotel_folio_item_payment_allocations_update_operational on public.hotel_folio_item_payment_allocations;
create policy hotel_folio_item_payment_allocations_update_operational on public.hotel_folio_item_payment_allocations for update using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit'])) with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
drop policy if exists hotel_folio_item_payment_allocations_delete_operational on public.hotel_folio_item_payment_allocations;
create policy hotel_folio_item_payment_allocations_delete_operational on public.hotel_folio_item_payment_allocations for delete using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']));
revoke all on public.hotel_folio_item_payment_allocations from anon;
grant select,insert,update,delete on public.hotel_folio_item_payment_allocations to authenticated;

create or replace function private.hl_payment_item_allocation_sync_trigger()
returns trigger language plpgsql security definer set search_path = public, private, pg_temp as $$
declare entry jsonb; item_row public.hotel_folio_items%rowtype; nominal numeric; nominal_total numeric := 0; effective numeric; net numeric; factor numeric; remaining_net numeric; prior_paid numeric; entry_count integer; distinct_count integer; idx integer;
begin
  delete from public.hotel_folio_item_payment_allocations where payment_id = new.id;
  if jsonb_typeof(coalesce(new.charge_allocations,'[]'::jsonb)) <> 'array' then raise exception 'La asignación de cargos debe ser una lista'; end if;
  entry_count := jsonb_array_length(coalesce(new.charge_allocations,'[]'::jsonb));
  if entry_count = 0 then
    if tg_op = 'UPDATE' and jsonb_array_length(coalesce(old.charge_allocations,'[]'::jsonb)) > 0 then delete from public.hotel_folio_payment_allocations where payment_id = new.id and source = 'itemized'; end if;
    return new;
  end if;
  delete from public.hotel_folio_payment_allocations where payment_id = new.id;
  if lower(coalesce(new.estado,'')) in ('anulado','cancelado','void','rechazado','cancelled') then return new; end if;
  net := greatest(0,coalesce(new.monto,0)-coalesce(new.refunded_amount,0));
  if net <= .009 then return new; end if;
  if coalesce(new.monto,0) <= 0 then raise exception 'El pago debe tener un importe mayor a cero'; end if;
  select coalesce(sum((value->>'amount')::numeric),0),count(distinct value->>'folio_item_id') into nominal_total,distinct_count from jsonb_array_elements(new.charge_allocations);
  if distinct_count <> entry_count then raise exception 'No se puede asignar dos veces el mismo cargo'; end if;
  if abs(nominal_total-new.monto) > .01 then raise exception 'La asignación de cargos debe coincidir con el importe del pago'; end if;
  factor := net/new.monto; remaining_net := net; idx := 0;
  for entry in select value from jsonb_array_elements(new.charge_allocations) loop
    idx := idx + 1; nominal := greatest(0,coalesce((entry->>'amount')::numeric,0));
    if nominal <= .009 then raise exception 'Cada cargo seleccionado debe tener un importe mayor a cero'; end if;
    select * into item_row from public.hotel_folio_items where id = (entry->>'folio_item_id')::uuid and property_id = new.property_id and reservation_id = new.reserva_id and status = 'active';
    if item_row.id is null then raise exception 'Uno de los cargos seleccionados no pertenece a esta reserva'; end if;
    effective := case when idx=entry_count then remaining_net else least(remaining_net,round(nominal*factor,2)) end; remaining_net := greatest(0,remaining_net-effective);
    select coalesce(sum(a.amount),0) into prior_paid from public.hotel_folio_item_payment_allocations a join public.pagos p on p.id=a.payment_id where a.folio_item_id=item_row.id and a.payment_id<>new.id and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled');
    if prior_paid+effective > greatest(0,item_row.total)+.011 then raise exception 'El pago supera el saldo pendiente del cargo %',coalesce(item_row.description,'seleccionado'); end if;
    insert into public.hotel_folio_item_payment_allocations(property_id,reservation_id,folio_id,folio_item_id,payment_id,amount,currency,source,created_by) values(new.property_id,new.reserva_id,item_row.folio_id,item_row.id,new.id,effective,new.moneda,'itemized',new.created_by);
  end loop;
  insert into public.hotel_folio_payment_allocations(property_id,reservation_id,folio_id,payment_id,amount,currency,source,created_by)
  select new.property_id,new.reserva_id,a.folio_id,new.id,sum(a.amount),new.moneda,'itemized',new.created_by from public.hotel_folio_item_payment_allocations a where a.payment_id=new.id group by a.folio_id
  on conflict(payment_id,folio_id) do update set amount=excluded.amount,currency=excluded.currency,source='itemized',updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_payment_item_allocation_sync on public.pagos;
create trigger trg_payment_item_allocation_sync after insert or update of charge_allocations,monto,refunded_amount,estado,moneda on public.pagos for each row execute function private.hl_payment_item_allocation_sync_trigger();
comment on column public.pagos.charge_allocations is 'Distribución nominal del pago entre cargos de folio seleccionados por recepción.';
comment on table public.hotel_folio_item_payment_allocations is 'Aplicación efectiva de pagos a cargos individuales de folio; permite saldar alojamiento y extras por separado.';
