insert into private.hl_channel_dispatch_secrets(name, secret_value)
values ('channex_staging_webhook', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function public.hl_validate_channex_staging_webhook_token(p_token text)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select exists(
    select 1
    from private.hl_channel_dispatch_secrets s
    where s.name='channex_staging_webhook'
      and s.secret_value=p_token
  );
$$;

revoke all on function public.hl_validate_channex_staging_webhook_token(text) from public, anon, authenticated;
grant execute on function public.hl_validate_channex_staging_webhook_token(text) to service_role;

create or replace function public.hl_get_channex_staging_webhook_token()
returns text
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select secret_value
  from private.hl_channel_dispatch_secrets
  where name='channex_staging_webhook';
$$;

revoke all on function public.hl_get_channex_staging_webhook_token() from public, anon, authenticated;
grant execute on function public.hl_get_channex_staging_webhook_token() to service_role;
