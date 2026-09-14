-- Habitaciones modernas: configuración de camas, propiedad directa y secuencia de IDs sana.

alter table public.habitaciones
  add column if not exists bed_configuration text;

create or replace function private.enforce_legacy_property_consistency()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  parent_property_id uuid;
begin
  if tg_table_name = 'habitaciones' then
    -- El PMS actual permite habitaciones directamente vinculadas a la propiedad.
    -- Si existe alojamiento_id legado, se sigue validando contra su propiedad.
    if new.alojamiento_id is null then
      parent_property_id := new.property_id;
    else
      select a.property_id into parent_property_id
      from public.alojamientos a
      where a.id = new.alojamiento_id;
    end if;
  elsif tg_table_name = 'reservas' then
    if new.habitacion_id is null then
      parent_property_id := new.property_id;
    else
      select h.property_id into parent_property_id
      from public.habitaciones h
      where h.id = new.habitacion_id;
    end if;
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
    raise exception 'No se pudo determinar property_id del registro padre para %.%',
      tg_table_name, coalesce(new.id::text, '?');
  end if;

  if new.property_id is distinct from parent_property_id then
    raise exception 'property_id inconsistente en %: el registro hijo no pertenece a la misma propiedad que su padre',
      tg_table_name;
  end if;

  return new;
end;
$function$;

-- Algunas cargas históricas adelantaron los IDs sin sincronizar la secuencia.
-- La dejamos siempre al menos en el máximo existente antes de crear nuevas habitaciones.
do $do$
declare
  v_sequence text;
  v_max_id bigint;
begin
  v_sequence := pg_get_serial_sequence('public.habitaciones','id');
  select coalesce(max(id),0) into v_max_id from public.habitaciones;
  if v_sequence is not null then
    perform setval(v_sequence, greatest(v_max_id,1), true);
  end if;
end;
$do$;

notify pgrst, 'reload schema';
