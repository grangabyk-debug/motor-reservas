CREATE OR REPLACE FUNCTION private.hl_reconcile_reservation_service_tax_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_old_services numeric := 0;
  v_new_services numeric := 0;
  v_delta numeric := 0;
  v_old_net numeric := 0;
  v_new_net numeric := 0;
  v_corrected_net numeric := 0;
  v_rate numeric := 0;
  v_old_tax numeric := 0;
  v_corrected_tax numeric := 0;
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
  v_rate := greatest(0,coalesce(new.iva_porcentaje,0));
  v_old_tax := greatest(0,coalesce(old.iva_importe,0));

  if abs(v_new_net-v_old_net) < 0.005 then
    v_corrected_net := greatest(0,v_old_net+v_delta);
    v_corrected_tax := greatest(0,round(v_old_tax + round(v_delta*v_rate/100,2),2));
  elsif abs((v_new_net-v_old_net)-v_delta) < 0.005 then
    -- El caller ya incorporó exactamente el cambio de servicios al neto.
    -- Conservamos el redondeo fiscal acumulado y aplicamos sólo el IVA incremental.
    v_corrected_net := greatest(0,v_new_net);
    v_corrected_tax := greatest(0,round(v_old_tax + round(v_delta*v_rate/100,2),2));
  else
    -- Hay además un cambio comercial ajeno a servicios: recalcular desde la nueva base.
    v_corrected_net := greatest(0,v_new_net);
    v_corrected_tax := round(v_corrected_net*v_rate/100,2);
  end if;

  new.subtotal := round(v_corrected_net,2);
  new.precio_sin_impuestos_nacionales := round(v_corrected_net,2);
  new.iva_importe := round(v_corrected_tax,2);
  new.precio_total := round(v_corrected_net+v_corrected_tax,2);

  return new;
end;
$function$

