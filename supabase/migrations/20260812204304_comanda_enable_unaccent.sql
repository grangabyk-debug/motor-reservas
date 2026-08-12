create extension if not exists unaccent with schema extensions;
alter function public.comanda_bootstrap_account(text) set search_path=pg_catalog,public,extensions;