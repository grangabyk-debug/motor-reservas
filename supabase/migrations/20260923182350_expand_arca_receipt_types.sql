alter table public.hotel_arca_invoice_requests
  drop constraint if exists hotel_arca_invoice_requests_receipt_type_check;

alter table public.hotel_arca_invoice_requests
  add constraint hotel_arca_invoice_requests_receipt_type_check
  check (receipt_type between 1 and 999);

comment on constraint hotel_arca_invoice_requests_receipt_type_check
  on public.hotel_arca_invoice_requests is
  'Permite todos los códigos de comprobante vigentes devueltos por las tablas ARCA, incluidas notas y variantes especiales de Factura A.';
