alter table public.hotel_finance_documents
  add column if not exists related_document_id uuid,
  add column if not exists adjustment_reason text;

alter table public.hotel_finance_documents
  drop constraint if exists hotel_finance_documents_document_type_check;

alter table public.hotel_finance_documents
  add constraint hotel_finance_documents_document_type_check
  check (document_type = any (array[
    'folio'::text,
    'invoice'::text,
    'receipt'::text,
    'credit_note'::text,
    'debit_note'::text,
    'proforma'::text
  ]));

alter table public.hotel_finance_documents
  drop constraint if exists hotel_finance_documents_related_document_id_fkey;

alter table public.hotel_finance_documents
  add constraint hotel_finance_documents_related_document_id_fkey
  foreign key (related_document_id)
  references public.hotel_finance_documents(id)
  on delete restrict;

create index if not exists hotel_finance_documents_related_document_idx
  on public.hotel_finance_documents(related_document_id)
  where related_document_id is not null;

create or replace function private.hl_validate_finance_adjustment()
returns trigger
language plpgsql
set search_path to 'pg_catalog','public','private'
as $function$
declare
  v_original public.hotel_finance_documents%rowtype;
  v_used numeric := 0;
begin
  if new.document_type not in ('credit_note','debit_note') then
    return new;
  end if;

  if new.related_document_id is null then
    raise exception using errcode='23514', message='La nota debe estar vinculada a un comprobante original.';
  end if;

  select * into v_original
  from public.hotel_finance_documents
  where id=new.related_document_id;

  if not found then
    raise exception using errcode='23503', message='El comprobante original no existe.';
  end if;

  if new.document_type='credit_note' and v_original.document_type<>'invoice' then
    raise exception using errcode='23514', message='La Nota de Crédito debe vincularse a una factura.';
  end if;

  if new.document_type='debit_note' and v_original.document_type<>'credit_note' then
    raise exception using errcode='23514', message='La Nota de Débito debe vincularse a una Nota de Crédito.';
  end if;

  if v_original.status in ('draft','void') then
    raise exception using errcode='23514', message='Primero debe estar emitido el comprobante original.';
  end if;

  if new.property_id is distinct from v_original.property_id
     or new.reservation_id is distinct from v_original.reservation_id
     or new.folio_id is distinct from v_original.folio_id then
    raise exception using errcode='23514', message='La nota debe pertenecer a la misma reserva y folio que el comprobante original.';
  end if;

  if upper(coalesce(new.currency,'')) <> upper(coalesce(v_original.currency,'')) then
    raise exception using errcode='23514', message='La nota debe usar la misma moneda que el comprobante original.';
  end if;

  if coalesce(new.total,0) <= 0 then
    raise exception using errcode='23514', message='El importe de la nota debe ser mayor a cero.';
  end if;

  select coalesce(sum(d.total),0)
    into v_used
  from public.hotel_finance_documents d
  where d.related_document_id=new.related_document_id
    and d.document_type=new.document_type
    and d.status<>'void'
    and d.id<>coalesce(new.id,'00000000-0000-0000-0000-000000000000'::uuid);

  if v_used + coalesce(new.total,0) > coalesce(v_original.total,0) + 0.01 then
    raise exception using errcode='23514', message=case
      when new.document_type='credit_note' then 'La Nota de Crédito supera el saldo disponible de la factura.'
      else 'La Nota de Débito supera el saldo disponible de la Nota de Crédito.'
    end;
  end if;

  return new;
end;
$function$;

drop trigger if exists hotel_finance_documents_validate_adjustment
  on public.hotel_finance_documents;

create trigger hotel_finance_documents_validate_adjustment
before insert or update of document_type,related_document_id,total,status,currency,property_id,reservation_id,folio_id
on public.hotel_finance_documents
for each row
execute function private.hl_validate_finance_adjustment();
