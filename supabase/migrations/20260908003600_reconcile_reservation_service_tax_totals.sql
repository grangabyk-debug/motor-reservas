create or replace function private.hl_services_base_total(p_services jsonb)
returns numeric
language sql
immutable
set search_path = public, pg_temp
as $$
  select coalesce(sum(
    case
      when nullif(item->>'total','') is not null then (item->>'total')::numeric
      when nullif(item->>'precio_total','') is not null then (item->>'precio_total')::numeric
      else
        coalesce(nullif(item->>'precio','')::numeric, nullif(item->>'price','')::numeric, 0)
        * greatest(coalesce(nullif(item->>'cantidad','')::numeric, nullif(item->>'qty','')::numeric, 1), 0)
        * case
            when coalesce(item->>'modo_cobro','') in ('per_night','per_person_night')
              then greatest(coalesce(nullif(item->>'noches','')::numeric, 1), 1)
            else 1
          end
    end
  ),0)
  from jsonb_array_elements(
    case when jsonb_typeof(coalesce(p_services,'[]'::jsonb))='array'
      then coalesce(p_services,'[]'::jsonb)
      else '[]'::jsonb
    end
  ) as item;
$$;

create or replace function private.hl_reconcile_reservation_service_tax_totals()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_old_services numeric := 0;
  v_new_services numeric := 0;
  v_delta numeric := 0;
  v_old_net numeric := 0;
  v_new_net numeric := 0;
  v_corrected_net numeric := 0;
  v_rate numeric := 0;
begin
  if new.servicios is not distinct from old.servicios then
    return new;
  end if;

  if not coalesce(new.impuestos_desglosados,false) then
    return new;
  end if;

  v_old_services := private.hl_services_base_total(old.servicios);
  v_new_services := private.hl_services_base_total(new.servicios);
  v_delta := v_new_services - v_old_services;

  if abs(v_delta) < 0.005 then
    return new;
  end if;

  v_old_net := coalesce(
    old.precio_sin_impuestos_nacionales,
    old.subtotal,
    greatest(coalesce(old.precio_total,0)-coalesce(old.iva_importe,0),0),
    0
  );
  v_new_net := coalesce(new.precio_sin_impuestos_nacionales,new.subtotal,v_old_net);

  if abs(v_new_net-v_old_net) < 0.005 then
    v_corrected_net := greatest(0,v_old_net+v_delta);
  else
    v_corrected_net := greatest(0,v_new_net);
  end if;

  v_rate := greatest(0,coalesce(new.iva_porcentaje,0));
  new.subtotal := round(v_corrected_net,2);
  new.precio_sin_impuestos_nacionales := round(v_corrected_net,2);
  new.iva_importe := round(v_corrected_net*v_rate/100,2);
  new.precio_total := round(v_corrected_net+new.iva_importe,2);

  return new;
end;
$$;

drop trigger if exists trg_hl_reconcile_reservation_service_tax_totals on public.reservas;
create trigger trg_hl_reconcile_reservation_service_tax_totals
before update of servicios on public.reservas
for each row
execute function private.hl_reconcile_reservation_service_tax_totals();
