alter table public.hotel_cancellation_policies
  add column if not exists visible_in_booking_engine boolean not null default true;

-- La tercera política base pasa a ser una excepción interna sin penalidades.
-- Las reservas ya creadas conservan su cancellation_policy_snapshot histórico.
update public.hotel_cancellation_policies
set
  code = 'FREE-INTERNAL',
  name = 'Cancelación libre / Excepción interna',
  description = 'Sin penalidad por cancelación, No Show ni checkout anticipado. Uso interno para propietarios, socios, gerencia, cortesías e invitados.',
  policy_type = 'custom',
  cancellation_rules = '[{"min_days_before":0,"charge_type":"none","value":0}]'::jsonb,
  no_show_rule = '{"charge_type":"none","value":0}'::jsonb,
  early_checkout_rule = '{"charge_type":"none","value":0}'::jsonb,
  prepayment_required = false,
  prepayment_percent = 0,
  active = true,
  is_default = false,
  visible_in_booking_engine = false,
  updated_at = now()
where code = 'PREP-FLEX'
  and not exists (
    select 1
    from public.hotel_cancellation_policies existing
    where existing.property_id = hotel_cancellation_policies.property_id
      and existing.code = 'FREE-INTERNAL'
  );

-- Si existiera una migración parcial previa, normalizamos igualmente los presets.
update public.hotel_cancellation_policies
set
  name = 'Cancelación libre / Excepción interna',
  description = 'Sin penalidad por cancelación, No Show ni checkout anticipado. Uso interno para propietarios, socios, gerencia, cortesías e invitados.',
  policy_type = 'custom',
  cancellation_rules = '[{"min_days_before":0,"charge_type":"none","value":0}]'::jsonb,
  no_show_rule = '{"charge_type":"none","value":0}'::jsonb,
  early_checkout_rule = '{"charge_type":"none","value":0}'::jsonb,
  prepayment_required = false,
  prepayment_percent = 0,
  active = true,
  is_default = false,
  visible_in_booking_engine = false,
  updated_at = now()
where code = 'FREE-INTERNAL';

update public.hotel_cancellation_policies
set visible_in_booking_engine = true
where code in ('FLEX','NR');

-- Una política sólo interna nunca puede quedar como predeterminada del motor.
create or replace function public.hl_guard_cancellation_policy_visibility()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.visible_in_booking_engine = false then
    new.is_default := false;
  end if;
  return new;
end;
$function$;

drop trigger if exists hotel_cancellation_policy_visibility_guard on public.hotel_cancellation_policies;
create trigger hotel_cancellation_policy_visibility_guard
before insert or update on public.hotel_cancellation_policies
for each row execute function public.hl_guard_cancellation_policy_visibility();

create index if not exists hotel_cancellation_policies_public_idx
  on public.hotel_cancellation_policies(property_id,is_default desc,name)
  where active=true and visible_in_booking_engine=true;

-- Presets para propiedades nuevas: Flexible, No Reembolsable y Excepción interna.
create or replace function public.hl_seed_cancellation_policies(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
begin
  insert into public.hotel_cancellation_policies(
    property_id,code,name,description,policy_type,language,currency,
    cancellation_rules,no_show_rule,early_checkout_rule,
    prepayment_required,prepayment_percent,active,is_default,visible_in_booking_engine
  )
  values
    (p_property_id,'FLEX','Flexible','Cancelación sin cargo hasta 3 días antes del check-in. Luego se cobra 1 noche.','flexible','es-AR','ARS',
      '[{"min_days_before":3,"charge_type":"none","value":0},{"min_days_before":0,"charge_type":"nights","value":1}]'::jsonb,
      '{"charge_type":"nights","value":1}'::jsonb,'{"charge_type":"nights","value":1}'::jsonb,false,0,true,true,true),
    (p_property_id,'NR','No Reembolsable / Anticipada','Tarifa anticipada no reembolsable. Requiere el pago del 100% y la cancelación o el No Show implican una penalidad del 100% del total. El descuento comercial se configura en la tarifa o promoción, no en esta política.','non_refundable','es-AR','ARS',
      '[{"min_days_before":0,"charge_type":"percent","value":100}]'::jsonb,
      '{"charge_type":"percent","value":100}'::jsonb,'{"charge_type":"percent","value":100}'::jsonb,true,100,true,false,true),
    (p_property_id,'FREE-INTERNAL','Cancelación libre / Excepción interna','Sin penalidad por cancelación, No Show ni checkout anticipado. Uso interno para propietarios, socios, gerencia, cortesías e invitados.','custom','es-AR','ARS',
      '[{"min_days_before":0,"charge_type":"none","value":0}]'::jsonb,
      '{"charge_type":"none","value":0}'::jsonb,'{"charge_type":"none","value":0}'::jsonb,false,0,true,false,false)
  on conflict(property_id,code) do nothing;
end;
$function$;

-- El motor público sólo recibe políticas marcadas como públicas.
create or replace function public.hl_public_booking_config(p_slug text)
returns jsonb language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare e public.hotel_booking_engines%rowtype; p public.properties%rowtype; v_default jsonb; v_policies jsonb;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  select * into p from public.properties where id=e.property_id;
  select to_jsonb(cp) into v_default
    from public.hotel_cancellation_policies cp
    where cp.property_id=e.property_id and cp.active=true and cp.visible_in_booking_engine=true
    order by cp.is_default desc,cp.created_at asc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id',cp.id,'code',cp.code,'name',cp.name,'description',cp.description,'policy_type',cp.policy_type,
      'cancellation_rules',cp.cancellation_rules,'no_show_rule',cp.no_show_rule,'early_checkout_rule',cp.early_checkout_rule,
      'prepayment_required',cp.prepayment_required,'prepayment_percent',cp.prepayment_percent,'is_default',cp.is_default
    ) order by cp.is_default desc,cp.name),'[]'::jsonb)
    into v_policies
    from public.hotel_cancellation_policies cp
    where cp.property_id=e.property_id and cp.active=true and cp.visible_in_booking_engine=true;
  return jsonb_build_object(
    'slug',e.slug,'property_id',e.property_id,'name',coalesce(nullif(e.display_name,''),p.name),'city',p.city,'description',p.description,
    'currency',e.currency,'primary_color',e.primary_color,'accent_color',e.accent_color,'logo_url',e.logo_url,'hero_url',e.hero_url,
    'booking_message',e.booking_message,'confirmation_message',e.confirmation_message,'contact_phone',e.contact_phone,'contact_email',e.contact_email,
    'min_advance_days',e.min_advance_days,'max_advance_days',e.max_advance_days,'min_nights',e.min_nights,'template',e.template,
    'cancellation_policy',coalesce(v_default->>'description',e.cancellation_policy),'default_cancellation_policy',v_default,'cancellation_policies',v_policies,
    'terms_url',e.terms_url,'privacy_url',e.privacy_url,'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,
    'room_type_rules',e.room_type_rules,'gallery',e.gallery,'seo_title',e.seo_title,'seo_description',e.seo_description,
    'allow_self_cancel',e.allow_self_cancel,'self_cancel_cutoff_hours',e.self_cancel_cutoff_hours,'withdrawal_button_enabled',true
  );
end;$function$;

revoke all on function public.hl_public_booking_config(text) from public;
grant execute on function public.hl_public_booking_config(text) to anon,authenticated;
