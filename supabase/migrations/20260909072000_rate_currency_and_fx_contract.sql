update public.property_settings
set settings=jsonb_set(coalesce(settings,'{}'::jsonb),'{pricing}',coalesce(settings->'pricing','{}'::jsonb)||jsonb_build_object('rate_currency',coalesce(settings#>>'{pricing,rate_currency}','ARS'),'fx_mode',coalesce(settings#>>'{pricing,fx_mode}','automatic')),true),updated_at=now()
where settings->'pricing' is null or settings#>>'{pricing,rate_currency}' is null or settings#>>'{pricing,fx_mode}' is null;

create or replace function public.hl_update_rate_fx_settings(p_property_id uuid,p_fx_mode text,p_manual_usd_ars numeric default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare v_settings jsonb;v_pricing jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.properties p where p.id=p_property_id and p.owner_id=auth.uid()) then raise exception 'Solo el propietario puede modificar la cotización de tarifas.';end if;
 if p_fx_mode not in('automatic','manual') then raise exception 'Modo de cotización inválido.';end if;
 if p_fx_mode='manual' and coalesce(p_manual_usd_ars,0)<=0 then raise exception 'Ingresá una cotización USD/ARS válida.';end if;
 select coalesce(ps.settings,'{}'::jsonb) into v_settings from public.property_settings ps where ps.property_id=p_property_id;if v_settings is null then v_settings='{}'::jsonb;end if;
 v_pricing=coalesce(v_settings->'pricing','{}'::jsonb)||jsonb_build_object('rate_currency',coalesce(v_settings#>>'{pricing,rate_currency}','ARS'),'fx_mode',p_fx_mode)||case when p_fx_mode='manual' then jsonb_build_object('manual_usd_ars',p_manual_usd_ars,'manual_updated_at',now()) else '{}'::jsonb end;
 v_settings=jsonb_set(v_settings,'{pricing}',v_pricing,true);
 insert into public.property_settings(property_id,settings,updated_at,updated_by) values(p_property_id,v_settings,now(),auth.uid()) on conflict(property_id) do update set settings=excluded.settings,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 return v_pricing;
end;$$;

create or replace function public.hl_change_rate_currency(p_property_id uuid,p_target_currency text,p_usd_ars_rate numeric,p_fx_source text default 'BCRA',p_fx_as_of date default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare v_settings jsonb;v_pricing jsonb;v_current text;v_factor numeric;
begin
 if auth.uid() is null or not exists(select 1 from public.properties p where p.id=p_property_id and p.owner_id=auth.uid()) then raise exception 'Solo el propietario puede cambiar la moneda base de tarifas.';end if;
 if p_target_currency not in('ARS','USD') then raise exception 'Moneda base inválida.';end if;if coalesce(p_usd_ars_rate,0)<=0 then raise exception 'No hay una cotización USD/ARS válida para convertir las tarifas.';end if;
 select coalesce(ps.settings,'{}'::jsonb) into v_settings from public.property_settings ps where ps.property_id=p_property_id for update;if v_settings is null then v_settings='{}'::jsonb;end if;
 v_current=coalesce(v_settings#>>'{pricing,rate_currency}','ARS');if v_current not in('ARS','USD') then v_current='ARS';end if;
 if v_current<>p_target_currency then v_factor=case when v_current='ARS' and p_target_currency='USD' then 1/p_usd_ars_rate else p_usd_ars_rate end;update public.habitaciones set precio=round(precio*v_factor,6) where property_id=p_property_id and precio is not null;update public.hotel_rate_calendar set price=round(price*v_factor,6),updated_at=now() where property_id=p_property_id and price is not null;end if;
 v_pricing=coalesce(v_settings->'pricing','{}'::jsonb)||jsonb_build_object('rate_currency',p_target_currency,'last_conversion_rate',p_usd_ars_rate,'last_conversion_at',now(),'last_conversion_from',v_current,'last_conversion_to',p_target_currency,'last_fx_source',coalesce(nullif(p_fx_source,''),'BCRA'),'last_fx_as_of',coalesce(p_fx_as_of,current_date));
 v_settings=jsonb_set(v_settings,'{pricing}',v_pricing,true);insert into public.property_settings(property_id,settings,updated_at,updated_by) values(p_property_id,v_settings,now(),auth.uid()) on conflict(property_id) do update set settings=excluded.settings,updated_at=excluded.updated_at,updated_by=excluded.updated_by;return v_pricing;
end;$$;

create or replace function public.hl_direct_reservation_rate_currency() returns trigger language plpgsql set search_path=public as $$
declare v_currency text;
begin
 if coalesce(new.canal_reserva,'Walk-in') in('Walk-in','Directa','Recepción','Recepcion') then
   select coalesce(ps.settings#>>'{pricing,rate_currency}','ARS') into v_currency from public.property_settings ps where ps.property_id=new.property_id;
   if v_currency in('ARS','USD') then new.moneda=v_currency;end if;
 end if;
 return new;
end;$$;
drop trigger if exists trg_direct_reservation_rate_currency on public.reservas;
create trigger trg_direct_reservation_rate_currency before insert on public.reservas for each row execute function public.hl_direct_reservation_rate_currency();

revoke all on function public.hl_update_rate_fx_settings(uuid,text,numeric) from public;grant execute on function public.hl_update_rate_fx_settings(uuid,text,numeric) to authenticated;
revoke all on function public.hl_change_rate_currency(uuid,text,numeric,text,date) from public;grant execute on function public.hl_change_rate_currency(uuid,text,numeric,text,date) to authenticated;
