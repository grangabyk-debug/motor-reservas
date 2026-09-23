CREATE OR REPLACE FUNCTION private.hl_refresh_primary_guest_from_reservation_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  p public.hotel_guest_profiles%rowtype;
begin
  if new.guest_profile_id is null then return new; end if;
  if tg_op='UPDATE' and new.guest_profile_id is not distinct from old.guest_profile_id then return new; end if;

  select * into p
  from public.hotel_guest_profiles gp
  where gp.id=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id)
    and gp.property_id=new.property_id
    and gp.merged_into_id is null
  limit 1;

  if not found then return new; end if;

  update public.hotel_reservation_guests g
     set guest_profile_id=p.id,
         full_name=coalesce(nullif(trim(g.full_name),''),p.full_name),
         email=coalesce(nullif(trim(g.email),''),p.email),
         phone=coalesce(nullif(trim(g.phone),''),p.phone),
         document_type=coalesce(nullif(trim(g.document_type),''),p.document_type),
         document_number=coalesce(nullif(trim(g.document_number),''),p.document_number),
         birth_date=coalesce(g.birth_date,p.birth_date),
         sex=coalesce(nullif(trim(g.sex),''),p.sex),
         marital_status=coalesce(nullif(trim(g.marital_status),''),p.marital_status),
         cuil=coalesce(nullif(trim(g.cuil),''),p.cuil),
         nationality=coalesce(nullif(trim(g.nationality),''),p.nationality),
         address=coalesce(nullif(trim(g.address),''),p.address),
         city=coalesce(nullif(trim(g.city),''),p.city),
         province=coalesce(nullif(trim(g.province),''),p.province),
         country=coalesce(nullif(trim(g.country),''),p.country),
         postal_code=coalesce(nullif(trim(g.postal_code),''),p.postal_code),
         occupation=coalesce(nullif(trim(g.occupation),''),p.occupation),
         travel_reason=coalesce(nullif(trim(g.travel_reason),''),p.travel_reason),
         document_front_path=coalesce(g.document_front_path,p.document_front_path),
         document_back_path=coalesce(g.document_back_path,p.document_back_path),
         notes=coalesce(nullif(trim(g.notes),''),p.notes),
         updated_at=now()
   where g.property_id=new.property_id
     and g.reservation_id=new.id
     and g.role='primary';

  return new;
end
$function$


drop trigger if exists zz_hl_refresh_primary_guest_from_profile on public.reservas;
create trigger zz_hl_refresh_primary_guest_from_profile
after insert or update of guest_profile_id on public.reservas
for each row execute function private.hl_refresh_primary_guest_from_reservation_profile();
