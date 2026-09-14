alter table public.hotel_guarantees drop constraint if exists hotel_guarantees_status_check;
alter table public.hotel_guarantees add constraint hotel_guarantees_status_check check(status in ('pending','available','card_saved','authorized','captured','released','expired','failed','cancelled'));
