alter table public.hotel_guarantees drop constraint if exists hotel_guarantees_provider_check;
alter table public.hotel_guarantees add constraint hotel_guarantees_provider_check check(provider in ('mercadopago','manual','channel'));
