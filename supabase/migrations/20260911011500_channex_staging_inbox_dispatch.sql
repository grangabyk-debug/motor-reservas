create extension if not exists pg_net with schema extensions;

create table if not exists private.hl_channel_dispatch_secrets (
  name text primary key,
  secret_value text not null,
  created_at timestamptz not null default now()
);

revoke all on private.hl_channel_dispatch_secrets from public, anon, authenticated;

insert into private.hl_channel_dispatch_secrets(name, secret_value)
values ('channex_staging_processor', encode(gen_random_bytes(32), 'hex'))
on conflict (name) do nothing;

create or replace function public.hl_validate_channex_staging_dispatch_token(p_token text)
returns boolean
language sql
security definer
set search_path = public, private, pg_temp
as $$
  select exists(
    select 1
    from private.hl_channel_dispatch_secrets s
    where s.name='channex_staging_processor'
      and s.secret_value=p_token
  );
$$;

revoke all on function public.hl_validate_channex_staging_dispatch_token(text) from public, anon, authenticated;
grant execute on function public.hl_validate_channex_staging_dispatch_token(text) to service_role;

create or replace function public.hl_dispatch_channex_staging_inbox()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, net, pg_temp
as $$
declare
  v_token text;
  v_request_id bigint;
begin
  if new.property_id <> '46843e01-b551-41ed-84b6-c8805c0beaa4'::uuid
     or new.connection_id <> '5fe514d4-e0b3-4b6d-9d69-d14ec6dfd5c4'::uuid
     or new.status <> 'pending' then
    return new;
  end if;

  select secret_value into v_token
  from private.hl_channel_dispatch_secrets
  where name='channex_staging_processor';

  if v_token is null then
    raise warning 'Channex STAGING dispatch secret missing';
    return new;
  end if;

  select net.http_post(
    url := 'https://kklvahycvojoktacpyiu.supabase.co/functions/v1/channex-booking-process-staging',
    body := jsonb_build_object(
      'inbox_id', new.id,
      'dispatch_token', v_token
    ),
    headers := '{"Content-Type":"application/json"}'::jsonb,
    timeout_milliseconds := 5000
  ) into v_request_id;

  return new;
exception
  when others then
    raise warning 'Channex STAGING async dispatch failed: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.hl_dispatch_channex_staging_inbox() from public, anon, authenticated;

drop trigger if exists trg_hl_dispatch_channex_staging_inbox on public.hotel_channel_inbox;
create trigger trg_hl_dispatch_channex_staging_inbox
after insert or update of status on public.hotel_channel_inbox
for each row execute function public.hl_dispatch_channex_staging_inbox();
