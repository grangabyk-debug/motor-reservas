create or replace function private.hl_snapshot_reservation_nightly_rates()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  d jsonb;
  v_new_details jsonb := '[]'::jsonb;
  v_nightly jsonb;
  v_room_id bigint;
  v_start date;
  v_end date;
  v_day date;
  v_rate numeric;
  v_base numeric;
  v_min numeric;
  v_max numeric;
  v_source text;
  v_day_source text;
  v_category text;
  v_manual boolean;
begin
  if new.habitaciones_detalle is null or jsonb_typeof(new.habitaciones_detalle) <> 'array' then
    return new;
  end if;

  for d in select value from jsonb_array_elements(new.habitaciones_detalle)
  loop
    if jsonb_typeof(d->'tarifas_por_noche')='array' and jsonb_array_length(d->'tarifas_por_noche')>0 then
      v_new_details := v_new_details || jsonb_build_array(d);
      continue;
    end if;

    v_source := coalesce(d->>'tarifa_fuente','');
    if v_source not in ('calendar_room','calendar_room_with_base_fallback','calendar_sold_category','manual') then
      v_new_details := v_new_details || jsonb_build_array(d);
      continue;
    end if;

    v_room_id := nullif(d->>'habitacion_id','')::bigint;
    v_start := coalesce(nullif(d->>'fecha_entrada','')::date,new.fecha_entrada);
    v_end := coalesce(nullif(d->>'fecha_salida','')::date,new.fecha_salida);
    v_category := nullif(trim(coalesce(d->>'tarifa_categoria',d->>'categoria_vendida','')),'');
    v_manual := coalesce(nullif(d->>'tarifa_manual','')::boolean,false) or v_source='manual';

    if v_room_id is null or v_start is null or v_end is null or v_end<=v_start then
      v_new_details := v_new_details || jsonb_build_array(d);
      continue;
    end if;

    select h.precio into v_base
    from public.habitaciones h
    where h.id=v_room_id and h.property_id=new.property_id;

    v_nightly := '[]'::jsonb;
    for v_day in select gs::date from generate_series(v_start::timestamp,(v_end-1)::timestamp,interval '1 day') gs
    loop
      v_rate := null;
      v_day_source := v_source;

      if v_manual then
        v_rate := greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,0));
        v_day_source := 'manual';
      elsif v_source='calendar_sold_category' and v_category is not null then
        select min(c.price),max(c.price)
          into v_min,v_max
        from public.hotel_rate_calendar c
        join public.habitaciones h on h.id=c.habitacion_id and h.property_id=c.property_id
        where c.property_id=new.property_id
          and h.activa=true
          and h.tipo=v_category
          and c.stay_date=v_day;
        if v_min is not null and (v_max is null or abs(v_max-v_min)<=.005) then
          v_rate := v_min;
          v_day_source := 'calendar_sold_category';
        else
          v_rate := greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,0));
          v_day_source := 'snapshot_average_fallback';
        end if;
      else
        select c.price into v_rate
        from public.hotel_rate_calendar c
        where c.property_id=new.property_id and c.habitacion_id=v_room_id and c.stay_date=v_day;
        if v_rate is null then
          v_rate := greatest(0,coalesce(v_base,nullif(d->>'tarifa_noche','')::numeric,0));
          v_day_source := 'base_room_fallback';
        else
          v_day_source := 'calendar_room';
        end if;
      end if;

      v_nightly := v_nightly || jsonb_build_array(jsonb_build_object(
        'fecha',v_day,
        'tarifa_neta',round(coalesce(v_rate,0),6),
        'fuente',v_day_source
      ));
    end loop;

    d := jsonb_set(d,'{tarifas_por_noche}',v_nightly,true);
    d := jsonb_set(d,'{tarifa_snapshot_at}',to_jsonb(current_timestamp::text),true);
    v_new_details := v_new_details || jsonb_build_array(d);
  end loop;

  new.habitaciones_detalle := v_new_details;
  return new;
end;
$$;

revoke all on function private.hl_snapshot_reservation_nightly_rates() from public;

drop trigger if exists trg_hl_snapshot_reservation_nightly_rates on public.reservas;
create trigger trg_hl_snapshot_reservation_nightly_rates
before insert on public.reservas
for each row execute function private.hl_snapshot_reservation_nightly_rates();
