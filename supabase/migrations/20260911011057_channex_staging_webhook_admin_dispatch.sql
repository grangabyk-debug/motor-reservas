create or replace function private.hl_trigger_channex_webhook_admin_staging()
returns bigint
language plpgsql
security definer
set search_path = public, private, extensions, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  select secret_value into v_token
  from private.hl_channel_dispatch_secrets
  where name='channex_staging_processor';

  if v_token is null then
    raise exception 'Channex STAGING processor token missing';
  end if;

  select net.http_post(
    url := 'https://kklvahycvojoktacpyiu.supabase.co/functions/v1/channex-webhook-admin-staging',
    body := jsonb_build_object('dispatch_token', v_token),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function private.hl_trigger_channex_webhook_admin_staging() from public, anon, authenticated;
grant execute on function private.hl_trigger_channex_webhook_admin_staging() to service_role;
