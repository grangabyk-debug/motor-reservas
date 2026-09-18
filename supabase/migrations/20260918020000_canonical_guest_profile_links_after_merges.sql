create or replace function private.hl_canonical_guest_profile_id(
  p_property_id uuid,
  p_profile_id uuid
)
returns uuid
language plpgsql
security definer
stable
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_current uuid:=p_profile_id;
  v_next uuid;
  v_hops integer:=0;
begin
  if v_current is null then return null; end if;
  loop
    select merged_into_id into v_next
    from public.hotel_guest_profiles
    where id=v_current and property_id=p_property_id;
    if not found or v_next is null or v_next=v_current then return v_current; end if;
    v_current:=v_next;
    v_hops:=v_hops+1;
    if v_hops>=12 then return v_current; end if;
  end loop;
end;
$function$;

create or replace function private.hl_reservation_canonical_guest_profile_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if new.guest_profile_id is not null and new.property_id is not null then
    new.guest_profile_id:=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists hl_reservation_canonical_guest_profile on public.reservas;
create trigger hl_reservation_canonical_guest_profile
before insert or update on public.reservas
for each row execute function private.hl_reservation_canonical_guest_profile_trigger();

create or replace function private.hl_guest_profile_merge_relink_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_canonical uuid;
begin
  if new.merged_into_id is null or new.merged_into_id is not distinct from old.merged_into_id then
    return new;
  end if;
  v_canonical:=private.hl_canonical_guest_profile_id(new.property_id,new.merged_into_id);

  update public.reservas
  set guest_profile_id=v_canonical
  where property_id=new.property_id and guest_profile_id=new.id;

  update public.hotel_reservation_guests
  set guest_profile_id=v_canonical,updated_at=now()
  where property_id=new.property_id and guest_profile_id=new.id;

  update public.hotel_reservation_documents
  set guest_profile_id=v_canonical
  where property_id=new.property_id and guest_profile_id=new.id;

  update public.inbox_conversations
  set guest_profile_id=v_canonical,updated_at=now()
  where property_id=new.property_id and guest_profile_id=new.id;

  return new;
end;
$function$;

drop trigger if exists hl_guest_profile_merge_relink on public.hotel_guest_profiles;
create trigger hl_guest_profile_merge_relink
after update of merged_into_id on public.hotel_guest_profiles
for each row
when (new.merged_into_id is not null and new.merged_into_id is distinct from old.merged_into_id)
execute function private.hl_guest_profile_merge_relink_trigger();

do $repair$
begin
  update public.reservas r
  set guest_profile_id=private.hl_canonical_guest_profile_id(r.property_id,r.guest_profile_id)
  where r.guest_profile_id is not null
    and r.guest_profile_id is distinct from private.hl_canonical_guest_profile_id(r.property_id,r.guest_profile_id);

  update public.hotel_reservation_guests g
  set guest_profile_id=private.hl_canonical_guest_profile_id(g.property_id,g.guest_profile_id),updated_at=now()
  where g.guest_profile_id is not null
    and g.guest_profile_id is distinct from private.hl_canonical_guest_profile_id(g.property_id,g.guest_profile_id);

  update public.hotel_reservation_documents d
  set guest_profile_id=private.hl_canonical_guest_profile_id(d.property_id,d.guest_profile_id)
  where d.guest_profile_id is not null
    and d.guest_profile_id is distinct from private.hl_canonical_guest_profile_id(d.property_id,d.guest_profile_id);

  update public.inbox_conversations c
  set guest_profile_id=private.hl_canonical_guest_profile_id(c.property_id,c.guest_profile_id),updated_at=now()
  where c.guest_profile_id is not null
    and c.guest_profile_id is distinct from private.hl_canonical_guest_profile_id(c.property_id,c.guest_profile_id);
end
$repair$;
