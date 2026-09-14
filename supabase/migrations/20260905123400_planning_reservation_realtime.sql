do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='reservas') then
      execute 'alter publication supabase_realtime add table public.reservas';
    end if;
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='pagos') then
      execute 'alter publication supabase_realtime add table public.pagos';
    end if;
  end if;
end $$;
