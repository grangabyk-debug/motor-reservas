create or replace function public.hl_public_booking_config(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path to 'public','pg_temp'
as $function$
declare
  e public.hotel_booking_engines%rowtype;
  p public.properties%rowtype;
  w public.hotel_websites%rowtype;
  v_default jsonb;
  v_policies jsonb;
  v_vouchers jsonb;
  v_room_types jsonb;
begin
  select * into e from public.hotel_booking_engines where slug=lower(trim(p_slug)) and enabled=true;
  if not found then raise exception 'Motor no disponible'; end if;
  select * into p from public.properties where id=e.property_id;
  select * into w from public.hotel_websites where property_id=e.property_id;
  select to_jsonb(cp) into v_default from public.hotel_cancellation_policies cp where cp.property_id=e.property_id and cp.active=true and cp.visible_in_booking_engine=true order by cp.is_default desc,cp.created_at asc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',cp.id,'code',cp.code,'name',cp.name,'description',cp.description,'policy_type',cp.policy_type,'cancellation_rules',cp.cancellation_rules,'no_show_rule',cp.no_show_rule,'early_checkout_rule',cp.early_checkout_rule,'prepayment_required',cp.prepayment_required,'prepayment_percent',cp.prepayment_percent,'is_default',cp.is_default) order by cp.is_default desc,cp.name),'[]'::jsonb) into v_policies from public.hotel_cancellation_policies cp where cp.property_id=e.property_id and cp.active=true and cp.visible_in_booking_engine=true;
  select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'slug',v.slug,'language',v.language,'description',v.description,'image_url',v.image_url,'commercial_conditions',v.commercial_conditions,'price_mode',v.price_mode,'price',v.price,'currency',v.currency,'tax_included',v.tax_included,'tax_percent',v.tax_percent,'date_mode',v.date_mode,'stay_type',v.stay_type,'nights',v.nights,'room_type',v.room_type,'inventory_mode',v.inventory_mode,'inventory_quantity',v.inventory_quantity,'validity_mode',v.validity_mode,'valid_from',v.valid_from,'valid_to',v.valid_to,'visibility',v.visibility) order by v.sort_order,v.name),'[]'::jsonb) into v_vouchers from public.hotel_vouchers v where v.property_id=e.property_id and v.active=true and coalesce((v.visibility->>'booking_engine')::boolean,true)=true and (v.validity_mode='unlimited' or v.valid_to>=current_date);
  select coalesce(jsonb_agg(jsonb_build_object('name',q.name,'units',q.units,'from_price',q.from_price,'capacity',q.capacity) order by q.name),'[]'::jsonb) into v_room_types from (select coalesce(nullif(trim(h.tipo),''),'Habitación') name,count(*)::int units,min(coalesce(h.precio,0)) from_price,max(coalesce(h.capacidad,2))::int capacity from public.habitaciones h where h.property_id=e.property_id and coalesce(h.activa,true)=true and coalesce(h.online_bookable,true)=true group by coalesce(nullif(trim(h.tipo),''),'Habitación')) q;
  return jsonb_build_object('slug',e.slug,'property_id',e.property_id,'name',coalesce(nullif(e.display_name,''),p.name),'city',p.city,'description',p.description,'currency',e.currency,'primary_color',e.primary_color,'accent_color',e.accent_color,'logo_url',e.logo_url,'hero_url',e.hero_url,'booking_message',e.booking_message,'confirmation_message',e.confirmation_message,'contact_phone',e.contact_phone,'contact_email',e.contact_email,'allowed_origins',e.allowed_origins,'min_advance_days',e.min_advance_days,'max_advance_days',e.max_advance_days,'min_nights',e.min_nights,'template',e.template)
  || jsonb_build_object('cancellation_policy',coalesce(v_default->>'description',e.cancellation_policy),'default_cancellation_policy',v_default,'cancellation_policies',v_policies,'terms_url',e.terms_url,'privacy_url',e.privacy_url,'payment_mode',e.payment_mode,'deposit_percent',e.deposit_percent,'room_type_rules',e.room_type_rules,'gallery',e.gallery,'seo_title',e.seo_title,'seo_description',e.seo_description,'allow_self_cancel',e.allow_self_cancel,'self_cancel_cutoff_hours',e.self_cancel_cutoff_hours,'withdrawal_button_enabled',true,'website_mode',coalesce(w.mode,'managed'),'website_enabled',coalesce(w.enabled,true),'website_custom_domain',w.custom_domain,'website_domain_status',coalesce(w.domain_status,'not_connected'),'website_seo_indexable',coalesce(w.seo_indexable,true),'website_seo_canonical_url',w.seo_canonical_url)
  || jsonb_build_object('website_sections',coalesce(w.published_sections,w.sections,'[]'::jsonb),'website_studio_config',coalesce(w.published_studio_config,w.studio_config,'{}'::jsonb),'website_languages',coalesce(w.languages,array['es']::text[]),'website_default_language',coalesce(w.default_language,'es'),'floating_booking_enabled',coalesce(w.floating_booking_enabled,true),'floating_booking_label',coalesce(nullif(w.floating_booking_label,''),'Reservar'),'floating_booking_position',coalesce(w.floating_booking_position,'bottom_right'),'analytics_enabled',coalesce(w.analytics_enabled,true),'analytics_ga4_id',w.analytics_ga4_id,'analytics_gtm_id',w.analytics_gtm_id,'analytics_meta_pixel_id',w.analytics_meta_pixel_id,'website_room_types',v_room_types,'vouchers',v_vouchers);
end;
$function$;
