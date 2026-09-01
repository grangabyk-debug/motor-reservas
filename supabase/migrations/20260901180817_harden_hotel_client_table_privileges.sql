do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
      and (
        tablename = any(array['properties','property_members','alojamientos','habitaciones','reservas','pagos','bloqueos'])
        or tablename like 'hotel\_%' escape '\'
      )
  loop
    execute format(
      'revoke truncate, references, trigger, maintain on table %I.%I from anon, authenticated',
      r.schemaname,
      r.tablename
    );
  end loop;
end
$$;

-- The Planning history UI needs tenant-scoped row access. RLS remains authoritative.
grant select, insert, update on table public.hotel_planning_operation_log to authenticated;
revoke all on table public.hotel_planning_operation_log from anon;

-- Migrations run as postgres. Keep future PMS tables from inheriting structural client privileges.
alter default privileges in schema public
  revoke truncate, references, trigger, maintain on tables from anon, authenticated;
