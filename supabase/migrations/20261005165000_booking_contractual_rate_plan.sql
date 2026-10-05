begin;

update public.hotel_channel_mappings
set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('rate_plan_code','HB','rate_plan_name','Media pensión','meal_plan','half_board','regimen','Media pensión','pricing_policy','ota_contractual'),updated_at=now()
where connection_id='5fe514d4-e0b3-4b6d-9d69-d14ec6dfd5c4' and mapping_type='rate_plan' and external_id='30863ca0-5dd4-4351-b1f3-0d57792366d7';

create or replace function private.hl_enrich_ota_rate_plan_snapshot()
returns trigger language plpgsql security definer set search_path to 'public','private','pg_temp'
as $$
declare details jsonb:=case when jsonb_typeof(new.habitaciones_detalle)='array' then new.habitaciones_detalle else '[]'::jsonb end;next_details jsonb:='[]'::jsonb;d jsonb;ext text;map_row public.hotel_channel_mappings%rowtype;plan jsonb;code text;regimen text;all_regimens text[]:=array[]::text[];
begin
  if lower(coalesce(new.canal_reserva,'')) not in('booking.com','booking') then return new;end if;
  for d in select value from jsonb_array_elements(details) loop
    ext:=nullif(d->>'external_rate_plan_id','');
    if ext is not null and nullif(d->>'rate_plan_code','') is null then
      select * into map_row from public.hotel_channel_mappings where property_id=new.property_id and mapping_type='rate_plan' and external_id=ext order by updated_at desc limit 1;
      code:=upper(coalesce(nullif(map_row.metadata->>'rate_plan_code',''),''));
      if code<>'' then
        select p into plan from jsonb_array_elements(private.hl_property_rate_plans(new.property_id)->'plans') p where upper(coalesce(p->>'code',''))=code limit 1;
        if plan is not null then
          regimen:=coalesce(plan->>'legacy_regimen',plan->>'name','Alojamiento');
          d:=d||jsonb_build_object('pricing_origin','ota_contractual','ota_contractual_price',true,'ota_contractual_net_night',coalesce(nullif(d->>'tarifa_noche','')::numeric,0),'rate_plan_code',plan->>'code','rate_plan_name',plan->>'name','rate_plan_meal',plan->>'meal_plan','rate_plan_regimen',regimen,'rate_plan_adjustment_basis',coalesce(plan->>'adjustment_basis','per_person'),'rate_plan_adjustment_configured_value',coalesce(nullif(plan->>'adjustment_per_person','')::numeric,0),'rate_plan_adjustment_booked_per_night',0,'rate_plan_adjustment_booked_per_person',0,'rate_plan_adjustment_final_per_person',0,'rate_plan_snapshot',jsonb_build_object('code',plan->>'code','name',plan->>'name','meal_plan',plan->>'meal_plan','description',plan->>'description','pricing_policy','ota_contractual','ota_rate_plan_id',ext,'captured_at',now()),'rate_plan_snapshot_at',now());
        end if;
      end if;
    end if;
    regimen:=coalesce(d->>'rate_plan_regimen',d->>'rate_plan_name');
    if nullif(regimen,'') is not null then all_regimens:=array_append(all_regimens,regimen); end if;
    next_details:=next_details||jsonb_build_array(d);
  end loop;
  new.habitaciones_detalle:=next_details;
  if cardinality(all_regimens)>0 then select case when count(distinct x)=1 then min(x) else 'Mixto' end into new.regimen from unnest(all_regimens) x;end if;
  return new;
end;
$$;
drop trigger if exists trg_enrich_ota_rate_plan_snapshot on public.reservas;
create trigger trg_enrich_ota_rate_plan_snapshot before insert or update of habitaciones_detalle,canal_reserva on public.reservas for each row execute function private.hl_enrich_ota_rate_plan_snapshot();

commit;
