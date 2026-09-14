update public.property_settings
set settings=jsonb_set(
  coalesce(settings,'{}'::jsonb),
  '{taxes}',
  coalesce(settings->'taxes','{}'::jsonb) || jsonb_build_object('price_tax_mode','tax_included'),
  true
),
updated_at=now()
where coalesce(settings->'taxes'->>'price_tax_mode','') is distinct from 'tax_included';
