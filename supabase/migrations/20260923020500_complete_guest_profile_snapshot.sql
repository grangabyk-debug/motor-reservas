alter table public.hotel_reservation_guests
  add column if not exists language text;

create or replace function private.hl_validate_selected_guest_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_canonical uuid;
begin
  if new.guest_profile_id is null then return new; end if;
  v_canonical:=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id);
  if not exists(
    select 1 from public.hotel_guest_profiles p
    where p.property_id=new.property_id and p.id=v_canonical and p.merged_into_id is null
  ) then
    raise exception using errcode='22023',message='El huésped seleccionado ya no existe o no pertenece a esta propiedad. Volvé a elegirlo desde Huéspedes.';
  end if;
  new.guest_profile_id:=v_canonical;
  return new;
end
$function$;

drop trigger if exists ab_hl_validate_selected_guest_profile on public.reservas;
create trigger ab_hl_validate_selected_guest_profile
before insert or update of guest_profile_id,property_id on public.reservas
for each row execute function private.hl_validate_selected_guest_profile();

create or replace function private.hl_guest_language_from_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_canonical uuid;
  v_language text;
begin
  if new.guest_profile_id is null then return new; end if;
  v_canonical:=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id);
  select p.language into v_language
  from public.hotel_guest_profiles p
  where p.property_id=new.property_id and p.id=v_canonical and p.merged_into_id is null;
  if found then
    new.guest_profile_id:=v_canonical;
    new.language:=coalesce(nullif(trim(new.language),''),v_language);
  end if;
  return new;
end
$function$;

drop trigger if exists aa_hl_guest_language_from_profile on public.hotel_reservation_guests;
create trigger aa_hl_guest_language_from_profile
before insert or update of guest_profile_id,language on public.hotel_reservation_guests
for each row execute function private.hl_guest_language_from_profile();

create or replace function private.hl_guest_language_to_profile()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_canonical uuid;
begin
  if new.guest_profile_id is null or nullif(trim(new.language),'') is null then return new; end if;
  v_canonical:=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id);
  update public.hotel_guest_profiles
     set language=nullif(trim(new.language),''),updated_at=now()
   where property_id=new.property_id and id=v_canonical and merged_into_id is null;
  return new;
end
$function$;

drop trigger if exists zz_hl_guest_language_to_profile on public.hotel_reservation_guests;
create trigger zz_hl_guest_language_to_profile
after insert or update of guest_profile_id,language on public.hotel_reservation_guests
for each row execute function private.hl_guest_language_to_profile();

update public.hotel_reservation_guests g
set language=p.language,updated_at=now()
from public.hotel_guest_profiles p
where g.guest_profile_id is not null
  and p.property_id=g.property_id
  and p.id=private.hl_canonical_guest_profile_id(g.property_id,g.guest_profile_id)
  and nullif(trim(coalesce(g.language,'')),'') is null
  and nullif(trim(coalesce(p.language,'')),'') is not null;
