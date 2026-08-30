create or replace function public.hl_bootstrap_new_hotel_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_property_id uuid;
  v_hotel_name text;
  v_city text;
begin
  if coalesce(new.raw_user_meta_data->>'account_type','') <> 'habitacion_llena_hotel' then
    return new;
  end if;

  if exists (select 1 from public.properties p where p.owner_id = new.id) then
    return new;
  end if;

  v_hotel_name := nullif(btrim(coalesce(new.raw_user_meta_data->>'hotel_name','')), '');
  v_city := nullif(btrim(coalesce(new.raw_user_meta_data->>'city','')), '');
  if v_hotel_name is null then v_hotel_name := 'Mi hotel'; end if;

  insert into public.properties(name, city, owner_id)
  values (v_hotel_name, v_city, new.id)
  returning id into v_property_id;

  insert into public.property_members(property_id, user_id, role)
  values (v_property_id, new.id, 'owner')
  on conflict do nothing;

  insert into public.hotel_os_settings(property_id, hotel_name, city)
  values (v_property_id, v_hotel_name, v_city)
  on conflict (property_id) do nothing;

  return new;
end;
$$;

revoke all on function public.hl_bootstrap_new_hotel_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_habitacion_llena on auth.users;
create trigger on_auth_user_created_habitacion_llena
after insert on auth.users
for each row execute function public.hl_bootstrap_new_hotel_user();
