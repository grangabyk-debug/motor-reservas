create or replace function public.hl_validate_inbox_context_links()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  if new.guest_profile_id is not null and not exists (
    select 1 from public.hotel_guest_profiles g where g.id=new.guest_profile_id and g.property_id=new.property_id
  ) then
    raise exception 'guest_profile_id does not belong to conversation property';
  end if;
  if new.reservation_id is not null and not exists (
    select 1 from public.reservas r where r.id=new.reservation_id and r.property_id=new.property_id
  ) then
    raise exception 'reservation_id does not belong to conversation property';
  end if;
  if new.room_id is not null and not exists (
    select 1 from public.habitaciones h where h.id=new.room_id and h.property_id=new.property_id
  ) then
    raise exception 'room_id does not belong to conversation property';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_inbox_conversations_context_tenant on public.inbox_conversations;
create trigger trg_inbox_conversations_context_tenant
before insert or update of property_id,guest_profile_id,reservation_id,room_id
on public.inbox_conversations
for each row execute function public.hl_validate_inbox_context_links();
