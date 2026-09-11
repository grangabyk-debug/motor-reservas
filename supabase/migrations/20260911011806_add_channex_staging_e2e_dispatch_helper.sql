create or replace function public.hl_run_channex_staging_e2e_action(p_action text, p_booking_id text default null, p_ota_code text default null)
returns bigint
language plpgsql
security definer
set search_path = public, private, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
  v_body jsonb;
begin
  if coalesce(nullif(current_setting('request.jwt.claim.role', true),''), 'service_role') <> 'service_role' then
    raise exception 'Operación restringida';
  end if;

  select secret_value into v_token
  from private.hl_channel_dispatch_secrets
  where name='channex_staging_processor';

  if v_token is null then
    raise exception 'Dispatch token STAGING no configurado';
  end if;

  v_body := jsonb_build_object('action', p_action, 'dispatch_token', v_token);
  if p_booking_id is not null then v_body := v_body || jsonb_build_object('booking_id', p_booking_id); end if;
  if p_ota_code is not null then v_body := v_body || jsonb_build_object('ota_code', p_ota_code); end if;

  select net.http_post(
    url := 'https://kklvahycvojoktacpyiu.supabase.co/functions/v1/channex-auto-booking-test-staging',
    body := v_body,
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 10000
  ) into v_request_id;

  return v_request_id;
end;
$$;

revoke all on function public.hl_run_channex_staging_e2e_action(text,text,text) from public, anon, authenticated;
grant execute on function public.hl_run_channex_staging_e2e_action(text,text,text) to service_role;
