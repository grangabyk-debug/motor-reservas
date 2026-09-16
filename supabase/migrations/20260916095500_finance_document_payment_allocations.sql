-- Imputación real pago -> factura, saldos documentales derivados y
-- reequilibrio automático ante devoluciones/anulaciones.

create table if not exists public.hotel_finance_document_payment_allocations (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete restrict,
  folio_id uuid not null references public.hotel_folios(id) on delete restrict,
  document_id uuid not null references public.hotel_finance_documents(id) on delete restrict,
  payment_id bigint not null references public.pagos(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  source text not null default 'manual',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(document_id,payment_id)
);

create index if not exists hotel_finance_doc_payment_alloc_doc_idx
  on public.hotel_finance_document_payment_allocations(document_id,payment_id);
create index if not exists hotel_finance_doc_payment_alloc_payment_idx
  on public.hotel_finance_document_payment_allocations(payment_id,folio_id);
create index if not exists hotel_finance_doc_payment_alloc_reservation_idx
  on public.hotel_finance_document_payment_allocations(property_id,reservation_id);

alter table public.hotel_finance_document_payment_allocations enable row level security;

drop policy if exists hotel_finance_doc_payment_alloc_select on public.hotel_finance_document_payment_allocations;
create policy hotel_finance_doc_payment_alloc_select
on public.hotel_finance_document_payment_allocations
for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_finance_doc_payment_alloc_insert on public.hotel_finance_document_payment_allocations;
create policy hotel_finance_doc_payment_alloc_insert
on public.hotel_finance_document_payment_allocations
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']::text[]));

drop policy if exists hotel_finance_doc_payment_alloc_update on public.hotel_finance_document_payment_allocations;
create policy hotel_finance_doc_payment_alloc_update
on public.hotel_finance_document_payment_allocations
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']::text[]))
with check (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']::text[]));

drop policy if exists hotel_finance_doc_payment_alloc_delete on public.hotel_finance_document_payment_allocations;
create policy hotel_finance_doc_payment_alloc_delete
on public.hotel_finance_document_payment_allocations
for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','manager','reception','admin','night_audit']::text[]));

revoke all on table public.hotel_finance_document_payment_allocations from anon;
grant select,insert,update,delete on table public.hotel_finance_document_payment_allocations to authenticated;

-- Una factura es la cuenta original. Las NC emitidas reducen el exigible y
-- las ND emitidas que revierten esas NC vuelven a incrementarlo.
create or replace function private.hl_finance_invoice_effective_total(p_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  with invoice as (
    select id,total
    from public.hotel_finance_documents
    where id=p_invoice_id and document_type='invoice'
  ), credits as (
    select c.id,c.total
    from public.hotel_finance_documents c
    join invoice i on c.related_document_id=i.id
    where c.document_type='credit_note' and c.status not in ('draft','void')
  ), debits as (
    select coalesce(sum(d.total),0)::numeric as total
    from public.hotel_finance_documents d
    join credits c on d.related_document_id=c.id
    where d.document_type='debit_note' and d.status not in ('draft','void')
  )
  select greatest(0,
    coalesce((select total from invoice),0)
    - coalesce((select sum(total) from credits),0)
    + coalesce((select total from debits),0)
  )::numeric;
$function$;

create or replace function private.hl_finance_invoice_payment_total(p_invoice_id uuid)
returns numeric
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
  select coalesce(sum(a.amount),0)::numeric
  from public.hotel_finance_document_payment_allocations a
  join public.pagos p on p.id=a.payment_id
  where a.document_id=p_invoice_id
    and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled','reembolsado','refunded')
    and greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))>.009;
$function$;

create or replace function private.hl_recalculate_finance_invoice(p_invoice_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_doc public.hotel_finance_documents%rowtype;
  v_effective numeric;
  v_paid numeric;
  v_balance numeric;
  v_status text;
begin
  select * into v_doc
  from public.hotel_finance_documents
  where id=p_invoice_id
  for update;

  if not found or v_doc.document_type<>'invoice' or v_doc.status in ('draft','void') then
    return;
  end if;

  v_effective:=private.hl_finance_invoice_effective_total(v_doc.id);
  v_paid:=private.hl_finance_invoice_payment_total(v_doc.id);
  v_balance:=greatest(0,v_effective-v_paid);
  v_status:=case
    when v_paid>.009 and v_balance<=.009 then 'paid'
    when v_paid>.009 then 'partial'
    else 'issued'
  end;

  if abs(coalesce(v_doc.balance,0)-v_balance)>.009 or v_doc.status<>v_status then
    update public.hotel_finance_documents
    set balance=v_balance,status=v_status,updated_at=now()
    where id=v_doc.id;
  end if;
end;
$function$;

-- El guard sigue manteniendo inmutable el contenido económico, pero permite
-- que saldo/estado vuelvan atrás cuando el valor DERIVADO cambia por una NC,
-- una ND, una devolución o una desimputación real.
create or replace function private.hl_guard_finance_document_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_effective numeric;
  v_paid numeric;
  v_expected_balance numeric;
  v_expected_status text;
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then
      raise exception using errcode='P0001',message='Un comprobante emitido no se elimina. Usá la anulación o una nota de ajuste.';
    end if;
    return old;
  end if;

  if old.status='void' then
    raise exception using errcode='P0001',message='Un documento anulado no se puede modificar.';
  end if;

  if old.status<>'draft' then
    if new.property_id is distinct from old.property_id
      or new.reservation_id is distinct from old.reservation_id
      or new.folio_id is distinct from old.folio_id
      or new.partner_id is distinct from old.partner_id
      or new.payment_id is distinct from old.payment_id
      or new.group_id is distinct from old.group_id
      or new.document_type is distinct from old.document_type
      or new.currency is distinct from old.currency
      or new.subtotal is distinct from old.subtotal
      or new.tax is distinct from old.tax
      or new.total is distinct from old.total
      or new.billing_to is distinct from old.billing_to
      or new.items is distinct from old.items
      or new.folio_item_ids is distinct from old.folio_item_ids
      or new.billing_mode is distinct from old.billing_mode
      or new.related_document_id is distinct from old.related_document_id
      or new.adjustment_reason is distinct from old.adjustment_reason
      or new.created_by is distinct from old.created_by then
      raise exception using errcode='P0001',message='El contenido económico de un comprobante emitido es inmutable. Corregilo con una nota de crédito/débito.';
    end if;
  end if;

  if coalesce(new.balance,0)<0 then
    raise exception using errcode='23514',message='El saldo de un documento no puede ser negativo.';
  end if;

  if new.document_type='invoice' and old.status<>'draft' and new.status<>'void'
     and (new.balance is distinct from old.balance or new.status is distinct from old.status) then
    v_effective:=private.hl_finance_invoice_effective_total(old.id);
    v_paid:=private.hl_finance_invoice_payment_total(old.id);
    v_expected_balance:=greatest(0,v_effective-v_paid);
    v_expected_status:=case
      when v_paid>.009 and v_expected_balance<=.009 then 'paid'
      when v_paid>.009 then 'partial'
      else 'issued'
    end;
    if abs(coalesce(new.balance,0)-v_expected_balance)>.01 or new.status<>v_expected_status then
      raise exception using errcode='23514',message='El saldo y estado de la factura se derivan de notas y cobros imputados; no se modifican manualmente.';
    end if;
    return new;
  end if;

  if new.status='void' and old.status='issued' and exists(
    select 1 from public.hotel_finance_documents d
    where d.related_document_id=old.id and d.status<>'void'
  ) then
    raise exception using errcode='23514',message='Anulá primero las notas vinculadas a este comprobante.';
  end if;

  if old.status='draft' and new.status not in ('draft','issued','void') then
    raise exception using errcode='23514',message='Un borrador sólo puede emitirse o anularse.';
  elsif old.status='issued' and new.status not in ('issued','partial','paid','void') then
    raise exception using errcode='23514',message='Un comprobante emitido no puede volver a borrador.';
  elsif old.status='partial' and new.status not in ('partial','paid') then
    raise exception using errcode='23514',message='Un comprobante con pagos aplicados no puede cambiar manualmente hacia atrás.';
  elsif old.status='paid' and new.status<>'paid' then
    raise exception using errcode='23514',message='Un comprobante pagado no puede cambiar manualmente de estado.';
  end if;

  return new;
end;
$function$;

drop trigger if exists hotel_finance_documents_lifecycle_guard on public.hotel_finance_documents;
create trigger hotel_finance_documents_lifecycle_guard
before update or delete on public.hotel_finance_documents
for each row execute function private.hl_guard_finance_document_lifecycle();

create or replace function private.hl_recalculate_invoice_from_adjustment()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_type text;
  v_related uuid;
  v_invoice uuid;
begin
  v_type:=case when tg_op='DELETE' then old.document_type else new.document_type end;
  v_related:=case when tg_op='DELETE' then old.related_document_id else new.related_document_id end;

  if v_type='credit_note' and v_related is not null then
    perform private.hl_recalculate_finance_invoice(v_related);
  elsif v_type='debit_note' and v_related is not null then
    select related_document_id into v_invoice
    from public.hotel_finance_documents
    where id=v_related and document_type='credit_note';
    if v_invoice is not null then
      perform private.hl_recalculate_finance_invoice(v_invoice);
    end if;
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists trg_finance_adjustment_recalculate_invoice on public.hotel_finance_documents;
create trigger trg_finance_adjustment_recalculate_invoice
after insert or update of status,total,related_document_id or delete
on public.hotel_finance_documents
for each row execute function private.hl_recalculate_invoice_from_adjustment();

create or replace function private.hl_document_payment_allocation_recalculate()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if tg_op='DELETE' then
    perform private.hl_recalculate_finance_invoice(old.document_id);
    return old;
  end if;
  if tg_op='UPDATE' and old.document_id is distinct from new.document_id then
    perform private.hl_recalculate_finance_invoice(old.document_id);
  end if;
  perform private.hl_recalculate_finance_invoice(new.document_id);
  return new;
end;
$function$;

drop trigger if exists trg_finance_document_payment_recalculate on public.hotel_finance_document_payment_allocations;
create trigger trg_finance_document_payment_recalculate
after insert or update or delete on public.hotel_finance_document_payment_allocations
for each row execute function private.hl_document_payment_allocation_recalculate();

-- Reduce imputaciones documentales de un pago/folio si se reduce su asignación
-- al folio (por devolución, desasignación o corrección).
create or replace function private.hl_trim_finance_document_allocations(
  p_payment_id bigint,
  p_folio_id uuid,
  p_allowed numeric
)
returns void
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_total numeric;
  v_excess numeric;
  v_row public.hotel_finance_document_payment_allocations%rowtype;
  v_next numeric;
begin
  select coalesce(sum(a.amount),0) into v_total
  from public.hotel_finance_document_payment_allocations a
  where a.payment_id=p_payment_id and a.folio_id=p_folio_id;

  v_excess:=greatest(0,v_total-greatest(0,coalesce(p_allowed,0)));
  if v_excess<=.009 then return; end if;

  for v_row in
    select * from public.hotel_finance_document_payment_allocations
    where payment_id=p_payment_id and folio_id=p_folio_id
    order by updated_at desc,created_at desc,id desc
    for update
  loop
    exit when v_excess<=.009;
    if v_row.amount<=v_excess+.009 then
      v_excess:=greatest(0,v_excess-v_row.amount);
      delete from public.hotel_finance_document_payment_allocations where id=v_row.id;
    else
      v_next:=v_row.amount-v_excess;
      v_excess:=0;
      update public.hotel_finance_document_payment_allocations
      set amount=v_next,updated_at=now()
      where id=v_row.id;
    end if;
  end loop;
end;
$function$;

create or replace function private.hl_folio_allocation_rebalance_documents()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_payment bigint;
  v_folio uuid;
  v_allowed numeric;
begin
  if tg_op='DELETE' then
    v_payment:=old.payment_id;v_folio:=old.folio_id;v_allowed:=0;
  else
    v_payment:=new.payment_id;v_folio:=new.folio_id;v_allowed:=new.amount;
  end if;
  perform private.hl_trim_finance_document_allocations(v_payment,v_folio,v_allowed);
  return case when tg_op='DELETE' then old else new end;
end;
$function$;

drop trigger if exists trg_folio_allocation_rebalance_documents on public.hotel_folio_payment_allocations;
create trigger trg_folio_allocation_rebalance_documents
after update of amount,payment_id,folio_id or delete
on public.hotel_folio_payment_allocations
for each row execute function private.hl_folio_allocation_rebalance_documents();

-- Si un pago pierde neto disponible, primero recortamos sus asignaciones a
-- folios. El trigger anterior recorta a su vez cualquier imputación documental.
create or replace function private.hl_rebalance_payment_folio_allocations()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_net numeric;
  v_total numeric;
  v_excess numeric;
  v_row public.hotel_folio_payment_allocations%rowtype;
  v_next numeric;
begin
  if lower(coalesce(new.estado,'')) in ('anulado','cancelado','void','rechazado','cancelled','reembolsado','refunded') then
    v_net:=0;
  else
    v_net:=greatest(0,coalesce(new.monto,0)-coalesce(new.refunded_amount,0));
  end if;

  select coalesce(sum(amount),0) into v_total
  from public.hotel_folio_payment_allocations
  where payment_id=new.id;

  v_excess:=greatest(0,v_total-v_net);
  if v_excess<=.009 then return new; end if;

  for v_row in
    select * from public.hotel_folio_payment_allocations
    where payment_id=new.id
    order by updated_at desc,created_at desc,id desc
    for update
  loop
    exit when v_excess<=.009;
    if v_row.amount<=v_excess+.009 then
      v_excess:=greatest(0,v_excess-v_row.amount);
      delete from public.hotel_folio_payment_allocations where id=v_row.id;
    else
      v_next:=v_row.amount-v_excess;
      v_excess:=0;
      update public.hotel_folio_payment_allocations
      set amount=v_next,updated_at=now()
      where id=v_row.id;
    end if;
  end loop;
  return new;
end;
$function$;

drop trigger if exists trg_payment_rebalance_folio_allocations on public.pagos;
create trigger trg_payment_rebalance_folio_allocations
after update of monto,refunded_amount,estado on public.pagos
for each row
when (old.monto is distinct from new.monto or old.refunded_amount is distinct from new.refunded_amount or old.estado is distinct from new.estado)
execute function private.hl_rebalance_payment_folio_allocations();

create or replace function public.hl_allocate_payment_to_finance_document(
  p_payment_id bigint,
  p_document_id uuid,
  p_amount numeric
)
returns public.hotel_finance_document_payment_allocations
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_payment public.pagos%rowtype;
  v_doc public.hotel_finance_documents%rowtype;
  v_folio_available numeric;
  v_payment_net numeric;
  v_used_payment numeric;
  v_used_folio numeric;
  v_effective numeric;
  v_used_doc numeric;
  v_result public.hotel_finance_document_payment_allocations%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode='42501',message='Tenés que iniciar sesión.';
  end if;

  select * into v_payment from public.pagos where id=p_payment_id for update;
  if not found then raise exception using errcode='P0002',message='No encontramos el pago.'; end if;

  select * into v_doc from public.hotel_finance_documents where id=p_document_id for update;
  if not found then raise exception using errcode='P0002',message='No encontramos la factura.'; end if;

  if not private.user_has_property_role(v_payment.property_id,array['owner','manager','reception','admin','night_audit']::text[]) then
    raise exception using errcode='42501',message='No tenés permisos para imputar cobros.';
  end if;

  if v_doc.document_type<>'invoice' then
    raise exception using errcode='23514',message='Los cobros se imputan a la factura original; las notas ajustan su saldo automáticamente.';
  end if;
  if v_doc.status in ('draft','void') then
    raise exception using errcode='23514',message='La factura tiene que estar emitida para imputar un cobro.';
  end if;
  if v_doc.reservation_id is null or v_doc.folio_id is null then
    raise exception using errcode='23514',message='La factura debe estar vinculada a una reserva y a un folio.';
  end if;
  if v_payment.property_id<>v_doc.property_id or v_payment.reserva_id<>v_doc.reservation_id then
    raise exception using errcode='23514',message='El pago y la factura deben pertenecer a la misma reserva.';
  end if;
  if upper(coalesce(v_payment.moneda,''))<>upper(coalesce(v_doc.currency,'')) then
    raise exception using errcode='23514',message='El pago y la factura deben usar la misma moneda.';
  end if;
  if lower(coalesce(v_payment.estado,'')) in ('anulado','cancelado','void','rechazado','cancelled','reembolsado','refunded') then
    raise exception using errcode='23514',message='Ese pago no está disponible para imputar.';
  end if;
  if p_amount is null or p_amount<0 then
    raise exception using errcode='22023',message='El importe a imputar no puede ser negativo.';
  end if;

  v_payment_net:=greatest(0,coalesce(v_payment.monto,0)-coalesce(v_payment.refunded_amount,0));
  if v_payment_net<=.009 and p_amount>.009 then
    raise exception using errcode='23514',message='Ese pago no tiene saldo neto disponible.';
  end if;

  select coalesce(sum(amount),0) into v_folio_available
  from public.hotel_folio_payment_allocations
  where payment_id=v_payment.id and folio_id=v_doc.folio_id;
  if v_folio_available<=.009 and p_amount>.009 then
    raise exception using errcode='23514',message='Asigná primero el pago al folio de esta factura.';
  end if;

  select coalesce(sum(amount),0) into v_used_payment
  from public.hotel_finance_document_payment_allocations
  where payment_id=v_payment.id and document_id<>v_doc.id;
  if v_used_payment+p_amount>v_payment_net+.009 then
    raise exception using errcode='23514',message='La imputación supera el saldo neto disponible del pago.';
  end if;

  select coalesce(sum(a.amount),0) into v_used_folio
  from public.hotel_finance_document_payment_allocations a
  where a.payment_id=v_payment.id and a.folio_id=v_doc.folio_id and a.document_id<>v_doc.id;
  if v_used_folio+p_amount>v_folio_available+.009 then
    raise exception using errcode='23514',message='La imputación supera el importe del pago asignado a este folio.';
  end if;

  v_effective:=private.hl_finance_invoice_effective_total(v_doc.id);
  select coalesce(sum(amount),0) into v_used_doc
  from public.hotel_finance_document_payment_allocations
  where document_id=v_doc.id and payment_id<>v_payment.id;
  if v_used_doc+p_amount>v_effective+.009 then
    raise exception using errcode='23514',message='La imputación supera el saldo exigible de la factura.';
  end if;

  if p_amount<=.009 then
    delete from public.hotel_finance_document_payment_allocations
    where payment_id=v_payment.id and document_id=v_doc.id;
    perform private.hl_recalculate_finance_invoice(v_doc.id);
    return null;
  end if;

  insert into public.hotel_finance_document_payment_allocations(
    property_id,reservation_id,folio_id,document_id,payment_id,amount,currency,source,created_by
  ) values(
    v_doc.property_id,v_doc.reservation_id,v_doc.folio_id,v_doc.id,v_payment.id,p_amount,v_doc.currency,'manual',auth.uid()
  )
  on conflict(document_id,payment_id) do update
    set amount=excluded.amount,currency=excluded.currency,updated_at=now()
  returning * into v_result;

  perform private.hl_recalculate_finance_invoice(v_doc.id);
  return v_result;
end;
$function$;

revoke all on function public.hl_allocate_payment_to_finance_document(bigint,uuid,numeric) from public;
revoke all on function public.hl_allocate_payment_to_finance_document(bigint,uuid,numeric) from anon;
grant execute on function public.hl_allocate_payment_to_finance_document(bigint,uuid,numeric) to authenticated;

revoke all on function private.hl_finance_invoice_effective_total(uuid) from public;
revoke all on function private.hl_finance_invoice_payment_total(uuid) from public;
revoke all on function private.hl_recalculate_finance_invoice(uuid) from public;
revoke all on function private.hl_trim_finance_document_allocations(bigint,uuid,numeric) from public;
