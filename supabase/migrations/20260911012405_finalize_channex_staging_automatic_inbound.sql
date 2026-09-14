drop trigger if exists trg_hl_dispatch_channex_staging_inbox on public.hotel_channel_inbox;
drop function if exists public.hl_dispatch_channex_staging_inbox();
drop function if exists public.hl_run_channex_staging_e2e_action(text,text,text);
drop function if exists private.hl_trigger_channex_webhook_admin_staging();
drop function if exists public.hl_validate_channex_staging_dispatch_token(text);
delete from private.hl_channel_dispatch_secrets where name='channex_staging_processor';
