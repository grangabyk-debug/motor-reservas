-- These checks are intentionally read-only. Run them against a non-production/test
-- database with the appropriate authenticated test sessions when possible.

-- 1) Every legacy tenant-scoped row must have a property_id.
select 'alojamientos' as table_name, count(*) as missing_property_id
from public.alojamientos where property_id is null
union all
select 'habitaciones', count(*) from public.habitaciones where property_id is null
union all
select 'reservas', count(*) from public.reservas where property_id is null
union all
select 'bloqueos', count(*) from public.bloqueos where property_id is null
union all
select 'pagos', count(*) from public.pagos where property_id is null;

-- 2) Tenant integrity: child records must belong to the same property as their parent.
select 'habitaciones_vs_alojamientos' as check_name, count(*) as mismatches
from public.habitaciones h
join public.alojamientos a on a.id = h.alojamiento_id
where h.property_id <> a.property_id
union all
select 'reservas_vs_habitaciones', count(*)
from public.reservas r
join public.habitaciones h on h.id = r.habitacion_id
where r.property_id <> h.property_id
union all
select 'bloqueos_vs_habitaciones', count(*)
from public.bloqueos b
join public.habitaciones h on h.id = b.habitacion_id
where b.property_id <> h.property_id
union all
select 'pagos_vs_reservas', count(*)
from public.pagos p
join public.reservas r on r.id = p.reserva_id
where p.property_id <> r.property_id;

-- 3) Membership uniqueness: a user should not have duplicate membership rows
-- for the same property.
select property_id, user_id, count(*)
from public.property_members
group by property_id, user_id
having count(*) > 1;

-- 4) Verify RLS is enabled for tenant-sensitive tables.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'properties', 'property_members', 'alojamientos', 'habitaciones',
    'reservas', 'bloqueos', 'pagos', 'units', 'reservations',
    'integration_connections', 'inbox_conversations', 'inbox_messages'
  )
order by tablename;

-- 5) List policies for audit.
select schemaname, tablename, policyname, permissive, roles, cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'properties', 'property_members', 'alojamientos', 'habitaciones',
    'reservas', 'bloqueos', 'pagos', 'units', 'reservations',
    'integration_connections', 'inbox_conversations', 'inbox_messages'
  )
order by tablename, policyname;

-- 6) Check tenant foreign-key indexes recommended by the security/performance
-- audit. This is informational and does not modify the database.
select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'alojamientos_property_id_idx',
    'habitaciones_property_id_idx',
    'reservas_property_id_idx',
    'bloqueos_property_id_idx',
    'pagos_property_id_idx',
    'idx_property_members_user_id',
    'idx_units_property_id',
    'idx_reservations_property_id'
  )
order by tablename, indexname;

-- 7) RLS isolation smoke test.
-- Replace the UUID below with a real authenticated test user who has no
-- membership in the target property. The expected result for every table is 0.
-- Run inside a transaction so the session claims are not persisted.
--
-- begin;
-- set local role authenticated;
-- set local request.jwt.claims = '{"role":"authenticated","sub":"TEST_USER_UUID"}';
-- select 'properties' as table_name, count(*) from public.properties
-- union all select 'alojamientos', count(*) from public.alojamientos
-- union all select 'habitaciones', count(*) from public.habitaciones
-- union all select 'reservas', count(*) from public.reservas
-- union all select 'bloqueos', count(*) from public.bloqueos
-- union all select 'pagos', count(*) from public.pagos;
-- rollback;
