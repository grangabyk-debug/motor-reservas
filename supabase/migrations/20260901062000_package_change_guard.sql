create or replace function private.hl_guard_packaged_reservation_changes()
returns trigger
language plpgsql
set search_path='public','private','pg_temp'
as $$
begin
  if old.package_id is not null
     and new.package_id is not distinct from old.package_id
     and (
       new.habitacion_id is distinct from old.habitacion_id
       or new.habitaciones_ids is distinct from old.habitaciones_ids
       or new.fecha_entrada is distinct from old.fecha_entrada
       or new.fecha_salida is distinct from old.fecha_salida
       or new.tipo_estadia is distinct from old.tipo_estadia
       or new.moneda is distinct from old.moneda
     ) then
    raise exception using
      errcode='P0001',
      message='Esta reserva tiene un pack aplicado. Quitá el pack antes de cambiar habitación, fechas, tipo de estadía o moneda y volvé a aplicarlo después. Así evitamos que una promoción quede mal tarifada.';
  end if;
  return new;
end;
$$;

drop trigger if exists hl_guard_packaged_reservation_changes_trg on public.reservas;
create trigger hl_guard_packaged_reservation_changes_trg
before update of habitacion_id,habitaciones_ids,fecha_entrada,fecha_salida,tipo_estadia,moneda,package_id
on public.reservas
for each row execute function private.hl_guard_packaged_reservation_changes();
