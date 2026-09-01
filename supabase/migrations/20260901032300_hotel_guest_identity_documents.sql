-- Habitación Llena: guest identity snapshot + reusable document ownership.
-- Backward-compatible: existing reservation and document rows remain valid.

alter table public.reservas
  add column if not exists tipo_documento_huesped text,
  add column if not exists fecha_nacimiento_huesped date,
  add column if not exists nacionalidad_huesped text,
  add column if not exists ciudad_huesped text,
  add column if not exists idioma_huesped text;

alter table public.hotel_reservation_documents
  add column if not exists guest_profile_id uuid references public.hotel_guest_profiles(id) on delete set null,
  add column if not exists holder_role text not null default 'reservation',
  add column if not exists holder_name text,
  add column if not exists passenger_index integer,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conname = 'hotel_reservation_documents_holder_role_check'
       and conrelid = 'public.hotel_reservation_documents'::regclass
  ) then
    alter table public.hotel_reservation_documents
      add constraint hotel_reservation_documents_holder_role_check
      check (holder_role in ('reservation','primary','companion','company'));
  end if;
end $$;

create index if not exists hotel_reservation_documents_reserva_idx
  on public.hotel_reservation_documents(reserva_id);
create index if not exists hotel_reservation_documents_guest_profile_idx
  on public.hotel_reservation_documents(guest_profile_id)
  where guest_profile_id is not null;

create or replace function public.hl_sync_guest_profile_from_reservation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_key text;
  v_profile uuid;
begin
  v_key := case
    when nullif(lower(trim(new.email_huesped)), '') is not null then 'email:'||lower(trim(new.email_huesped))
    when nullif(trim(new.dni_huesped), '') is not null then 'doc:'||lower(trim(new.dni_huesped))
    when nullif(regexp_replace(coalesce(new.telefono_huesped,''),'\D','','g'), '') is not null then 'phone:'||regexp_replace(new.telefono_huesped,'\D','','g')
    else 'name:'||lower(trim(coalesce(new.nombre_huesped,'sin nombre')))
  end;

  insert into public.hotel_guest_profiles(
    property_id, canonical_key, full_name, email, phone,
    document_type, document_number, birth_date, nationality, language,
    address, city, province, country, last_stay_at, updated_at
  ) values (
    new.property_id, v_key, coalesce(new.nombre_huesped,''), new.email_huesped, new.telefono_huesped,
    new.tipo_documento_huesped, new.dni_huesped, new.fecha_nacimiento_huesped, new.nacionalidad_huesped, new.idioma_huesped,
    new.direccion_huesped, new.ciudad_huesped, new.provincia_estado_huesped, new.pais_huesped, new.fecha_salida, now()
  )
  on conflict(property_id, canonical_key) do update set
    full_name = excluded.full_name,
    email = coalesce(excluded.email, hotel_guest_profiles.email),
    phone = coalesce(excluded.phone, hotel_guest_profiles.phone),
    document_type = coalesce(excluded.document_type, hotel_guest_profiles.document_type),
    document_number = coalesce(excluded.document_number, hotel_guest_profiles.document_number),
    birth_date = coalesce(excluded.birth_date, hotel_guest_profiles.birth_date),
    nationality = coalesce(excluded.nationality, hotel_guest_profiles.nationality),
    language = coalesce(excluded.language, hotel_guest_profiles.language),
    address = coalesce(excluded.address, hotel_guest_profiles.address),
    city = coalesce(excluded.city, hotel_guest_profiles.city),
    province = coalesce(excluded.province, hotel_guest_profiles.province),
    country = coalesce(excluded.country, hotel_guest_profiles.country),
    last_stay_at = greatest(coalesce(hotel_guest_profiles.last_stay_at, excluded.last_stay_at), excluded.last_stay_at),
    updated_at = now()
  returning id into v_profile;

  new.guest_profile_id := v_profile;
  return new;
end
$function$;

drop trigger if exists hl_sync_guest_profile_trigger on public.reservas;
create trigger hl_sync_guest_profile_trigger
before insert or update of
  nombre_huesped,
  email_huesped,
  telefono_huesped,
  dni_huesped,
  tipo_documento_huesped,
  fecha_nacimiento_huesped,
  nacionalidad_huesped,
  idioma_huesped,
  direccion_huesped,
  ciudad_huesped,
  provincia_estado_huesped,
  pais_huesped,
  fecha_salida
on public.reservas
for each row execute function public.hl_sync_guest_profile_from_reservation();
