create or replace function private.enforce_legacy_property_consistency()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_property_id uuid;
begin
  if tg_table_name = 'habitaciones' then
    select a.property_id into parent_property_id
    from public.alojamientos a
    where a.id = new.alojamiento_id;
  elsif tg_table_name = 'reservas' then
    select h.property_id into parent_property_id
    from public.habitaciones h
    where h.id = new.habitacion_id;
  elsif tg_table_name = 'bloqueos' then
    select h.property_id into parent_property_id
    from public.habitaciones h
    where h.id = new.habitacion_id;
  elsif tg_table_name = 'pagos' then
    select r.property_id into parent_property_id
    from public.reservas r
    where r.id = new.reserva_id;
  else
    return new;
  end if;

  if parent_property_id is null then
    raise exception 'No se pudo determinar property_id del registro padre para %.%', tg_table_name, coalesce(new.id::text, '?');
  end if;

  if new.property_id is distinct from parent_property_id then
    raise exception 'property_id inconsistente en %: el registro hijo no pertenece a la misma propiedad que su padre', tg_table_name;
  end if;

  return new;
end;
$$;

drop trigger if exists habitaciones_property_consistency on public.habitaciones;
create trigger habitaciones_property_consistency
before insert or update of alojamiento_id, property_id on public.habitaciones
for each row execute function private.enforce_legacy_property_consistency();

drop trigger if exists reservas_property_consistency on public.reservas;
create trigger reservas_property_consistency
before insert or update of habitacion_id, property_id on public.reservas
for each row execute function private.enforce_legacy_property_consistency();

drop trigger if exists bloqueos_property_consistency on public.bloqueos;
create trigger bloqueos_property_consistency
before insert or update of habitacion_id, property_id on public.bloqueos
for each row execute function private.enforce_legacy_property_consistency();

drop trigger if exists pagos_property_consistency on public.pagos;
create trigger pagos_property_consistency
before insert or update of reserva_id, property_id on public.pagos
for each row execute function private.enforce_legacy_property_consistency();

revoke all on function private.enforce_legacy_property_consistency() from public;
