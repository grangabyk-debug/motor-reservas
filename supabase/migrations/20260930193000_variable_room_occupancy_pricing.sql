-- Habitación Llena · ocupación variable por noche
-- Si una habitación tiene occupancy_nights, cualquier sincronización automática del folio
-- usa la suma real de esas noches en vez de tarifa_noche * cantidad de noches.

create or replace function private.hl_apply_variable_occupancy_folio_row()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  r public.reservas%rowtype;
  v_nights integer:=0;
  v_net numeric:=0;
begin
  if new.reservation_id is null or new.room_id is null or lower(coalesce(new.source_type,''))<>'lodging' or new.invoice_document_id is not null then
    return new;
  end if;

  select * into r from public.reservas where id=new.reservation_id;
  if not found then return new; end if;

  select count(*),coalesce(sum((n->>'net_rate')::numeric),0)
    into v_nights,v_net
  from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) d
  cross join lateral jsonb_array_elements(case when jsonb_typeof(d->'occupancy_nights')='array' then d->'occupancy_nights' else '[]'::jsonb end) n
  where coalesce(d->>'habitacion_id','')~'^[0-9]+$'
    and (d->>'habitacion_id')::bigint=new.room_id
    and coalesce(n->>'net_rate','')~'^[0-9]+([.][0-9]+)?$';

  if v_nights>0 then
    v_net:=round(v_net,2);
    new.quantity:=v_nights;
    new.unit_price:=round(v_net/v_nights,2);
    new.subtotal:=v_net;
    if coalesce(r.impuestos_desglosados,false) then
      new.tax_rate:=coalesce(r.iva_porcentaje,0);
      new.tax:=round(v_net*coalesce(r.iva_porcentaje,0)/100,2);
      new.total:=round(v_net+new.tax,2);
    else
      new.tax_rate:=0;new.tax:=0;new.total:=v_net;
    end if;
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('variable_occupancy',true,'variable_occupancy_nights',v_nights,'variable_occupancy_net_total',v_net);
  else
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)-'variable_occupancy'-'variable_occupancy_nights'-'variable_occupancy_net_total';
  end if;
  return new;
end
$$;

drop trigger if exists zz_hl_apply_variable_occupancy_folio_row on public.hotel_folio_items;
create trigger zz_hl_apply_variable_occupancy_folio_row
before insert or update of quantity,unit_price,subtotal,tax_rate,tax,total,metadata
on public.hotel_folio_items
for each row execute function private.hl_apply_variable_occupancy_folio_row();
