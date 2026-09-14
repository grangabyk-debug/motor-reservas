insert into public.property_settings(property_id, settings, updated_at, updated_by)
select p.id,
       jsonb_build_object(
         'taxes', jsonb_build_object(
           'enabled', true,
           'country', 'AR',
           'vat_rate', 21,
           'show_breakdown', true,
           'default_recipient_condition', 'consumidor_final',
           'additional_taxes_enabled', true,
           'price_tax_mode', 'tax_excluded'
         )
       ),
       now(),
       p.owner_id
from public.properties p
on conflict (property_id) do update
set settings = case
  when coalesce(property_settings.settings->'taxes'->>'price_tax_mode','') in ('tax_included','tax_excluded')
    then property_settings.settings
  else jsonb_set(
    coalesce(property_settings.settings,'{}'::jsonb),
    '{taxes,price_tax_mode}',
    '"tax_excluded"'::jsonb,
    true
  )
end,
updated_at = now();

create or replace function public.hl_bootstrap_new_hotel_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
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

  insert into public.property_settings(property_id, settings, updated_at, updated_by)
  values (
    v_property_id,
    jsonb_build_object(
      'preferences', jsonb_build_object(
        'currency','ARS',
        'timezone','America/Argentina/Buenos_Aires',
        'checkin_time','15:00',
        'checkout_time','11:00',
        'language','es-AR',
        'early_checkin_percent',35,
        'late_checkout_percent',35,
        'early_checkin_time','08:00',
        'late_checkout_time','18:00'
      ),
      'taxes', jsonb_build_object(
        'enabled',true,
        'country','AR',
        'vat_rate',21,
        'show_breakdown',true,
        'default_recipient_condition','consumidor_final',
        'additional_taxes_enabled',true,
        'price_tax_mode','tax_included'
      )
    ),
    now(),
    new.id
  )
  on conflict (property_id) do nothing;

  return new;
end;
$function$;
