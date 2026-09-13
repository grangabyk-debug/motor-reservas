-- Habitación Llena — integridad relacional global entre tenants
-- READ ONLY. Falla si cualquier FK entre dos tablas con property_id cruza propiedades.

DO $$
DECLARE
  r record;
  join_pred text;
  mismatch_count bigint;
  failures text := '';
BEGIN
  FOR r IN
    SELECT con.oid,con.conname,ns.nspname src_schema,src.relname src_table,
           nt.nspname tgt_schema,tgt.relname tgt_table,
           con.conrelid,con.confrelid,con.conkey,con.confkey
    FROM pg_constraint con
    JOIN pg_class src ON src.oid=con.conrelid
    JOIN pg_namespace ns ON ns.oid=src.relnamespace
    JOIN pg_class tgt ON tgt.oid=con.confrelid
    JOIN pg_namespace nt ON nt.oid=tgt.relnamespace
    WHERE con.contype='f'
      AND ns.nspname='public' AND nt.nspname='public'
      AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=src.oid AND a.attname='property_id' AND a.attnum>0 AND NOT a.attisdropped)
      AND EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=tgt.oid AND a.attname='property_id' AND a.attnum>0 AND NOT a.attisdropped)
  LOOP
    SELECT string_agg(format('c.%I = p.%I',sa.attname,ta.attname),' AND ' ORDER BY u.ord)
    INTO join_pred
    FROM unnest(r.conkey,r.confkey) WITH ORDINALITY u(src_attnum,tgt_attnum,ord)
    JOIN pg_attribute sa ON sa.attrelid=r.conrelid AND sa.attnum=u.src_attnum
    JOIN pg_attribute ta ON ta.attrelid=r.confrelid AND ta.attnum=u.tgt_attnum;

    EXECUTE format(
      'SELECT count(*) FROM %I.%I c JOIN %I.%I p ON %s WHERE c.property_id IS DISTINCT FROM p.property_id',
      r.src_schema,r.src_table,r.tgt_schema,r.tgt_table,join_pred
    ) INTO mismatch_count;

    IF mismatch_count>0 THEN
      failures:=failures||format('%s (%s -> %s): %s; ',r.conname,r.src_table,r.tgt_table,mismatch_count);
    END IF;
  END LOOP;

  IF failures<>'' THEN
    RAISE EXCEPTION 'Cross-tenant FK mismatches: %',failures;
  END IF;
END $$;

SELECT 'tenant_relational_integrity_ok' AS result;
