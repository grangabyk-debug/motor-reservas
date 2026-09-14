create or replace function private.hl_keep_single_room_move_consistent()
returns trigger
language plpgsql
set search_path = public, private, pg_temp
as $$
declare
  v_room_ids bigint[];
  v_room_id bigint;
  v_units integer;
  v_net numeric;
  v_vat numeric;
  v_rate numeric;
  v_final numeric;
begin
  v_room_ids := array(
    select distinct x
    from unnest(coalesce(new.habitaciones_ids, '{}'::bigint[]) || array[new.habitacion_id]::bigint[]) as q(x)
    where x is not null
  );

  if cardinality(coalesce(v_room_ids, '{}'::bigint[])) <> 1 then
    return new;
  end if;

  v_room_id := v_room_ids[1];
  v_units := case
    when coalesce(new.tipo_estadia, 'overnight') = 'day_use' then 0
    else greatest(1, coalesce(new.noches, new.fecha_salida - new.fecha_entrada, 1))
  end;

  if jsonb_typeof(coalesce(new.habitaciones_detalle, '[]'::jsonb)) = 'array' then
    select coalesce(jsonb_agg(
      case
        when coalesce(elem->>'habitacion_id','') ~ '^\d+$'
          and (elem->>'habitacion_id')::bigint = v_room_id
        then elem || jsonb_build_object(
          'habitacion_id', v_room_id,
          'fecha_entrada', new.fecha_entrada,
          'fecha_salida', new.fecha_salida,
          'noches', v_units
        )
        else elem
      end
      order by ord
    ), '[]'::jsonb)
    into new.habitaciones_detalle
    from jsonb_array_elements(coalesce(new.habitaciones_detalle, '[]'::jsonb)) with ordinality as t(elem,ord);
  end if;

  v_net := greatest(0, coalesce(new.subtotal, new.precio_sin_impuestos_nacionales, new.precio_total, 0) - greatest(0, coalesce(new.descuento_importe,0)));

  if coalesce(new.impuestos_desglosados,false) then
    v_rate := greatest(0, coalesce(new.iva_porcentaje,0));
    v_vat := round(v_net * v_rate / 100, 2);
  else
    v_rate := 0;
    v_vat := 0;
  end if;

  v_final := round(v_net + v_vat, 2);
  new.precio_sin_impuestos_nacionales := round(v_net,2);
  new.iva_importe := v_vat;
  new.precio_total := v_final;
  if coalesce(new.tipo_cambio,0) > 0 then
    new.precio_total_usd := round(v_final / new.tipo_cambio,2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reservas_single_room_move_consistency on public.reservas;
create trigger trg_reservas_single_room_move_consistency
before update of habitacion_id, habitaciones_ids, fecha_entrada, fecha_salida, noches, tarifa_noche
on public.reservas
for each row
execute function private.hl_keep_single_room_move_consistent();
