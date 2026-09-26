begin;

create or replace function private.hl_property_rate_plans(p_property_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public','private','pg_temp'
as $$
with cfg as (
  select coalesce(settings->'rate_plans','{}'::jsonb) value
  from public.property_settings
  where property_id=p_property_id
),
defaults(code,name,meal_plan,legacy_regimen,description,default_basis,ord) as (
  values
    ('BB','Alojamiento + desayuno','breakfast','Desayuno incluido','Alojamiento con desayuno incluido en la tarifa.','per_room',1),
    ('RO','Solo alojamiento','room_only','Solo alojamiento','Alojamiento sin comidas incluidas.','per_room',2),
    ('HB','Media pensión','half_board','Media pensión','Alojamiento con desayuno y una comida principal.','per_person',3),
    ('FB','Pensión completa','full_board','Pensión completa','Alojamiento con desayuno, almuerzo y cena.','per_person',4),
    ('AI','Todo incluido','all_inclusive','Todo incluido','Alojamiento con el régimen todo incluido.','per_person',5)
),
normalized as (
  select d.*,
    s.saved,
    case when d.code='BB' then true else coalesce((s.saved->>'active')::boolean,false) end active,
    case when d.code='BB' then true else coalesce((s.saved->>'public')::boolean,(s.saved->>'active')::boolean,false) end public_visible,
    case when d.code in('BB','RO') then 'per_room'
         when s.saved->>'adjustment_basis' in('per_room','per_person') then s.saved->>'adjustment_basis'
         else d.default_basis end adjustment_basis,
    case when d.code='BB' then 0::numeric
         when d.code='RO' and coalesce(s.saved->>'adjustment_per_person','') ~ '^-?[0-9]+([.][0-9]+)?$' then -abs((s.saved->>'adjustment_per_person')::numeric)
         when coalesce(s.saved->>'adjustment_per_person','') ~ '^-?[0-9]+([.][0-9]+)?$' then (s.saved->>'adjustment_per_person')::numeric
         else 0::numeric end adjustment,
    coalesce(nullif(s.saved->>'description',''),d.description) saved_description
  from defaults d
  left join lateral (
    select value saved
    from jsonb_array_elements(coalesce((select value->'plans' from cfg),'[]'::jsonb))
    where upper(coalesce(value->>'code',''))=d.code
    limit 1
  ) s on true
)
select jsonb_build_object(
  'version',3,
  'default_code','BB',
  'plans',coalesce(jsonb_agg(jsonb_build_object(
    'code',code,
    'name',name,
    'meal_plan',meal_plan,
    'legacy_regimen',legacy_regimen,
    'description',saved_description,
    'active',active,
    'public',public_visible,
    'adjustment_basis',adjustment_basis,
    'adjustment_per_person',adjustment
  ) order by ord),'[]'::jsonb)
)
from normalized;
$$;

commit;
