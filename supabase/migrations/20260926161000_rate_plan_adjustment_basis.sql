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
    case when d.code='BB' then 'per_room'
         when s.saved->>'adjustment_basis' in('per_room','per_person') then s.saved->>'adjustment_basis'
         else d.default_basis end adjustment_basis,
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
  'version',2,
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
  v_basis text;
  v_units numeric;
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
      v_basis:=case when v_plan->>'adjustment_basis'='per_room' then 'per_room' else 'per_person' end;
      v_units:=case when v_basis='per_room' then 1 else greatest(1,coalesce(p_guests,1)) end;
      v_adjustment_configured:=coalesce((v_plan->>'adjustment_per_person')::numeric,0);
      v_adjustment_net:=case when v_mode='tax_included' then v_adjustment_configured/v_factor else v_adjustment_configured end;
      v_adjustment_final:=v_adjustment_net*v_factor;
      v_plan_net_total:=greatest(0,v_base_net_total+v_adjustment_net*v_units*v_nights);
      v_plan_final_total:=round(v_plan_net_total*v_factor,2);

      v_room_plans:=v_room_plans||jsonb_build_array(jsonb_build_object(
        'code',v_plan->>'code',
        'name',v_plan->>'name',
        'meal_plan',v_plan->>'meal_plan',
        'regimen',v_plan->>'legacy_regimen',
        'description',v_plan->>'description',
        'adjustment_basis',v_basis,
        'adjustment_value',v_adjustment_configured,
        'adjustment_per_person',case when v_basis='per_person' then v_adjustment_configured else 0 end,
        'adjustment_net_per_unit',round(v_adjustment_net,6),
        'adjustment_final_per_unit',round(v_adjustment_final,2),
        'adjustment_net_per_person',case when v_basis='per_person' then round(v_adjustment_net,6) else 0 end,
        'adjustment_final_per_person',case when v_basis='per_person' then round(v_adjustment_final,2) else 0 end,
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
  v_basis text:='per_person';
  v_units numeric:=1;
  v_adjustment_configured numeric:=0;
  v_adjustment_net numeric:=0;
  v_requested_delta numeric:=0;
  v_actual_delta numeric:=0;
  v_booked_night numeric:=0;
  v_final_night numeric:=0;
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
        'adjustment_basis',coalesce(v_detail->>'rate_plan_adjustment_basis',v_detail->'rate_plan_snapshot'->>'adjustment_basis','per_person'),
        'adjustment_value',coalesce((v_detail->>'rate_plan_adjustment_configured_value')::numeric,(v_detail->>'rate_plan_adjustment_configured_per_person')::numeric,0)
      ) end
    );
  end if;

  if v_voucher then return v_base; end if;

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
  v_basis:=case when v_plan->>'adjustment_basis'='per_room' then 'per_room' else 'per_person' end;
  v_units:=case when v_basis='per_room' then 1 else v_guests end;
  v_adjustment_configured:=coalesce((v_plan->>'adjustment_per_person')::numeric,0);
  v_adjustment_net:=case when v_mode='tax_included' then v_adjustment_configured/v_factor else v_adjustment_configured end;
  v_requested_delta:=v_adjustment_net*v_units*v_nights;
  v_next_subtotal:=greatest(0,round(coalesce(r.subtotal,0)+v_requested_delta,2));
  v_actual_delta:=v_next_subtotal-coalesce(r.subtotal,0);
  v_booked_night:=case when v_nights>0 then v_actual_delta/v_nights else v_adjustment_net*v_units end;
  v_final_night:=v_booked_night*v_factor;
  v_booked_pp:=case when v_basis='per_person' and v_guests>0 then v_booked_night/v_guests else 0 end;
  v_final_pp:=case when v_basis='per_person' and v_guests>0 then v_final_night/v_guests else 0 end;
  v_tax:=case when coalesce(r.impuestos_desglosados,false) then round(v_next_subtotal*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  v_total:=round(v_next_subtotal+v_tax,2);

  select coalesce(jsonb_agg(
    case when ord=1 then d||jsonb_build_object(
      'tarifa_base_noche',greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,r.tarifa_noche,0)),
      'tarifa_noche',greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,r.tarifa_noche,0)+v_booked_night),
      'rate_plan_code',v_plan->>'code',
      'rate_plan_name',v_plan->>'name',
      'rate_plan_meal',v_plan->>'meal_plan',
      'rate_plan_regimen',v_plan->>'legacy_regimen',
      'rate_plan_adjustment_currency',r.moneda,
      'rate_plan_adjustment_basis',v_basis,
      'rate_plan_adjustment_configured_value',v_adjustment_configured,
      'rate_plan_adjustment_booked_per_night',v_booked_night,
      'rate_plan_adjustment_final_per_night',v_final_night,
      'rate_plan_adjustment_configured_per_person',case when v_basis='per_person' then v_adjustment_configured else 0 end,
      'rate_plan_adjustment_booked_per_person',v_booked_pp,
      'rate_plan_adjustment_final_per_person',v_final_pp,
      'rate_plan_booked_guests',v_guests,
      'rate_plan_snapshot',jsonb_build_object(
        'code',v_plan->>'code','name',v_plan->>'name','meal_plan',v_plan->>'meal_plan',
        'description',v_plan->>'description','adjustment_basis',v_basis,'adjustment_value',v_adjustment_configured,
        'adjustment_per_person',case when v_basis='per_person' then v_adjustment_configured else 0 end,
        'booked_guests',v_guests,'captured_at',now()
      ),
      'rate_plan_snapshot_at',now()
    ) else d end order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(d,ord);

  update public.reservas
  set habitaciones_detalle=v_details,
      tarifa_noche=greatest(0,coalesce(r.tarifa_noche,0)+v_booked_night),
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
    'subtotal',r.subtotal,'tax_amount',r.iva_importe,'total',r.precio_total,
    'rate_plan',jsonb_build_object(
      'code',v_plan->>'code','name',v_plan->>'name','meal_plan',v_plan->>'meal_plan',
      'regimen',v_plan->>'legacy_regimen','description',v_plan->>'description',
      'adjustment_basis',v_basis,'adjustment_value',v_adjustment_configured,
      'adjustment_final_per_unit',round(case when v_units>0 then v_final_night/v_units else 0 end,2),
      'adjustment_final_per_person',round(v_final_pp,2)
    )
  );
end;
$$;

create or replace function public.hl_add_room_to_reservation_with_plan_atomic(
  p_reservation_id bigint,
  p_room jsonb
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  r public.reservas%rowtype;
  v_room_id bigint;
  v_guests integer;
  v_nights integer;
  v_basis text;
  v_configured_value numeric;
  v_booked_night numeric;
  v_final_night numeric;
  v_base_rate numeric;
  v_new_rate numeric;
  v_delta numeric;
  v_details jsonb;
  v_plan_count integer;
  v_detail_count integer;
  v_regimen text;
  v_next_net numeric;
  v_vat numeric;
begin
  r:=public.hl_add_room_to_reservation_atomic(p_reservation_id,p_room);
  v_room_id:=nullif(p_room->>'roomId','')::bigint;
  if coalesce(nullif(p_room->>'ratePlanCode',''),'')='' then return r; end if;

  v_guests:=greatest(1,coalesce(nullif(p_room->>'guests','')::integer,1));
  v_nights:=greatest(1,coalesce(nullif(p_room->>'end','')::date-nullif(p_room->>'start','')::date,1));
  v_basis:=case when p_room->>'ratePlanAdjustmentBasis'='per_room' then 'per_room' else 'per_person' end;
  v_configured_value:=coalesce(nullif(p_room->>'ratePlanAdjustmentConfiguredValue','')::numeric,nullif(p_room->>'ratePlanAdjustmentConfiguredPerPerson','')::numeric,0);
  v_booked_night:=coalesce(nullif(p_room->>'ratePlanAdjustmentBookedPerNight','')::numeric,(coalesce(nullif(p_room->>'ratePlanAdjustmentBookedPerPerson','')::numeric,0)*v_guests));
  v_final_night:=coalesce(nullif(p_room->>'ratePlanAdjustmentFinalPerNight','')::numeric,(coalesce(nullif(p_room->>'ratePlanAdjustmentFinalPerPerson','')::numeric,0)*v_guests));

  select coalesce(nullif(e->>'tarifa_noche','')::numeric,0)
    into v_base_rate
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=v_room_id
  order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end
  limit 1;

  v_new_rate:=greatest(0,coalesce(v_base_rate,0)+v_booked_night);
  v_delta:=round((v_new_rate-coalesce(v_base_rate,0))*v_nights,2);

  select coalesce(jsonb_agg(
    case when coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=v_room_id
      then e||jsonb_build_object(
        'tarifa_base_noche',coalesce(v_base_rate,0),'tarifa_noche',v_new_rate,
        'rate_plan_code',p_room->>'ratePlanCode','rate_plan_name',p_room->>'ratePlanName',
        'rate_plan_meal',p_room->>'ratePlanMeal','rate_plan_regimen',p_room->>'ratePlanRegimen',
        'rate_plan_adjustment_currency',p_room->>'ratePlanCurrency',
        'rate_plan_adjustment_basis',v_basis,
        'rate_plan_adjustment_configured_value',v_configured_value,
        'rate_plan_adjustment_booked_per_night',v_new_rate-coalesce(v_base_rate,0),
        'rate_plan_adjustment_final_per_night',v_final_night,
        'rate_plan_adjustment_configured_per_person',case when v_basis='per_person' then v_configured_value else 0 end,
        'rate_plan_adjustment_booked_per_person',case when v_basis='per_person' and v_guests>0 then (v_new_rate-coalesce(v_base_rate,0))/v_guests else 0 end,
        'rate_plan_adjustment_final_per_person',case when v_basis='per_person' and v_guests>0 then v_final_night/v_guests else 0 end,
        'rate_plan_booked_guests',v_guests,
        'rate_plan_snapshot',jsonb_build_object(
          'code',p_room->>'ratePlanCode','name',p_room->>'ratePlanName','meal_plan',p_room->>'ratePlanMeal',
          'adjustment_basis',v_basis,'adjustment_value',v_configured_value,
          'adjustment_per_person',case when v_basis='per_person' then v_configured_value else 0 end,
          'booked_guests',v_guests,'captured_at',now()
        ),
        'rate_plan_snapshot_at',now()
      ) else e end order by ord
  ),'[]'::jsonb)
  into v_details
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(e,ord);

  select count(*),count(*) filter(where coalesce(e->>'rate_plan_code','')<>'')
    into v_detail_count,v_plan_count
  from jsonb_array_elements(v_details) e
  where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');

  if v_detail_count>0 and v_plan_count=v_detail_count then
    select case when count(distinct e->>'rate_plan_regimen')=1 then max(e->>'rate_plan_regimen') else 'Mixto' end
      into v_regimen
    from jsonb_array_elements(v_details) e
    where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room');
  else v_regimen:=r.regimen; end if;

  v_next_net:=greatest(0,round(coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,r.precio_total,0)+v_delta,2));
  v_vat:=case when coalesce(r.impuestos_desglosados,false) then round(v_next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;

  update public.reservas set
    habitaciones_detalle=v_details,
    tarifa_noche=greatest(0,coalesce(r.tarifa_noche,0)+(v_new_rate-coalesce(v_base_rate,0))),
    subtotal=greatest(0,round(coalesce(r.subtotal,0)+v_delta,2)),
    precio_sin_impuestos_nacionales=v_next_net,iva_importe=v_vat,precio_total=round(v_next_net+v_vat,2),
    precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round((v_next_net+v_vat)/tipo_cambio,2) else precio_total_usd end,
    regimen=v_regimen
  where id=r.id returning * into r;

  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

create or replace function public.hl_extend_group_rooms_with_plan_atomic(
  p_reserva_id bigint,p_room_ids bigint[],p_new_end date
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype; r public.reservas%rowtype; rid bigint;
  before_detail jsonb; after_detail jsonb; details jsonb; old_end date; start_date date;
  guests integer; booked_night numeric; extra_nights integer; total_nights integer;
  base_extension numeric; raw_delta numeric; delta numeric; total_delta numeric:=0; new_rate numeric;
  next_net numeric; next_vat numeric; total_rate numeric;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  r:=public.hl_extend_group_rooms_atomic(p_reserva_id,p_room_ids,p_new_end);
  details:=coalesce(r.habitaciones_detalle,'[]'::jsonb);

  foreach rid in array coalesce(p_room_ids,array[]::bigint[]) loop
    select e into before_detail from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end limit 1;

    guests:=greatest(0,coalesce(nullif(before_detail->>'huespedes','')::integer,0));
    booked_night:=coalesce(nullif(before_detail->>'rate_plan_adjustment_booked_per_night','')::numeric,coalesce(nullif(before_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0)*guests);
    if booked_night=0 then continue; end if;
    old_end:=coalesce(nullif(before_detail->>'fecha_salida','')::date,before_row.fecha_salida);
    start_date:=coalesce(nullif(before_detail->>'fecha_entrada','')::date,before_row.fecha_entrada);
    extra_nights:=greatest(0,p_new_end-old_end); total_nights:=greatest(1,p_new_end-start_date);
    if extra_nights=0 then continue; end if;

    select e into after_detail from jsonb_array_elements(details) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end limit 1;

    base_extension:=greatest(0,coalesce(nullif(after_detail->>'extension_net_total','')::numeric,0));
    raw_delta:=booked_night*extra_nights; delta:=greatest(-base_extension,raw_delta);
    new_rate:=greatest(0,coalesce(nullif(after_detail->>'tarifa_noche','')::numeric,0)+delta/total_nights);

    select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
      then e||jsonb_build_object('tarifa_noche',new_rate,'extension_net_total',round(base_extension+delta,2),'rate_plan_extension_net_total',round(delta,2))
      else e end order by ord),'[]'::jsonb)
    into details from jsonb_array_elements(details) with ordinality x(e,ord);
    total_delta:=total_delta+delta;
  end loop;

  if abs(total_delta)<0.000001 then return r; end if;
  select coalesce(sum(greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0))),0) into total_rate
  from jsonb_array_elements(details) e
  where lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    and not (coalesce(r.room_checkout_dates,'{}'::jsonb) ? coalesce(e->>'habitacion_id',''));

  next_net:=greatest(0,round(coalesce(r.precio_sin_impuestos_nacionales,r.subtotal,r.precio_total,0)+total_delta,2));
  next_vat:=case when coalesce(r.impuestos_desglosados,false) then round(next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  update public.reservas set habitaciones_detalle=details,tarifa_noche=total_rate,
    subtotal=greatest(0,round(coalesce(r.subtotal,0)+total_delta,2)),precio_sin_impuestos_nacionales=next_net,
    iva_importe=next_vat,precio_total=round(next_net+next_vat,2),
    precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round((next_net+next_vat)/tipo_cambio,2) else precio_total_usd end
  where id=r.id returning * into r;
  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

create or replace function public.hl_planning_move_reservation_with_plan_atomic(
  p_reserva_id bigint,p_habitacion_id bigint,p_fecha_entrada date,p_fecha_salida date default null,p_reprice boolean default false
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype; r public.reservas%rowtype; source_detail jsonb;
  plan_code text; guests integer:=0; booked_night numeric:=0; units integer:=1;
  base_rate numeric:=0; new_rate numeric:=0; plan_delta numeric:=0; next_subtotal numeric:=0;
  next_discount numeric:=0; next_net numeric:=0; next_vat numeric:=0; next_total numeric:=0;
  details jsonb; should_reprice boolean:=false;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  select e into source_detail from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=before_row.habitacion_id
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
  order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end limit 1;

  plan_code:=nullif(source_detail->>'rate_plan_code','');
  guests:=greatest(0,coalesce(nullif(source_detail->>'huespedes','')::integer,before_row.cantidad_huespedes,0));
  booked_night:=coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_night','')::numeric,coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0)*guests);
  should_reprice:=coalesce(p_reprice,false) or p_fecha_entrada is distinct from before_row.fecha_entrada or p_fecha_salida is distinct from before_row.fecha_salida;
  r:=public.hl_planning_move_reservation_priced_atomic(p_reserva_id,p_habitacion_id,p_fecha_entrada,p_fecha_salida,p_reprice);
  if plan_code is null or not should_reprice then return r; end if;

  units:=case when coalesce(r.tipo_estadia,'overnight')='day_use' then 1 else greatest(1,coalesce(r.noches,p_fecha_salida-p_fecha_entrada,1)) end;
  base_rate:=greatest(0,coalesce(r.tarifa_noche,0)); new_rate:=greatest(0,base_rate+booked_night);
  plan_delta:=round((new_rate-base_rate)*units,2); next_subtotal:=greatest(0,round(coalesce(r.subtotal,0)+plan_delta,2));
  if lower(coalesce(r.descuento_tipo,'')) in('percent','porcentaje','percentage') then
    next_discount:=round(next_subtotal*least(100,greatest(0,coalesce(r.descuento_valor,0)))/100,2);
  elsif lower(coalesce(r.descuento_tipo,'')) in('amount','importe','fixed','fijo') then
    next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_valor,r.descuento_importe,0)));
  else next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_importe,0))); end if;
  next_net:=round(greatest(0,next_subtotal-next_discount),2);
  next_vat:=case when coalesce(r.impuestos_desglosados,false) then round(next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  next_total:=round(next_net+next_vat,2);

  select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=p_habitacion_id
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    then e||jsonb_build_object('tarifa_base_noche',base_rate,'tarifa_noche',new_rate,'rate_plan_adjustment_booked_per_night',new_rate-base_rate)
    else e end order by ord),'[]'::jsonb)
  into details from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(e,ord);

  update public.reservas set habitaciones_detalle=details,tarifa_noche=new_rate,subtotal=next_subtotal,
    descuento_importe=next_discount,precio_sin_impuestos_nacionales=next_net,iva_importe=next_vat,precio_total=next_total,
    precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(next_total/tipo_cambio,2) else precio_total_usd end
  where id=r.id returning * into r;
  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

create or replace function public.hl_change_group_reservation_room_with_plan_atomic(
  p_reserva_id bigint,p_from_room_id bigint,p_to_room_id bigint,p_reprice boolean default false
) returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  before_row public.reservas%rowtype; r public.reservas%rowtype; source_detail jsonb;
  guests integer:=0; booked_night numeric:=0; plan_total numeric:=0; start_date date; end_date date;
  nights integer:=1; details jsonb; next_subtotal numeric:=0; next_discount numeric:=0; next_net numeric:=0;
  next_vat numeric:=0; next_total numeric:=0;
begin
  select * into before_row from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  select e into source_detail from jsonb_array_elements(coalesce(before_row.habitaciones_detalle,'[]'::jsonb)) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=p_from_room_id
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
  order by case when lower(coalesce(e->>'segment_role','active_room'))='active_room' then 0 else 1 end limit 1;

  r:=public.hl_change_group_reservation_room_atomic(p_reserva_id,p_from_room_id,p_to_room_id,p_reprice);
  if not coalesce(p_reprice,false) or coalesce(source_detail->>'rate_plan_code','')='' then return r; end if;
  guests:=greatest(0,coalesce(nullif(source_detail->>'rate_plan_booked_guests','')::integer,nullif(source_detail->>'huespedes','')::integer,0));
  booked_night:=coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_night','')::numeric,coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0)*guests);
  if abs(booked_night)<0.000001 then return r; end if;
  start_date:=coalesce(nullif(source_detail->>'fecha_entrada','')::date,before_row.fecha_entrada);
  end_date:=coalesce(nullif(source_detail->>'fecha_salida','')::date,before_row.fecha_salida);
  nights:=greatest(1,end_date-start_date); plan_total:=round(booked_night*nights,2);

  select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=p_to_room_id
    and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    then e||jsonb_build_object(
      'tarifa_base_noche',greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0)),
      'tarifa_noche',greatest(0,coalesce(nullif(e->>'tarifa_noche','')::numeric,0)+booked_night),
      'rate_plan_code',source_detail->>'rate_plan_code','rate_plan_name',source_detail->>'rate_plan_name',
      'rate_plan_meal',source_detail->>'rate_plan_meal','rate_plan_regimen',source_detail->>'rate_plan_regimen',
      'rate_plan_adjustment_currency',source_detail->>'rate_plan_adjustment_currency',
      'rate_plan_adjustment_basis',coalesce(source_detail->>'rate_plan_adjustment_basis',source_detail->'rate_plan_snapshot'->>'adjustment_basis','per_person'),
      'rate_plan_adjustment_configured_value',coalesce(nullif(source_detail->>'rate_plan_adjustment_configured_value','')::numeric,nullif(source_detail->>'rate_plan_adjustment_configured_per_person','')::numeric,0),
      'rate_plan_adjustment_booked_per_night',booked_night,
      'rate_plan_adjustment_final_per_night',coalesce(nullif(source_detail->>'rate_plan_adjustment_final_per_night','')::numeric,0),
      'rate_plan_adjustment_configured_per_person',coalesce(nullif(source_detail->>'rate_plan_adjustment_configured_per_person','')::numeric,0),
      'rate_plan_adjustment_booked_per_person',coalesce(nullif(source_detail->>'rate_plan_adjustment_booked_per_person','')::numeric,0),
      'rate_plan_adjustment_final_per_person',coalesce(nullif(source_detail->>'rate_plan_adjustment_final_per_person','')::numeric,0),
      'rate_plan_booked_guests',guests,'rate_plan_snapshot',coalesce(source_detail->'rate_plan_snapshot','{}'::jsonb)
    ) else e end order by ord),'[]'::jsonb)
  into details from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality x(e,ord);

  next_subtotal:=greatest(0,round(coalesce(r.subtotal,0)+plan_total,2));
  if lower(coalesce(r.descuento_tipo,'')) in('percent','porcentaje','percentage') then
    next_discount:=round(next_subtotal*least(100,greatest(0,coalesce(r.descuento_valor,0)))/100,2);
  elsif lower(coalesce(r.descuento_tipo,'')) in('amount','importe','fixed','fijo','monto') then
    next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_valor,r.descuento_importe,0)));
  else next_discount:=least(next_subtotal,greatest(0,coalesce(r.descuento_importe,0))); end if;
  next_net:=round(greatest(0,next_subtotal-next_discount),2);
  next_vat:=case when coalesce(r.impuestos_desglosados,false) then round(next_net*greatest(0,coalesce(r.iva_porcentaje,0))/100,2) else 0 end;
  next_total:=round(next_net+next_vat,2);

  update public.reservas set habitaciones_detalle=details,tarifa_noche=greatest(0,coalesce(r.tarifa_noche,0)+booked_night),
    subtotal=next_subtotal,descuento_importe=next_discount,precio_sin_impuestos_nacionales=next_net,
    iva_importe=next_vat,precio_total=next_total,
    precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(next_total/tipo_cambio,2) else precio_total_usd end
  where id=r.id returning * into r;
  perform private.hl_sync_reservation_folios_internal(r.id);
  perform private.hl_rebuild_item_payment_allocations_from_folios(r.id);
  return r;
end;
$$;

grant execute on function public.hl_public_booking_availability_with_plans(text,date,date,integer) to anon,authenticated;
grant execute on function public.hl_public_booking_create_with_plan(text,jsonb) to anon,authenticated;
grant execute on function public.hl_add_room_to_reservation_with_plan_atomic(bigint,jsonb) to authenticated;
grant execute on function public.hl_extend_group_rooms_with_plan_atomic(bigint,bigint[],date) to authenticated;
grant execute on function public.hl_planning_move_reservation_with_plan_atomic(bigint,bigint,date,date,boolean) to authenticated;
grant execute on function public.hl_change_group_reservation_room_with_plan_atomic(bigint,bigint,bigint,boolean) to authenticated;

commit;
