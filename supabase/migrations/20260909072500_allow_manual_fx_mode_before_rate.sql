create or replace function public.hl_update_rate_fx_settings(p_property_id uuid,p_fx_mode text,p_manual_usd_ars numeric default null) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare v_settings jsonb;v_pricing jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.properties p where p.id=p_property_id and p.owner_id=auth.uid()) then raise exception 'Solo el propietario puede modificar la cotización de tarifas.';end if;
 if p_fx_mode not in('automatic','manual') then raise exception 'Modo de cotización inválido.';end if;
 select coalesce(ps.settings,'{}'::jsonb) into v_settings from public.property_settings ps where ps.property_id=p_property_id;if v_settings is null then v_settings='{}'::jsonb;end if;
 v_pricing=coalesce(v_settings->'pricing','{}'::jsonb)||jsonb_build_object('rate_currency',coalesce(v_settings#>>'{pricing,rate_currency}','ARS'),'fx_mode',p_fx_mode)||case when p_fx_mode='manual' and coalesce(p_manual_usd_ars,0)>0 then jsonb_build_object('manual_usd_ars',p_manual_usd_ars,'manual_updated_at',now()) else '{}'::jsonb end;
 v_settings=jsonb_set(v_settings,'{pricing}',v_pricing,true);
 insert into public.property_settings(property_id,settings,updated_at,updated_by) values(p_property_id,v_settings,now(),auth.uid()) on conflict(property_id) do update set settings=excluded.settings,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
 return v_pricing;
end;$$;
