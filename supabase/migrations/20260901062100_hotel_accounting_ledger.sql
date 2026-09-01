create or replace view public.hotel_accounting_ledger
with (security_invoker=true) as
with
issued_docs as (
  select d.*,
    greatest(coalesce(d.total,0)-coalesce(d.tax,0),0)::numeric as revenue_amount,
    (d.document_type='credit_note') as is_credit
  from public.hotel_finance_documents d
  where d.status='issued' and d.document_type in ('invoice','invoice_draft','fiscal_invoice','credit_note')
),
payment_base as (
  select p.*,(greatest(coalesce(p.monto,0)-coalesce(p.refunded_amount,0),0))::numeric as net_amount,
    exists(select 1 from issued_docs d where d.property_id=p.property_id and d.reservation_id=p.reserva_id and coalesce(d.issued_at,d.created_at)<=p.created_at and not d.is_credit) as invoiced_before
  from public.pagos p
  where lower(coalesce(p.estado,'confirmado')) not in ('anulado','cancelado','reembolsado','refunded')
),
ledger as (
  select d.property_id,'doc:'||d.id::text as entry_key,'document'::text as source_type,d.id::text as source_id,
    coalesce(d.issued_at,d.created_at)::date as entry_date,coalesce(d.number,d.external_ref,'Documento') as reference,
    case when d.is_credit then 'Nota de crédito' else 'Documento emitido' end as description,
    a.code as account_code,a.name as account_name,
    case when d.is_credit then 0::numeric else d.total end as debit,
    case when d.is_credit then d.total else 0::numeric end as credit,d.reservation_id,d.currency
  from issued_docs d join public.hotel_chart_accounts a on a.property_id=d.property_id and a.system_key='accounts_receivable'
  union all
  select d.property_id,'doc:'||d.id::text,'document',d.id::text,coalesce(d.issued_at,d.created_at)::date,coalesce(d.number,d.external_ref,'Documento'),
    case when d.is_credit then 'Reversión de ingreso' else 'Ingreso por alojamiento y servicios' end,a.code,a.name,
    case when d.is_credit then d.revenue_amount else 0::numeric end,case when d.is_credit then 0::numeric else d.revenue_amount end,d.reservation_id,d.currency
  from issued_docs d join public.hotel_chart_accounts a on a.property_id=d.property_id and a.system_key='lodging_revenue'
  where d.revenue_amount<>0
  union all
  select d.property_id,'doc:'||d.id::text,'document',d.id::text,coalesce(d.issued_at,d.created_at)::date,coalesce(d.number,d.external_ref,'Documento'),
    case when d.is_credit then 'Reversión IVA débito fiscal' else 'IVA débito fiscal' end,a.code,a.name,
    case when d.is_credit then d.tax else 0::numeric end,case when d.is_credit then 0::numeric else d.tax end,d.reservation_id,d.currency
  from issued_docs d join public.hotel_chart_accounts a on a.property_id=d.property_id and a.system_key='vat_output'
  where coalesce(d.tax,0)>0
  union all
  select p.property_id,'pay:'||p.id::text,'payment',p.id::text,p.created_at::date,coalesce(p.referencia,p.external_ref,'Pago '||p.id::text),
    'Cobro · '||coalesce(p.metodo,'Sin medio'),a.code,a.name,p.net_amount,0::numeric,p.reserva_id,p.moneda
  from payment_base p join public.hotel_chart_accounts a on a.property_id=p.property_id and a.system_key=
    case when lower(coalesce(p.metodo,'')) in ('efectivo','cash') then 'cash'
         when lower(coalesce(p.metodo,'')) like '%mercado pago%' or lower(coalesce(p.metodo,'')) like '%tarjeta%' or lower(coalesce(p.metodo,'')) like '%crédito%' or lower(coalesce(p.metodo,'')) like '%credito%' or lower(coalesce(p.metodo,'')) like '%débito%' or lower(coalesce(p.metodo,'')) like '%debito%' then 'wallets'
         else 'bank' end
  where p.net_amount>0
  union all
  select p.property_id,'pay:'||p.id::text,'payment',p.id::text,p.created_at::date,coalesce(p.referencia,p.external_ref,'Pago '||p.id::text),
    case when p.invoiced_before then 'Cancelación de cuenta a cobrar' else 'Anticipo de huésped' end,a.code,a.name,0::numeric,p.net_amount,p.reserva_id,p.moneda
  from payment_base p join public.hotel_chart_accounts a on a.property_id=p.property_id and a.system_key=case when p.invoiced_before then 'accounts_receivable' else 'guest_advances' end
  where p.net_amount>0
  union all
  select d.property_id,'advance-clear:'||d.id::text,'advance_clear',d.id::text,coalesce(d.issued_at,d.created_at)::date,coalesce(d.number,d.external_ref,'Documento'),
    'Aplicación de anticipos previos',a.code,a.name,least(d.total,coalesce((select sum(p.net_amount) from payment_base p where p.property_id=d.property_id and p.reserva_id=d.reservation_id and p.created_at<coalesce(d.issued_at,d.created_at)),0)),0::numeric,d.reservation_id,d.currency
  from issued_docs d join public.hotel_chart_accounts a on a.property_id=d.property_id and a.system_key='guest_advances'
  where not d.is_credit and d.reservation_id is not null
    and not exists(select 1 from issued_docs earlier where earlier.property_id=d.property_id and earlier.reservation_id=d.reservation_id and not earlier.is_credit and coalesce(earlier.issued_at,earlier.created_at)<coalesce(d.issued_at,d.created_at))
    and coalesce((select sum(p.net_amount) from payment_base p where p.property_id=d.property_id and p.reserva_id=d.reservation_id and p.created_at<coalesce(d.issued_at,d.created_at)),0)>0
  union all
  select d.property_id,'advance-clear:'||d.id::text,'advance_clear',d.id::text,coalesce(d.issued_at,d.created_at)::date,coalesce(d.number,d.external_ref,'Documento'),
    'Aplicación de anticipos a la cuenta',a.code,a.name,0::numeric,least(d.total,coalesce((select sum(p.net_amount) from payment_base p where p.property_id=d.property_id and p.reserva_id=d.reservation_id and p.created_at<coalesce(d.issued_at,d.created_at)),0)),d.reservation_id,d.currency
  from issued_docs d join public.hotel_chart_accounts a on a.property_id=d.property_id and a.system_key='accounts_receivable'
  where not d.is_credit and d.reservation_id is not null
    and not exists(select 1 from issued_docs earlier where earlier.property_id=d.property_id and earlier.reservation_id=d.reservation_id and not earlier.is_credit and coalesce(earlier.issued_at,earlier.created_at)<coalesce(d.issued_at,d.created_at))
    and coalesce((select sum(p.net_amount) from payment_base p where p.property_id=d.property_id and p.reserva_id=d.reservation_id and p.created_at<coalesce(d.issued_at,d.created_at)),0)>0
  union all
  select m.property_id,'cash:'||m.id::text,'cash_movement',m.id::text,m.created_at::date,coalesce(m.reference,'Caja'),m.concept,a.code,a.name,
    m.amount,0::numeric,m.reservation_id,m.currency
  from public.hotel_cash_movements m join public.hotel_chart_accounts a on a.property_id=m.property_id and a.system_key=case when m.movement_type='expense' then 'operating_expense' else 'cash' end
  where coalesce(m.reference,'') not like 'pago:%'
  union all
  select m.property_id,'cash:'||m.id::text,'cash_movement',m.id::text,m.created_at::date,coalesce(m.reference,'Caja'),m.concept,a.code,a.name,
    0::numeric,m.amount,m.reservation_id,m.currency
  from public.hotel_cash_movements m join public.hotel_chart_accounts a on a.property_id=m.property_id and a.system_key=case when m.movement_type='expense' then 'cash' else 'other_revenue' end
  where coalesce(m.reference,'') not like 'pago:%'
  union all
  select e.property_id,'expense:'||e.id::text,'expense',e.id::text,e.occurred_on,coalesce(e.document_number,e.reference,'Gasto'),
    coalesce(e.supplier_name||' · ','')||e.concept,a.code,a.name,greatest(e.amount-e.tax_amount,0),0::numeric,null::bigint,e.currency
  from public.hotel_accounting_expenses e
  join public.hotel_chart_accounts a on a.id=coalesce(e.account_id,(select x.id from public.hotel_chart_accounts x where x.property_id=e.property_id and x.system_key='operating_expense' limit 1))
  where e.status='posted' and e.amount-e.tax_amount>0
  union all
  select e.property_id,'expense:'||e.id::text,'expense',e.id::text,e.occurred_on,coalesce(e.document_number,e.reference,'Gasto'),
    'IVA crédito fiscal · '||e.concept,a.code,a.name,e.tax_amount,0::numeric,null::bigint,e.currency
  from public.hotel_accounting_expenses e join public.hotel_chart_accounts a on a.property_id=e.property_id and a.system_key='vat_input'
  where e.status='posted' and e.tax_amount>0
  union all
  select e.property_id,'expense:'||e.id::text,'expense',e.id::text,e.occurred_on,coalesce(e.document_number,e.reference,'Gasto'),
    coalesce(e.supplier_name||' · ','')||e.concept,a.code,a.name,0::numeric,e.amount,null::bigint,e.currency
  from public.hotel_accounting_expenses e join public.hotel_chart_accounts a on a.property_id=e.property_id and a.system_key=
    case when lower(coalesce(e.payment_method,'')) in ('efectivo','cash') then 'cash'
         when lower(coalesce(e.payment_method,'')) like '%mercado pago%' or lower(coalesce(e.payment_method,'')) like '%tarjeta%' then 'wallets'
         when lower(coalesce(e.payment_method,'')) like '%a pagar%' or lower(coalesce(e.payment_method,'')) like '%cuenta corriente%' then 'accounts_payable'
         else 'bank' end
  where e.status='posted'
)
select property_id,entry_key,source_type,source_id,entry_date,reference,description,account_code,account_name,debit,credit,reservation_id,currency
from ledger;

grant select on public.hotel_accounting_ledger to authenticated;
revoke all on public.hotel_accounting_ledger from anon;
