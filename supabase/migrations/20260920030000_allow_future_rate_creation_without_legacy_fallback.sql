create or replace function public.hl_set_rate_calendar_pricing(
  p_property_id uuid,
  p_room_ids bigint[],
  p_dates date[],
  p_configured_amount numeric default null,
  p_percent numeric default null,
  p_min_stay integer default null,
  p_open boolean default null,
  p_round_up boolean default false
) returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_room_id bigint;
  v_day date;
  v_current record;
  v_existing public.hotel_rate_calendar%rowtype;
  v_current_breakdown jsonb;
  v_new_breakdown jsonb;
  v_current_commercial numeric;
  v_new_commercial numeric;
  v_new_net numeric;
  v_count integer:=0;
begin
  if auth.uid() is null or not private.user_has_property_role(
    p_property_id,array['owner','admin','manager','revenue']::text[]
  ) then
    raise exception using errcode='42501',message='No tenés permisos para modificar tarifas.';
  end if;
  if coalesce(array_length(p_room_ids,1),0)=0 or coalesce(array_length(p_dates,1),0)=0 then
    raise exception using errcode='22023',message='Elegí habitaciones y fechas.';
  end if;
  if p_configured_amount is not null and p_percent is not null then
    raise exception using errcode='22023',message='Aplicá un precio o un porcentaje, no ambos a la vez.';
  end if;
  if p_configured_amount is not null and p_configured_amount<0 then
    raise exception using errcode='22023',message='El precio no puede ser negativo.';
  end if;
  if p_percent is not null and p_percent<=-100 then
    raise exception using errcode='22023',message='El ajuste porcentual debe ser mayor a -100%.';
  end if;

  foreach v_room_id in array p_room_ids loop
    if not exists(
      select 1 from public.habitaciones
      where id=v_room_id and property_id=p_property_id and activa is distinct from false
    ) then
      raise exception using errcode='P0002',message=format('La habitación %s no existe o está inactiva.',v_room_id);
    end if;

    foreach v_day in array p_dates loop
      select * into v_existing
      from public.hotel_rate_calendar
      where property_id=p_property_id and habitacion_id=v_room_id and stay_date=v_day;

      select * into v_current
      from private.hl_calendar_room_nightly_pricing(p_property_id,v_room_id,v_day,v_day+1)
      limit 1;

      if p_configured_amount is not null then
        v_new_commercial:=p_configured_amount;
        v_new_breakdown:=private.hl_price_breakdown_from_commercial(p_property_id,v_new_commercial);
        v_new_net:=coalesce((v_new_breakdown->>'net_precise')::numeric,(v_new_breakdown->>'net')::numeric,0);
      elsif p_percent is not null then
        if v_current.price is null then
          raise exception using errcode='P0001',
            message=format('No se puede aplicar un porcentaje a la habitación %s el %s porque todavía no tiene tarifa. Primero cargá un precio.',v_room_id,v_day);
        end if;
        v_current_breakdown:=private.hl_price_breakdown_from_net(p_property_id,v_current.price);
        v_current_commercial:=coalesce((v_current_breakdown->>'commercial')::numeric,0);
        v_new_commercial:=v_current_commercial*(1+p_percent/100);
        v_new_commercial:=case when p_round_up then ceil(v_new_commercial) else round(v_new_commercial,2) end;
        v_new_breakdown:=private.hl_price_breakdown_from_commercial(p_property_id,v_new_commercial);
        v_new_net:=coalesce((v_new_breakdown->>'net_precise')::numeric,(v_new_breakdown->>'net')::numeric,0);
      else
        v_new_net:=coalesce(v_existing.price,v_current.price);
      end if;

      insert into public.hotel_rate_calendar(
        property_id,habitacion_id,stay_date,price,min_stay,stop_sell,
        closed_to_arrival,closed_to_departure,notes,updated_at
      ) values(
        p_property_id,v_room_id,v_day,
        case when v_new_net is null then null else round(v_new_net,6) end,
        greatest(1,coalesce(p_min_stay,v_existing.min_stay,1)),
        case when p_open is null then coalesce(v_existing.stop_sell,false) else not p_open end,
        coalesce(v_existing.closed_to_arrival,false),
        coalesce(v_existing.closed_to_departure,false),
        v_existing.notes,now()
      )
      on conflict(property_id,habitacion_id,stay_date) do update set
        price=excluded.price,
        min_stay=excluded.min_stay,
        stop_sell=excluded.stop_sell,
        closed_to_arrival=excluded.closed_to_arrival,
        closed_to_departure=excluded.closed_to_departure,
        notes=excluded.notes,
        updated_at=excluded.updated_at;
      v_count:=v_count+1;
    end loop;
  end loop;

  return jsonb_build_object('updated_rows',v_count,'pricing_version',2);
end;
$$;
