alter table public.hotel_guest_profiles
  add column if not exists merged_into_id uuid references public.hotel_guest_profiles(id) on delete restrict,
  add column if not exists merged_at timestamptz,
  add column if not exists merged_by uuid references auth.users(id) on delete set null,
  add column if not exists merge_snapshot jsonb;

create index if not exists hotel_guest_profiles_active_merge_idx
  on public.hotel_guest_profiles(property_id, merged_into_id, updated_at desc);

create or replace function public.hl_merge_guest_profiles(
  p_property_id uuid,
  p_primary_profile_id uuid,
  p_duplicate_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_primary public.hotel_guest_profiles%rowtype;
  v_duplicate public.hotel_guest_profiles%rowtype;
  v_reservations integer := 0;
  v_reservation_guests integer := 0;
  v_documents integer := 0;
  v_conversations integer := 0;
  v_tags text[];
  v_snapshot jsonb;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if not private.user_has_property_role(p_property_id, array['owner','manager','reception']::text[]) then
    raise exception 'No tenés permisos para fusionar huéspedes';
  end if;
  if p_primary_profile_id is null or p_duplicate_profile_id is null or p_primary_profile_id = p_duplicate_profile_id then
    raise exception 'Elegí dos perfiles distintos';
  end if;

  select * into v_primary from public.hotel_guest_profiles
  where id=p_primary_profile_id and property_id=p_property_id for update;
  if not found then raise exception 'No se encontró el perfil principal'; end if;

  select * into v_duplicate from public.hotel_guest_profiles
  where id=p_duplicate_profile_id and property_id=p_property_id for update;
  if not found then raise exception 'No se encontró el perfil a fusionar'; end if;

  if v_primary.merged_into_id is not null then raise exception 'El perfil principal ya fue fusionado con otro perfil'; end if;
  if v_duplicate.merged_into_id is not null then raise exception 'El perfil seleccionado ya fue fusionado'; end if;

  select coalesce(array_agg(distinct tag order by tag) filter(where nullif(trim(tag),'') is not null),'{}'::text[])
    into v_tags from unnest(coalesce(v_primary.tags,'{}'::text[])||coalesce(v_duplicate.tags,'{}'::text[])) tag;

  v_snapshot:=jsonb_build_object('merged_at',now(),'merged_by',auth.uid(),'source_profile',jsonb_build_object(
    'id',v_duplicate.id,'full_name',v_duplicate.full_name,'email',v_duplicate.email,'phone',v_duplicate.phone,
    'document_type',v_duplicate.document_type,'document_number',v_duplicate.document_number,'birth_date',v_duplicate.birth_date,
    'nationality',v_duplicate.nationality,'address',v_duplicate.address,'city',v_duplicate.city,'province',v_duplicate.province,
    'country',v_duplicate.country,'notes',v_duplicate.notes,'tags',v_duplicate.tags));

  update public.hotel_guest_profiles set
    full_name=coalesce(nullif(trim(full_name),''),nullif(trim(v_duplicate.full_name),''),full_name),
    email=coalesce(nullif(trim(email),''),nullif(trim(v_duplicate.email),'')),
    phone=coalesce(nullif(trim(phone),''),nullif(trim(v_duplicate.phone),'')),
    document_type=coalesce(nullif(trim(document_type),''),nullif(trim(v_duplicate.document_type),'')),
    document_number=coalesce(nullif(trim(document_number),''),nullif(trim(v_duplicate.document_number),'')),
    birth_date=coalesce(birth_date,v_duplicate.birth_date),nationality=coalesce(nullif(trim(nationality),''),nullif(trim(v_duplicate.nationality),'')),
    language=coalesce(nullif(trim(language),''),nullif(trim(v_duplicate.language),'')),address=coalesce(nullif(trim(address),''),nullif(trim(v_duplicate.address),'')),
    city=coalesce(nullif(trim(city),''),nullif(trim(v_duplicate.city),'')),province=coalesce(nullif(trim(province),''),nullif(trim(v_duplicate.province),'')),
    country=coalesce(nullif(trim(country),''),nullif(trim(v_duplicate.country),'')),sex=coalesce(nullif(trim(sex),''),nullif(trim(v_duplicate.sex),'')),
    marital_status=coalesce(nullif(trim(marital_status),''),nullif(trim(v_duplicate.marital_status),'')),cuil=coalesce(nullif(trim(cuil),''),nullif(trim(v_duplicate.cuil),'')),
    postal_code=coalesce(nullif(trim(postal_code),''),nullif(trim(v_duplicate.postal_code),'')),occupation=coalesce(nullif(trim(occupation),''),nullif(trim(v_duplicate.occupation),'')),
    travel_reason=coalesce(nullif(trim(travel_reason),''),nullif(trim(v_duplicate.travel_reason),'')),document_front_path=coalesce(nullif(trim(document_front_path),''),nullif(trim(v_duplicate.document_front_path),'')),
    document_back_path=coalesce(nullif(trim(document_back_path),''),nullif(trim(v_duplicate.document_back_path),'')),preferences=coalesce(v_duplicate.preferences,'{}'::jsonb)||coalesce(preferences,'{}'::jsonb),
    tags=v_tags,last_stay_at=greatest(coalesce(last_stay_at,v_duplicate.last_stay_at),coalesce(v_duplicate.last_stay_at,last_stay_at)),updated_at=now()
  where id=p_primary_profile_id;

  update public.reservas set guest_profile_id=p_primary_profile_id where property_id=p_property_id and guest_profile_id=p_duplicate_profile_id;
  get diagnostics v_reservations=row_count;
  update public.hotel_reservation_guests set guest_profile_id=p_primary_profile_id,updated_at=now() where property_id=p_property_id and guest_profile_id=p_duplicate_profile_id;
  get diagnostics v_reservation_guests=row_count;
  update public.hotel_reservation_documents set guest_profile_id=p_primary_profile_id where property_id=p_property_id and guest_profile_id=p_duplicate_profile_id;
  get diagnostics v_documents=row_count;
  update public.inbox_conversations set guest_profile_id=p_primary_profile_id,updated_at=now() where property_id=p_property_id and guest_profile_id=p_duplicate_profile_id;
  get diagnostics v_conversations=row_count;

  update public.hotel_guest_profiles set merged_into_id=p_primary_profile_id,merged_at=now(),merged_by=auth.uid(),merge_snapshot=v_snapshot,updated_at=now()
  where id=p_duplicate_profile_id;

  return jsonb_build_object('primary_profile_id',p_primary_profile_id,'merged_profile_id',p_duplicate_profile_id,
    'reservations_relinked',v_reservations,'reservation_guests_relinked',v_reservation_guests,'documents_relinked',v_documents,'conversations_relinked',v_conversations);
end
$function$;

revoke all on function public.hl_merge_guest_profiles(uuid,uuid,uuid) from public, anon;
grant execute on function public.hl_merge_guest_profiles(uuid,uuid,uuid) to authenticated;
comment on function public.hl_merge_guest_profiles(uuid,uuid,uuid) is 'Consolida dos perfiles de huésped sin alterar datos comerciales de sus reservas.';