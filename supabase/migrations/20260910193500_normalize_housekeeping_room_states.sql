-- Habitación Llena · unificar el estado visual de Housekeeping.
-- `libre` era un estado legacy que la UI mostraba como "Lista".
-- Desde ahora una habitación operativamente lista se representa como `inspeccionada`.

update public.habitaciones
set estado = 'inspeccionada'
where lower(coalesce(estado,'')) in ('libre','disponible');

alter table public.habitaciones
  alter column estado set default 'inspeccionada';

create or replace function private.hl_normalize_room_housekeeping_state()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
begin
  if lower(coalesce(new.estado,'')) in ('libre','disponible') then
    new.estado := 'inspeccionada';
  elsif lower(coalesce(new.estado,'')) = 'en_limpieza' then
    new.estado := 'limpieza';
  end if;
  return new;
end;
$$;

revoke all on function private.hl_normalize_room_housekeeping_state() from public;

drop trigger if exists trg_hl_normalize_room_housekeeping_state on public.habitaciones;
create trigger trg_hl_normalize_room_housekeeping_state
before insert or update of estado on public.habitaciones
for each row execute function private.hl_normalize_room_housekeeping_state();
