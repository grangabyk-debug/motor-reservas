-- Habitación Llena — contrato estructural multi-tenant
-- READ ONLY. Diseñado para ejecutarse en preview/staging y CI.
-- Falla si una tabla pública con property_id queda sin RLS o sin políticas.

DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(format('%I (rls=%s, policies=%s)',q.table_name,q.rls_enabled,q.policy_count),', ')
  INTO v_bad
  FROM (
    SELECT c.relname AS table_name,
           c.relrowsecurity AS rls_enabled,
           (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relkind='r'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid=c.oid AND a.attname='property_id' AND a.attnum>0 AND NOT a.attisdropped
      )
  ) q
  WHERE NOT q.rls_enabled
     OR (q.policy_count=0 AND q.table_name NOT IN ('hotel_arca_credentials','hotel_arca_wsaa_cache'));

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Tenant contract failed: %',v_bad;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('private.user_has_property_access(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Missing private.user_has_property_access(uuid)';
  END IF;
  IF to_regprocedure('private.user_has_property_role(uuid,text[])') IS NULL THEN
    RAISE EXCEPTION 'Missing private.user_has_property_role(uuid,text[])';
  END IF;
END $$;

-- Las tablas ARCA listadas arriba son excepciones deliberadas: RLS habilitado y
-- cero políticas significa que el cliente no puede leerlas/escribirlas. Deben
-- permanecer server-only y no recibir grants al navegador para "silenciar" un linter.

SELECT 'tenant_schema_contract_ok' AS result;
