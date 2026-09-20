-- Central pricing contract v2.
-- Legacy storage stays NET for backward compatibility. New PMS consumers must use
-- hl_resolve_pricing_quote / hl_set_rate_calendar_pricing and never reinterpret raw columns.

create or replace function private.hl_price_math(
  p_amount numeric,p_taxes_enabled boolean,p_vat_rate numeric,p_price_tax_mode text,p_input_kind text default 'commercial'
) returns jsonb
language plpgsql immutable
set search_path to 'pg_catalog','pg_temp'
as $$
declare
  v_enabled boolean:=coalesce(p_taxes_enabled,false);
  v_vat numeric:=case when coalesce(p_taxes_enabled,false) then greatest(0,coalesce(p_vat_rate,0)) else 0 end;
  v_mode text:=case when lower(coalesce(p_price_tax_mode,''))='tax_excluded' then 'tax_excluded' else 'tax_included' end;
  v_kind text:=case when lower(coalesce(p_input_kind,''))='net' then 'net' else 'commercial' end;
  v_amount numeric:=greatest(0,coalesce(p_amount,0));v_net_precise numeric;v_net numeric;v_final numeric;v_tax numeric;v_commercial numeric;
begin
  v_net_precise:=case when v_kind='commercial' and v_enabled and v_mode='tax_included' and v_vat>0 then v_amount/(1+v_vat/100) else v_amount end;
  v_net:=round(v_net_precise,2);
  v_final:=round(v_net_precise*(case when v_enabled then 1+v_vat/100 else 1 end),2);
  v_tax:=round(v_final-v_net,2);
  v_commercial:=case when v_enabled and v_mode='tax_included' then v_final else v_net end;
  return jsonb_build_object('taxes_enabled',v_enabled,'vat_rate',v_vat,'price_tax_mode',case when v_enabled then v_mode else 'disabled' end,'net',v_net,'tax',v_tax,'final',v_final,'commercial',v_commercial,'net_precise',round(v_net_precise,6));
end;
$$;

create or replace function private.hl_price_breakdown_from_net(p_property_id uuid,p_net numeric)
returns jsonb language plpgsql stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare v_contract jsonb;
begin
  v_contract:=private.hl_property_pricing_contract(p_property_id);
  return v_contract||private.hl_price_math(p_net,coalesce((v_contract->>'taxes_enabled')::boolean,false),greatest(0,coalesce((v_contract->>'vat_rate')::numeric,0)),coalesce(v_contract->>'price_tax_mode','tax_included'),'net');
end;
$$;

create or replace function private.hl_price_breakdown_from_commercial(p_property_id uuid,p_commercial numeric)
returns jsonb language plpgsql stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare v_contract jsonb;
begin
  v_contract:=private.hl_property_pricing_contract(p_property_id);
  return v_contract||private.hl_price_math(p_commercial,coalesce((v_contract->>'taxes_enabled')::boolean,false),greatest(0,coalesce((v_contract->>'vat_rate')::numeric,0)),coalesce(v_contract->>'price_tax_mode','tax_included'),'commercial')
    ||jsonb_build_object('entered_commercial',round(greatest(0,coalesce(p_commercial,0)),2));
end;
$$;

create or replace function public.hl_resolve_pricing_quote(
  p_property_id uuid,p_start date,p_end date,p_room_ids bigint[] default null,p_reservation_currency text default null,p_usd_ars_rate numeric default null
) returns jsonb
language plpgsql stable security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_contract jsonb;v_settings jsonb:='{}'::jsonb;v_currency text;v_target_currency text;v_fx numeric:=1;v_conversion numeric:=1;
  v_room record;v_night record;v_breakdown jsonb;v_rooms jsonb:='[]'::jsonb;v_nightly jsonb;
  v_room_net numeric;v_room_final numeric;v_room_configured numeric;v_complete boolean;v_sources text[];
begin
  if p_property_id is null or p_start is null or p_end is null or p_end<=p_start then raise exception using errcode='22023',message='Rango de pricing inválido.';end if;
  if auth.uid() is null or not private.user_has_property_role(p_property_id,array['owner','admin','manager','reception','revenue','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para consultar tarifas de esta propiedad.';end if;
  select coalesce(settings,'{}'::jsonb) into v_settings from public.property_settings where property_id=p_property_id;v_settings:=coalesce(v_settings,'{}'::jsonb);
  v_contract:=private.hl_property_pricing_contract(p_property_id);v_currency:=upper(coalesce(v_contract->>'rate_currency','ARS'));v_target_currency:=upper(coalesce(nullif(p_reservation_currency,''),v_currency));
  if v_target_currency not in('ARS','USD') then raise exception using errcode='22023',message='Moneda de reserva inválida.';end if;
  if v_target_currency<>v_currency then
    v_fx:=coalesce(nullif(p_usd_ars_rate,0),nullif(v_settings#>>'{pricing,manual_usd_ars}','')::numeric,nullif(v_settings#>>'{pricing,last_conversion_rate}','')::numeric,0);
    if v_fx<=0 then raise exception using errcode='P0001',message='Falta una cotización USD/ARS válida para convertir la tarifa.';end if;
    v_conversion:=case when v_currency='ARS' and v_target_currency='USD' then 1/v_fx else v_fx end;
  end if;
  for v_room in select h.id,h.nombre,h.tipo,h.capacidad from public.habitaciones h where h.property_id=p_property_id and h.activa is distinct from false and(p_room_ids is null or h.id=any(p_room_ids)) order by h.sort_order nulls last,h.nombre loop
    v_nightly:='[]'::jsonb;v_room_net:=0;v_room_final:=0;v_room_configured:=0;v_complete:=true;v_sources:=array[]::text[];
    for v_night in select * from private.hl_calendar_room_nightly_pricing(p_property_id,v_room.id,p_start,p_end) loop
      if v_night.price is null then
        v_complete:=false;
        v_nightly:=v_nightly||jsonb_build_array(jsonb_build_object('stay_date',v_night.stay_date,'configured_amount',null,'configured_currency',v_currency,'tax_mode',case when coalesce((v_contract->>'taxes_enabled')::boolean,false) then v_contract->>'price_tax_mode' else 'disabled' end,'vat_rate',coalesce((v_contract->>'vat_rate')::numeric,0),'net_amount',null,'tax_amount',null,'final_amount',null,'final_currency',v_target_currency,'rate_source',v_night.rate_source,'pricing_version',2));
      else
        v_breakdown:=private.hl_price_breakdown_from_net(p_property_id,v_night.price);v_sources:=array_append(v_sources,v_night.rate_source);
        v_room_configured:=v_room_configured+coalesce((v_breakdown->>'commercial')::numeric,0);
        v_room_net:=v_room_net+round(coalesce((v_breakdown->>'net_precise')::numeric,0)*v_conversion,2);
        v_room_final:=v_room_final+round(coalesce((v_breakdown->>'final')::numeric,0)*v_conversion,2);
        v_nightly:=v_nightly||jsonb_build_array(jsonb_build_object('stay_date',v_night.stay_date,'configured_amount',coalesce((v_breakdown->>'commercial')::numeric,0),'configured_currency',v_currency,'tax_mode',coalesce(v_breakdown->>'price_tax_mode','disabled'),'vat_rate',coalesce((v_breakdown->>'vat_rate')::numeric,0),'net_amount',round(coalesce((v_breakdown->>'net_precise')::numeric,0)*v_conversion,2),'tax_amount',round(coalesce((v_breakdown->>'final')::numeric,0)*v_conversion-coalesce((v_breakdown->>'net')::numeric,0)*v_conversion,2),'final_amount',round(coalesce((v_breakdown->>'final')::numeric,0)*v_conversion,2),'final_currency',v_target_currency,'rate_source',v_night.rate_source,'pricing_version',2));
      end if;
    end loop;
    v_rooms:=v_rooms||jsonb_build_array(jsonb_build_object('room_id',v_room.id,'room_name',v_room.nombre,'room_type',v_room.tipo,'capacity',v_room.capacidad,'nights',p_end-p_start,'configured_currency',v_currency,'final_currency',v_target_currency,'tax_mode',case when coalesce((v_contract->>'taxes_enabled')::boolean,false) then v_contract->>'price_tax_mode' else 'disabled' end,'vat_rate',coalesce((v_contract->>'vat_rate')::numeric,0),'total_configured',case when v_complete then round(v_room_configured,2) else null end,'total_net',case when v_complete then round(v_room_net,2) else null end,'total_tax',case when v_complete then round(v_room_final-v_room_net,2) else null end,'total_final',case when v_complete then round(v_room_final,2) else null end,'average_configured',case when v_complete then round(v_room_configured/(p_end-p_start),2) else null end,'average_net',case when v_complete then round(v_room_net/(p_end-p_start),6) else null end,'average_final',case when v_complete then round(v_room_final/(p_end-p_start),2) else null end,'rate_source',case when not v_complete then 'unresolved' when cardinality(array(select distinct unnest(v_sources)))=1 then v_sources[1] else 'mixed' end,'is_complete',v_complete,'nightly_rates',v_nightly,'pricing_version',2));
  end loop;
  return jsonb_build_object('property_id',p_property_id,'start_date',p_start,'end_date',p_end,'nights',p_end-p_start,'configured_currency',v_currency,'final_currency',v_target_currency,'tax_mode',case when coalesce((v_contract->>'taxes_enabled')::boolean,false) then v_contract->>'price_tax_mode' else 'disabled' end,'vat_rate',coalesce((v_contract->>'vat_rate')::numeric,0),'taxes_enabled',coalesce((v_contract->>'taxes_enabled')::boolean,false),'fx_rate',v_fx,'rooms',v_rooms,'pricing_version',2);
end;
$$;

create or replace function public.hl_set_rate_calendar_pricing(
  p_property_id uuid,p_room_ids bigint[],p_dates date[],p_configured_amount numeric default null,p_percent numeric default null,p_min_stay integer default null,p_open boolean default null,p_round_up boolean default false
) returns jsonb
language plpgsql security definer
set search_path to 'public','private','pg_temp'
as $$
declare v_room_id bigint;v_day date;v_current record;v_existing public.hotel_rate_calendar%rowtype;v_current_breakdown jsonb;v_new_breakdown jsonb;v_current_commercial numeric;v_new_commercial numeric;v_new_net numeric;v_count integer:=0;
begin
  if auth.uid() is null or not private.user_has_property_role(p_property_id,array['owner','admin','manager','revenue']::text[]) then raise exception using errcode='42501',message='No tenés permisos para modificar tarifas.';end if;
  if coalesce(array_length(p_room_ids,1),0)=0 or coalesce(array_length(p_dates,1),0)=0 then raise exception using errcode='22023',message='Elegí habitaciones y fechas.';end if;
  if p_configured_amount is not null and p_percent is not null then raise exception using errcode='22023',message='Aplicá un precio o un porcentaje, no ambos a la vez.';end if;
  if p_configured_amount is not null and p_configured_amount<0 then raise exception using errcode='22023',message='El precio no puede ser negativo.';end if;
  if p_percent is not null and p_percent<=-100 then raise exception using errcode='22023',message='El ajuste porcentual debe ser mayor a -100%.';end if;
  foreach v_room_id in array p_room_ids loop
    if not exists(select 1 from public.habitaciones where id=v_room_id and property_id=p_property_id and activa is distinct from false) then raise exception using errcode='P0002',message=format('La habitación %s no existe o está inactiva.',v_room_id);end if;
    foreach v_day in array p_dates loop
      select * into v_current from private.hl_calendar_room_nightly_pricing(p_property_id,v_room_id,v_day,v_day+1) limit 1;
      if v_current.price is null then raise exception using errcode='P0001',message=format('Falta una tarifa resoluble para la habitación %s el %s.',v_room_id,v_day);end if;
      select * into v_existing from public.hotel_rate_calendar where property_id=p_property_id and habitacion_id=v_room_id and stay_date=v_day;
      v_current_breakdown:=private.hl_price_breakdown_from_net(p_property_id,v_current.price);v_current_commercial:=coalesce((v_current_breakdown->>'commercial')::numeric,0);
      if p_configured_amount is not null then v_new_commercial:=p_configured_amount;elsif p_percent is not null then v_new_commercial:=v_current_commercial*(1+p_percent/100);v_new_commercial:=case when p_round_up then ceil(v_new_commercial) else round(v_new_commercial,2) end;else v_new_commercial:=v_current_commercial;end if;
      v_new_breakdown:=private.hl_price_breakdown_from_commercial(p_property_id,v_new_commercial);v_new_net:=coalesce((v_new_breakdown->>'net_precise')::numeric,(v_new_breakdown->>'net')::numeric,0);
      insert into public.hotel_rate_calendar(property_id,habitacion_id,stay_date,price,min_stay,stop_sell,closed_to_arrival,closed_to_departure,notes,updated_at)
      values(p_property_id,v_room_id,v_day,round(v_new_net,6),greatest(1,coalesce(p_min_stay,v_existing.min_stay,1)),case when p_open is null then coalesce(v_existing.stop_sell,false) else not p_open end,coalesce(v_existing.closed_to_arrival,false),coalesce(v_existing.closed_to_departure,false),v_existing.notes,now())
      on conflict(property_id,habitacion_id,stay_date) do update set price=excluded.price,min_stay=excluded.min_stay,stop_sell=excluded.stop_sell,closed_to_arrival=excluded.closed_to_arrival,closed_to_departure=excluded.closed_to_departure,notes=excluded.notes,updated_at=excluded.updated_at;
      v_count:=v_count+1;
    end loop;
  end loop;
  return jsonb_build_object('updated_rows',v_count,'pricing_version',2);
end;
$$;

comment on column public.hotel_rate_calendar.price is 'LEGACY COMPATIBILITY. NET room-rate amount in property pricing.rate_currency. New PMS pricing consumers must use hl_resolve_pricing_quote; writes must use hl_set_rate_calendar_pricing.';
comment on column public.habitaciones.precio is 'LEGACY/default NET amount only. It is not a fiscal/commercial price source for dated sales; do not display or tax it directly. Use hl_resolve_pricing_quote.';
comment on column public.hotel_room_types.base_price is 'LEGACY/default NET amount only. Dated sales are resolved by the central pricing layer; do not reinterpret this field in UI.';

revoke all on function public.hl_resolve_pricing_quote(uuid,date,date,bigint[],text,numeric) from public;
grant execute on function public.hl_resolve_pricing_quote(uuid,date,date,bigint[],text,numeric) to authenticated;
revoke all on function public.hl_set_rate_calendar_pricing(uuid,bigint[],date[],numeric,numeric,integer,boolean,boolean) from public;
grant execute on function public.hl_set_rate_calendar_pricing(uuid,bigint[],date[],numeric,numeric,integer,boolean,boolean) to authenticated;

do $$
declare j jsonb;
begin
  j:=private.hl_price_math(70000,true,21,'tax_included','commercial');if (j->>'net')::numeric<>57851.24 or (j->>'tax')::numeric<>12148.76 or (j->>'final')::numeric<>70000 then raise exception 'QA included 70000 failed: %',j;end if;
  j:=private.hl_price_math(110000,true,21,'tax_included','commercial');if (j->>'net')::numeric<>90909.09 or (j->>'tax')::numeric<>19090.91 or (j->>'final')::numeric<>110000 then raise exception 'QA included 110000 failed: %',j;end if;
  j:=private.hl_price_math(70000,true,21,'tax_excluded','commercial');if (j->>'net')::numeric<>70000 or (j->>'tax')::numeric<>14700 or (j->>'final')::numeric<>84700 then raise exception 'QA excluded 70000 failed: %',j;end if;
  j:=private.hl_price_math(100,true,21,'tax_included','commercial');if (j->>'net')::numeric<>82.64 or (j->>'tax')::numeric<>17.36 or (j->>'final')::numeric<>100 then raise exception 'QA USD included 100 failed: %',j;end if;
end $$;
