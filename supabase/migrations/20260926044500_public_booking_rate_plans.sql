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
defaults(code,name,meal_plan,legacy_regimen,description,ord) as (
  values
    ('BB','Alojamiento + desayuno','breakfast','Desayuno incluido','Alojamiento con desayuno incluido en la tarifa.',1),
    ('RO','Solo alojamiento','room_only','Solo alojamiento','Alojamiento sin comidas incluidas.',2),
    ('HB','Media pensión','half_board','Media pensión','Alojamiento con desayuno y una comida principal.',3),
    ('FB','Pensión completa','full_board','Pensión completa','Alojamiento con desayuno, almuerzo y cena.',4),
    ('AI','Todo incluido','all_inclusive','Todo incluido','Alojamiento con el régimen todo incluido.',5)
),
normalized as (
  select d.*,
    s.saved,
    case when d.code='BB' then true else coalesce((s.saved->>'active')::boolean,false) end active,
    case when d.code='BB' then true else coalesce((s.saved->>'public')::boolean,(s.saved->>'active')::boolean,false) end public_visible,
    case when d.code='BB' then 0::numeric
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
  'version',1,
  'default_code','BB',
  'plans',coalesce(jsonb_agg(jsonb_build_object(
    'code',code,
    'name',name,
    'meal_plan',meal_plan,
    'legacy_regimen',legacy_regimen,
    'description',saved_description,
    'active',active,
    'public',public_visible,
    'adjustment_per_person',adjustment
  ) order by ord),'[]'::jsonb)
)
from normalized;
$$;

create or replace function public.hl_public_booking_config_with_plans(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_base jsonb;
  v_property uuid;
  v_plans jsonb;
begin
  v_base:=public.hl_public_booking_config(p_slug);
  v_property:=nullif(v_base->>'property_id','')::uuid;
  select coalesce(jsonb_agg(p order by case p->>'code' when 'BB' then 1 when 'RO' then 2 when 'HB' then 3 when 'FB' then 4 else 5 end),'[]'::jsonb)
    into v_plans
  from jsonb_array_elements(private.hl_property_rate_plans(v_property)->'plans') p
  where coalesce((p->>'active')::boolean,false)=true
    and coalesce((p->>'public')::boolean,false)=true;
  return v_base||jsonb_build_object('rate_plans',v_plans,'default_rate_plan_code','BB');
end;
$$;

create or replace function public.hl_public_booking_availability_with_plans(
  p_slug text,
  p_check_in date,
  p_check_out date,
  p_guests integer default 1
) returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_base jsonb;
  v_config jsonb;
  v_property uuid;
  v_factor numeric:=1;
  v_mode text:='tax_included';
  v_nights integer:=1;
  v_room jsonb;
  v_plan jsonb;
  v_rooms jsonb:='[]'::jsonb;
  v_room_plans jsonb;
  v_public_plans jsonb:='[]'::jsonb;
  v_base_net_total numeric;
  v_base_final_total numeric;
  v_adjustment_configured numeric;
  v_adjustment_net numeric;
  v_adjustment_final numeric;
  v_plan_net_total numeric;
  v_plan_final_total numeric;
begin
  v_base:=public.hl_public_booking_availability(p_slug,p_check_in,p_check_out,p_guests);
  v_config:=public.hl_public_booking_config(p_slug);
  v_property:=nullif(v_config->>'property_id','')::uuid;
  v_factor:=greatest(0.000001,coalesce((v_base->'pricing'->>'final_multiplier')::numeric,1));
  v_mode:=coalesce(v_base->'pricing'->>'price_tax_mode','tax_included');
  v_nights:=greatest(1,coalesce((v_base->>'nights')::integer,p_check_out-p_check_in,1));

  select coalesce(jsonb_agg(p order by case p->>'code' when 'BB' then 1 when 'RO' then 2 when 'HB' then 3 when 'FB' then 4 else 5 end),'[]'::jsonb)
    into v_public_plans
  from jsonb_array_elements(private.hl_property_rate_plans(v_property)->'plans') p
  where coalesce((p->>'active')::boolean,false)=true
    and coalesce((p->>'public')::boolean,false)=true;

  for v_room in select value from jsonb_array_elements(coalesce(v_base->'rooms','[]'::jsonb))
  loop
    v_room_plans:='[]'::jsonb;
    v_base_net_total:=greatest(0,coalesce((v_room->>'net_total')::numeric,0));
    v_base_final_total:=greatest(0,coalesce((v_room->>'total')::numeric,0));

    for v_plan in select value from jsonb_array_elements(v_public_plans)
    loop
      v_adjustment_configured:=coalesce((v_plan->>'adjustment_per_person')::numeric,0);
      v_adjustment_net:=case when v_mode='tax_included' then v_adjustment_configured/v_factor else v_adjustment_configured end;
      v_adjustment_final:=v_adjustment_net*v_factor;
      v_plan_net_total:=greatest(0,v_base_net_total+v_adjustment_net*greatest(1,coalesce(p_guests,1))*v_nights);
      v_plan_final_total:=round(v_plan_net_total*v_factor,2);

      v_room_plans:=v_room_plans||jsonb_build_array(jsonb_build_object(
        'code',v_plan->>'code',
        'name',v_plan->>'name',
        'meal_plan',v_plan->>'meal_plan',
        'regimen',v_plan->>'legacy_regimen',
        'description',v_plan->>'description',
        'adjustment_per_person',v_adjustment_configured,
        'adjustment_net_per_person',round(v_adjustment_net,6),
        'adjustment_final_per_person',round(v_adjustment_final,2),
        'base_total',round(v_base_final_total,2),
        'net_price',round(v_plan_net_total/v_nights,2),
        'price',round(v_plan_final_total/v_nights,2),
        'net_total',round(v_plan_net_total,2),
        'total',v_plan_final_total,
        'tax_amount',round(v_plan_final_total-v_plan_net_total,2)
      ));
    end loop;

    v_rooms:=v_rooms||jsonb_build_array(v_room||jsonb_build_object('plans',v_room_plans));
  end loop;

  return v_base||jsonb_build_object('rooms',v_rooms,'rate_plans',v_public_plans,'default_rate_plan_code','BB');
end;
$$;

create or replace function public.hl_public_booking_create_with_plan(p_slug text,p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_config jsonb;
  v_property uuid;
  v_plans jsonb;
  v_plan jsonb;
  v_plan_code text;
  v_base jsonb;
  r public.reservas%rowtype;
  v_detail jsonb;
  v_contract jsonb;
  v_factor numeric:=1;
  v_mode text:='tax_included';
  v_guests integer:=1;
  v_nights integer:=1;
  v_adjustment_configured numeric:=0;
  v_adjustment_net numeric:=0;
  v_adjustment_final numeric:=0;
  v_requested_delta numeric:=0;
  v_actual_delta numeric:=0;
  v_booked_pp numeric:=0;
  v_final_pp numeric:=0;
  v_next_subtotal numeric:=0;
  v_tax numeric:=0;
  v_total numeric:=0;
  v_details jsonb;
  v_voucher boolean:=false;
begin
  v_config:=public.hl_public_booking_config(p_slug);
  v_property:=nullif(v_config->>'property_id','')::uuid;
  v_plans:=private.hl_property_rate_plans(v_property);
  v_voucher:=coalesce(nullif(trim(coalesce(p_payload->>'voucher_slug','')),''),'')<>'';
  v_plan_code:=case when v_voucher then 'BB' else upper(coalesce(nullif(trim(coalesce(p_payload->>'rate_plan_code','')),''),'BB')) end;

  v_base:=public.hl_public_booking_create(p_slug,p_payload);
  select * into r from public.reservas where id=(v_base->>'id')::bigint for update;
  if not found then return v_base; end if;

  v_detail:=coalesce(r.habitaciones_detalle->0,'{}'::jsonb);
  if coalesce((v_base->>'idempotent_replay')::boolean,false)=true then
    return v_base||jsonb_build_object(
      'subtotal',r.subtotal,'tax_amount',r.iva_importe,'total',r.precio_total,
      'rate_plan',case when coalesce(v_detail->>'rate_plan_code','')='' then null else jsonb_build_object(
        'code',v_detail->>'rate_plan_code','name',v_detail->>'rate_plan_name','meal_plan',v_detail->>'rate_plan_meal',
        'regimen',v_detail->>'rate_plan_regimen','description',v_detail->'rate_plan_snapshot'->>'description',
        'adjustment_per_person',coalesce((v_detail->>'rate_plan_adjustment_configured_per_person')::numeric,0)
      ) end
    );
  end if;

  if v_voucher then
    return v_base;
  end if;

  select p into v_plan
  from jsonb_array_elements(v_plans->'plans') p
  where upper(coalesce(p->>'code',''))=v_plan_code
    and coalesce((p->>'active')::boolean,false)=true
    and coalesce((p->>'public')::boolean,false)=true
  limit 1;
  if v_plan is null then raise exception 'Plan tarifario no disponible'; end if;

  v_contract:=private.hl_property_pricing_contract(v_property);
  v_factor:=greatest(0.000001,coalesce((v_contract->>'final_multiplier')::numeric,1));
  v_mode:=coalesce(v_contract->>'price_tax_mode','tax_included');
  v_guests:=greatest(1,coalesce(r.cantidad_huespedes,1));
  v_nights:=greatest(1,coalesce(r.noches,r.fecha_salida-r.fecha_entrada,1));
  v_adjustment_configured:=coalesce((v_plan->>'adjustment_per_person')::numeric,0);
  v_adjustment_net:=case when v_mode='tax_included' then v_adjustment_configured/v_factor else v_adjustment_configured end;
  v_adjustment_final:=v_adjustment_net*v_factor;
  v_requested_delta:=v_adjustment_net*v_guests*v_nights;
  v_next_subtotal:=greatest(0,round(coalesce(r.subtotal,0)+v_requested_delta,2));
  v_actual_delta:=v_next_subtotal-coalesce(r.subtotal,0);
  v_booked_pp:=case when v_guests*v_nights>0 then v_actual_delta/(v_guests*v_nights) else v_adjustment_net end;
  v_final_pp:=v_booked_pp*v_factor;
  v_tax:=case when coalesce(r.impuestos_desglosados,false) then round(v_next_subtotal*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  v_total:=round(v_next_subtotal+v_tax,2);

  select coalesce(jsonb_agg(
    case when ord=1 then d||jsonb_build_object(
      'tarifa_base_noche',greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,r.tarifa_noche,0)),
      'tarifa_noche',greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,r.tarifa_noche,0)+(v_actual_delta/v_nights)),
      'rate_plan_code',v_plan->>'code',
      'rate_plan_name',v_plan->>'name',
      'rate_plan_meal',v_plan->>'meal_plan',
      'rate_plan_regimen',v_plan->>'legacy_regimen',
      'rate_plan_adjustment_currency',r.moneda,
      'rate_plan_adjustment_configured_per_person',v_adjustment_configured,
      'rate_plan_adjustment_booked_per_person',v_booked_pp,
      'rate_plan_adjustment_final_per_person',v_final_pp,
      'rate_plan_booked_guests',v_guests,
      'rate_plan_snapshot',jsonb_build_object(
        'code',v_plan->>'code','name',v_plan->>'name','meal_plan',v_plan->>'meal_plan',
        'description',v_plan->>'description','adjustment_per_person',v_adjustment_configured,
        'booked_guests',v_guests,'captured_at',now()
      ),
      'rate_plan_snapshot_at',now()
    ) else d end order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(d,ord);

  update public.reservas
  set habitaciones_detalle=v_details,
      tarifa_noche=greatest(0,coalesce(r.tarifa_noche,0)+(v_actual_delta/v_nights)),
      subtotal=v_next_subtotal,
      precio_sin_impuestos_nacionales=v_next_subtotal,
      iva_importe=v_tax,
      precio_total=v_total,
      precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,
      regimen=v_plan->>'legacy_regimen'
  where id=r.id
  returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);

  return v_base||jsonb_build_object(
    'subtotal',r.subtotal,
    'tax_amount',r.iva_importe,
    'total',r.precio_total,
    'rate_plan',jsonb_build_object(
      'code',v_plan->>'code',
      'name',v_plan->>'name',
      'meal_plan',v_plan->>'meal_plan',
      'regimen',v_plan->>'legacy_regimen',
      'description',v_plan->>'description',
      'adjustment_per_person',v_adjustment_configured,
      'adjustment_final_per_person',round(v_final_pp,2)
    )
  );
end;
$$;

grant execute on function public.hl_public_booking_config_with_plans(text) to anon,authenticated;
grant execute on function public.hl_public_booking_availability_with_plans(text,date,date,integer) to anon,authenticated;
grant execute on function public.hl_public_booking_create_with_plan(text,jsonb) to anon,authenticated;

commit;
