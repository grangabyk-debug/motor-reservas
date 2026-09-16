create or replace function private.hl_guard_finance_document_lifecycle()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
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

  if old.status<>'draft' and coalesce(new.balance,0)>coalesce(old.balance,0)+0.01 then
    raise exception using errcode='23514',message='El saldo de un comprobante emitido no puede aumentar. Generá un documento de ajuste.';
  end if;

  if old.status='draft' and new.status not in ('draft','issued','void') then
    raise exception using errcode='23514',message='Un borrador sólo puede emitirse o anularse.';
  elsif old.status='issued' and new.status not in ('issued','partial','paid','void') then
    raise exception using errcode='23514',message='Un comprobante emitido no puede volver a borrador.';
  elsif old.status='partial' and new.status not in ('partial','paid') then
    raise exception using errcode='23514',message='Un comprobante con pagos aplicados no puede anularse ni volver atrás. Corregilo con una nota.';
  elsif old.status='paid' and new.status<>'paid' then
    raise exception using errcode='23514',message='Un comprobante pagado no puede cambiar de estado. Corregilo con una nota.';
  end if;

  return new;
end;
$function$;

drop trigger if exists hotel_finance_documents_lifecycle_guard on public.hotel_finance_documents;
create trigger hotel_finance_documents_lifecycle_guard
before update or delete on public.hotel_finance_documents
for each row execute function private.hl_guard_finance_document_lifecycle();
