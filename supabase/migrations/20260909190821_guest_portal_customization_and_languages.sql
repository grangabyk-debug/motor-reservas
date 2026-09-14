-- Portal del huésped: personalización por tenant, idiomas y controles server-side.
alter table public.hotel_guest_guides
  add column if not exists show_account boolean not null default true,
  add column if not exists show_wifi boolean not null default true,
  add column if not exists show_guide boolean not null default true,
  add column if not exists show_nearby boolean not null default true,
  add column if not exists show_requests boolean not null default true,
  add column if not exists show_contact boolean not null default true,
  add column if not exists enabled_actions jsonb not null default '{"towels":true,"pillows":true,"cleaning":true,"maintenance":true,"late_checkout":true,"other":true}'::jsonb,
  add column if not exists languages text[] not null default array['es','en','pt']::text[],
  add column if not exists default_language text not null default 'es',
  add column if not exists portal_title text,
  add column if not exists nearby_places jsonb not null default '[]'::jsonb,
  add column if not exists translations jsonb not null default '{}'::jsonb,
  add column if not exists logo_url text,
  add column if not exists cover_image_url text;

create or replace function guest_portal_private.hl_guest_stay_portal_snapshot_internal(p_token text)
returns jsonb language plpgsql security definer
set search_path to 'public','private','guest_portal_private','extensions','pg_temp'
as $function$
declare
  v_portal public.hotel_guest_stay_portals%rowtype; v_res public.reservas%rowtype; v_room public.habitaciones%rowtype; v_settings public.hotel_os_settings%rowtype; v_guide public.hotel_guest_guides%rowtype; v_paid numeric:=0; v_requests jsonb:='[]'::jsonb; v_account jsonb;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;
  if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  select * into v_room from public.habitaciones where id=v_res.habitacion_id and property_id=v_res.property_id;
  select * into v_settings from public.hotel_os_settings where property_id=v_res.property_id;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;
  if found and coalesce(v_guide.enabled,false)=false then return jsonb_build_object('ok',false,'error','portal_disabled'); end if;
  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.property_id=v_res.property_id and p.reserva_id=v_res.id and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void');
  select coalesce(jsonb_agg(jsonb_build_object('id',gr.id,'kind',l.kind,'title',gr.title,'status',gr.status,'area',gr.assigned_area,'created_at',gr.created_at,'resolved_at',gr.resolved_at) order by gr.created_at desc),'[]'::jsonb) into v_requests from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id and gr.property_id=l.property_id where l.portal_id=v_portal.id;
  update public.hotel_guest_stay_portals set last_opened_at=now(),updated_at=now() where id=v_portal.id;
  if v_guide.id is null or coalesce(v_guide.show_account,true) then v_account:=jsonb_build_object('currency',coalesce(v_res.moneda,v_settings.operational_settings->>'currency','ARS'),'total',coalesce(v_res.precio_total,0),'paid',v_paid,'balance',greatest(0,coalesce(v_res.precio_total,0)-v_paid)); else v_account:=null; end if;
  return jsonb_build_object('ok',true,
    'hotel',jsonb_build_object('name',coalesce(v_settings.hotel_name,(select name from public.properties where id=v_res.property_id),'Habitación Llena'),'city',coalesce(v_settings.city,(select city from public.properties where id=v_res.property_id)),'motto',v_settings.motto,'welcome',coalesce(v_guide.welcome_message,v_settings.welcome_message),'logo',coalesce(v_guide.logo_url,v_settings.logo_data_url),'cover',v_guide.cover_image_url,'accent_color',coalesce(v_guide.accent_color,'#5B5CEB')),
    'guest',jsonb_build_object('name',v_res.nombre_huesped),
    'stay',jsonb_build_object('number',v_res.numero_reserva,'arrival',v_res.fecha_entrada,'departure',v_res.fecha_salida,'status',v_res.estado,'room',jsonb_build_object('name',v_room.nombre,'type',v_room.tipo),'late_checkout_confirmed',coalesce(v_res.late_checkout,false),'departure_time',v_res.hora_salida_estimada),
    'guide',jsonb_build_object('title',coalesce(v_guide.portal_title,v_guide.title),'subtitle',v_guide.subtitle,'wifi_name',v_guide.wifi_name,'wifi_password',v_guide.wifi_password,'contact_phone',v_guide.contact_phone,'contact_whatsapp',v_guide.contact_whatsapp,'checkin_time',coalesce(v_guide.checkin_time,v_settings.operational_settings->>'checkin_time'),'checkout_time',coalesce(v_guide.checkout_time,v_settings.operational_settings->>'checkout_time'),'sections',coalesce(v_guide.sections,'[]'::jsonb),'house_rules',coalesce(v_guide.house_rules,'[]'::jsonb),'useful_links',coalesce(v_guide.useful_links,'[]'::jsonb),'nearby_places',coalesce(v_guide.nearby_places,'[]'::jsonb),'show_account',coalesce(v_guide.show_account,true),'show_wifi',coalesce(v_guide.show_wifi,true),'show_guide',coalesce(v_guide.show_guide,true),'show_nearby',coalesce(v_guide.show_nearby,true),'show_requests',coalesce(v_guide.show_requests,true),'show_contact',coalesce(v_guide.show_contact,true),'enabled_actions',coalesce(v_guide.enabled_actions,'{"towels":true,"pillows":true,"cleaning":true,"maintenance":true,"late_checkout":true,"other":true}'::jsonb),'languages',coalesce(to_jsonb(v_guide.languages),'["es","en","pt"]'::jsonb),'default_language',coalesce(v_guide.default_language,'es'),'translations',coalesce(v_guide.translations,'{}'::jsonb),'accent_color',coalesce(v_guide.accent_color,'#5B5CEB')),
    'account',v_account,'booked_services',coalesce(v_res.servicios,'[]'::jsonb),'requests',case when v_guide.id is null or coalesce(v_guide.show_requests,true) then v_requests else '[]'::jsonb end,'portal',jsonb_build_object('valid_until',v_portal.valid_until));
end;$function$;

create or replace function guest_portal_private.hl_guest_stay_portal_request_internal(p_token text,p_kind text,p_detail text default null::text)
returns jsonb language plpgsql security definer
set search_path to 'public','private','guest_portal_private','extensions','pg_temp'
as $function$
declare v_portal public.hotel_guest_stay_portals%rowtype;v_res public.reservas%rowtype;v_guide public.hotel_guest_guides%rowtype;v_kind text:=lower(trim(coalesce(p_kind,'')));v_detail text:=nullif(trim(coalesce(p_detail,'')),'');v_title text;v_area text;v_priority text:='normal';v_request public.hotel_guest_requests%rowtype;
begin
  if p_token is null or length(p_token)<32 or length(p_token)>128 then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  if v_kind not in ('towels','pillows','cleaning','maintenance','late_checkout','other') then return jsonb_build_object('ok',false,'error','invalid_request'); end if;
  if v_detail is not null and length(v_detail)>1000 then return jsonb_build_object('ok',false,'error','detail_too_long'); end if;
  if v_kind='maintenance' and v_detail is null then return jsonb_build_object('ok',false,'error','detail_required'); end if;
  select * into v_portal from public.hotel_guest_stay_portals where token_hash=encode(digest(p_token,'sha256'),'hex') limit 1;if not found then return jsonb_build_object('ok',false,'error','invalid_token'); end if;
  select * into v_res from public.reservas where id=v_portal.reservation_id and property_id=v_portal.property_id and merged_into_id is null;
  if not found or v_portal.revoked_at is not null or now()<v_portal.valid_from or now()>=v_portal.valid_until or lower(coalesce(v_res.estado,'')) in ('cancelada','finalizada') or coalesce(v_res.no_show,false) or v_res.checkout_real_at is not null then return jsonb_build_object('ok',false,'error','access_expired'); end if;
  select * into v_guide from public.hotel_guest_guides where property_id=v_res.property_id limit 1;if found then if coalesce(v_guide.enabled,false)=false then return jsonb_build_object('ok',false,'error','portal_disabled'); end if;if coalesce(v_guide.enabled_actions->v_kind,'true'::jsonb)<>'true'::jsonb then return jsonb_build_object('ok',false,'error','request_disabled'); end if;end if;
  select gr.* into v_request from public.hotel_guest_stay_portal_requests l join public.hotel_guest_requests gr on gr.id=l.guest_request_id where l.portal_id=v_portal.id and l.kind=v_kind and gr.status in ('open','in_progress') order by gr.created_at desc limit 1;if found then return jsonb_build_object('ok',true,'already_open',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area));end if;
  if v_kind='towels' then v_title:='Solicita toallas';v_area:='housekeeping';elsif v_kind='pillows' then v_title:='Solicita almohadas';v_area:='housekeeping';elsif v_kind='cleaning' then v_title:='Solicita limpieza de habitación';v_area:='housekeeping';elsif v_kind='maintenance' then v_title:='Reporta un problema en la habitación';v_area:='maintenance';v_priority:=case when lower(coalesce(v_detail,''))~'(gas|humo|chispa|inund)' then 'urgent' when lower(coalesce(v_detail,''))~'(roto|rota|no funciona|no anda|fuga|pierde)' then 'high' else 'normal' end;elsif v_kind='late_checkout' then v_title:='Solicitud de late check-out';v_area:='reception';else v_title:='Solicitud del huésped';v_area:='reception';end if;
  insert into public.hotel_guest_requests(property_id,reservation_id,room_id,title,detail,status,priority,requested_by,department,assigned_area,created_by) values(v_res.property_id,v_res.id,v_res.habitacion_id,v_title,v_detail,'open',v_priority,'guest',v_area,v_area,null) returning * into v_request;
  insert into public.hotel_guest_stay_portal_requests(portal_id,property_id,reservation_id,room_id,guest_request_id,kind) values(v_portal.id,v_res.property_id,v_res.id,v_res.habitacion_id,v_request.id,v_kind);
  return jsonb_build_object('ok',true,'request',jsonb_build_object('id',v_request.id,'title',v_request.title,'status',v_request.status,'area',v_request.assigned_area,'priority',v_request.priority,'created_at',v_request.created_at));
end;$function$;