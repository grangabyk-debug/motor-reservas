create or replace function private.hl_assign_room_folio_sequence()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
begin
  if new.folio_type='master' then
    new.sort_order:=0;
  elsif new.folio_type='room' and new.room_id is not null then
    select coalesce(max(f.sort_order),0)+1
      into new.sort_order
    from public.hotel_folios f
    where f.reservation_id=new.reservation_id
      and f.folio_type='room'
      and f.status<>'void';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hl_room_folio_sequence on public.hotel_folios;
create trigger trg_hl_room_folio_sequence
before insert on public.hotel_folios
for each row
execute function private.hl_assign_room_folio_sequence();

with ranked as (
  select
    id,
    row_number() over(
      partition by reservation_id
      order by created_at,sort_order,id
    )::integer as seq
  from public.hotel_folios
  where folio_type='room'
    and status<>'void'
)
update public.hotel_folios f
set sort_order=r.seq,
    updated_at=now()
from ranked r
where f.id=r.id
  and f.sort_order is distinct from r.seq;

update public.hotel_folios
set sort_order=0,
    updated_at=now()
where folio_type='master'
  and status<>'void'
  and sort_order is distinct from 0;
