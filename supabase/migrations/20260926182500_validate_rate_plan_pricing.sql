begin;

create or replace function private.hl_validate_new_reservation_calendar_pricing()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  d jsonb;
  v_source text;
  v_room_id bigint;
  v_start date;
  v_end date;
  v_nights integer;
  v_rate numeric;
  v_base_rate numeric;
  v_plan_nightly numeric;
  v_sold_category text;
  v_expected_rate numeric;
  v_expected_total numeric;
  v_effective_expected_rate numeric;
  v_lodging_total numeric := 0;
  v_rate_sum numeric := 0;
  v_days integer;
  v_divergent integer;
begin
  if new.habitaciones_detalle is null or jsonb_typeof(new.habitaciones_detalle) <> 'array' then
    return new;
  end if;

  -- Solo valida el flujo PMS nuevo, identificado explícitamente por tarifa_fuente.
  -- Importaciones, OTA y flujos legacy sin marcador conservan su importe contratado.
  if not exists (
    select 1
    from jsonb_array_elements(new.habitaciones_detalle) x
    where coalesce(x->>'tarifa_fuente','') in ('calendar_room','calendar_room_with_base_fallback','calendar_sold_category','manual')
  ) then
    return new;
  end if;

  for d in select value from jsonb_array_elements(new.habitaciones_detalle)
  loop
    v_source := coalesce(d->>'tarifa_fuente','');
    v_room_id := nullif(d->>'habitacion_id','')::bigint;
    v_start := coalesce(nullif(d->>'fecha_entrada','')::date,new.fecha_entrada);
    v_end := coalesce(nullif(d->>'fecha_salida','')::date,new.fecha_salida);
    v_nights := greatest(1,v_end-v_start);
    v_rate := greatest(0,coalesce(nullif(d->>'tarifa_noche','')::numeric,0));
    v_base_rate := greatest(0,coalesce(nullif(d->>'tarifa_base_noche','')::numeric,v_rate));
    v_plan_nightly := coalesce(
      nullif(d->>'rate_plan_adjustment_booked_per_night','')::numeric,
      v_rate-v_base_rate,
      0
    );
    v_sold_category := nullif(trim(coalesce(d->>'categoria_vendida','')),'');

    if v_source = 'manual' or coalesce(nullif(d->>'tarifa_manual','')::boolean,false) then
      v_expected_rate := v_rate;
      v_expected_total := v_rate*v_nights;

    elsif v_source in ('calendar_room','calendar_room_with_base_fallback') then
      with daily as (
        select gs::date as stay_date,coalesce(c.price,h.precio) as effective_price
        from public.habitaciones h
        cross join lateral generate_series(v_start::timestamp,(v_end-1)::timestamp,interval '1 day') gs
        left join public.hotel_rate_calendar c
          on c.property_id=h.property_id and c.habitacion_id=h.id and c.stay_date=gs::date
        where h.property_id=new.property_id and h.id=v_room_id and h.activa=true
      )
      select count(*),avg(effective_price),sum(effective_price)
      into v_days,v_expected_rate,v_expected_total
      from daily;

      if v_days<>v_nights or v_expected_rate is null then
        raise exception using errcode='22023',message=format('No se pudo resolver la tarifa efectiva para la habitación %s entre %s y %s.',v_room_id,v_start,v_end);
      end if;

      if abs(v_base_rate-v_expected_rate)>.02 then
        raise exception using errcode='22023',message='La tarifa base cambió en Tarifas y disponibilidad. Volvé a revisar la reserva antes de guardarla.';
      end if;

      v_effective_expected_rate := greatest(0,v_expected_rate+v_plan_nightly);
      if abs(v_rate-v_effective_expected_rate)>.02 then
        raise exception using errcode='22023',message='El precio del plan tarifario ya no coincide con la tarifa base. Volvé a revisar la reserva antes de guardarla.';
      end if;
      v_expected_total := greatest(0,v_expected_total+v_plan_nightly*v_nights);

    elsif v_source = 'calendar_sold_category' then
      if v_sold_category is null then
        raise exception using errcode='22023',message='Falta la categoría vendida para validar la tarifa.';
      end if;

      with daily as (
        select c.stay_date,min(c.price) as min_price,max(c.price) as max_price
        from public.hotel_rate_calendar c
        join public.habitaciones h on h.id=c.habitacion_id and h.property_id=c.property_id
        where c.property_id=new.property_id
          and h.activa=true
          and h.tipo=v_sold_category
          and c.stay_date>=v_start
          and c.stay_date<v_end
        group by c.stay_date
      )
      select count(*),avg(min_price),sum(min_price),count(*) filter(where abs(max_price-min_price)>.005)
      into v_days,v_expected_rate,v_expected_total,v_divergent
      from daily;

      if v_days<>v_nights then
        raise exception using errcode='22023',message=format('Falta una tarifa de calendario para la categoría vendida %s entre %s y %s. Definila o usá una tarifa manual explícita.',v_sold_category,v_start,v_end);
      end if;
      if v_divergent>0 then
        raise exception using errcode='22023',message=format('La categoría %s tiene tarifas distintas entre habitaciones. Usá una tarifa manual explícita o unificá la categoría.',v_sold_category);
      end if;
      if abs(v_base_rate-v_expected_rate)>.02 then
        raise exception using errcode='22023',message='La tarifa base de la categoría vendida cambió en Tarifas y disponibilidad. Volvé a revisar la reserva antes de guardarla.';
      end if;

      v_effective_expected_rate := greatest(0,v_expected_rate+v_plan_nightly);
      if abs(v_rate-v_effective_expected_rate)>.02 then
        raise exception using errcode='22023',message='El precio del plan tarifario ya no coincide con la tarifa base de la categoría vendida. Volvé a revisar la reserva antes de guardarla.';
      end if;
      v_expected_total := greatest(0,v_expected_total+v_plan_nightly*v_nights);

    else
      raise exception using errcode='22023',message='La reserva contiene una fuente de tarifa inválida.';
    end if;

    v_lodging_total := v_lodging_total + coalesce(v_expected_total,0);
    v_rate_sum := v_rate_sum + v_rate;
  end loop;

  if abs(coalesce(new.subtotal,0)-v_lodging_total)>.05 then
    raise exception using errcode='22023',message='El total de alojamiento ya no coincide con Tarifas y disponibilidad y el plan tarifario. Volvé a revisar la reserva.';
  end if;
  if abs(coalesce(new.tarifa_noche,0)-v_rate_sum)>.05 then
    raise exception using errcode='22023',message='La tarifa nocturna de la reserva no coincide con el detalle de habitaciones.';
  end if;

  return new;
end;
$$;

commit;
