create extension if not exists pg_cron;

insert into private.hl_channel_dispatch_secrets(name, secret_value)
values ('channex_staging_reconcile', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function public.hl_validate_channex_staging_reconcile_token(p_token text)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select exists(
    select 1
    from private.hl_channel_dispatch_secrets s
    where s.name='channex_staging_reconcile'
      and s.secret_value=p_token
  );
$$;

revoke all on function public.hl_validate_channex_staging_reconcile_token(text) from public, anon, authenticated;
grant execute on function public.hl_validate_channex_staging_reconcile_token(text) to service_role;

create or replace function private.hl_run_channex_staging_reconcile()
returns bigint
language plpgsql
security definer
set search_path = public, private, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select secret_value into v_token
  from private.hl_channel_dispatch_secrets
  where name='channex_staging_reconcile';

  if v_token is null then
    raise exception 'Channex STAGING reconciliation token missing';
  end if;

  select net.http_post(
    url := 'https://kklvahycvojoktacpyiu.supabase.co/functions/v1/channex-booking-reconcile-staging',
    body := jsonb_build_object('reconcile_token', v_token),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 25000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.hl_run_channex_staging_reconcile() from public, anon, authenticated;
grant execute on function private.hl_run_channex_staging_reconcile() to service_role;

do $cleanup$
declare
  v_jobid bigint;
begin
  select jobid into v_jobid from cron.job where jobname='hl-channex-staging-reconcile' limit 1;
  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end;
$cleanup$;

select cron.schedule(
  'hl-channex-staging-reconcile',
  '*/5 * * * *',
  $job$select private.hl_run_channex_staging_reconcile();$job$
);
