alter table public.hotel_guarantees add column if not exists cardholder_name text;
alter table public.hotel_guarantees add column if not exists source_channel text;
alter table public.hotel_guarantees add column if not exists source_reference text;
alter table public.hotel_guarantees add column if not exists secure_reference text;
alter table public.hotel_guarantees add column if not exists reveal_count integer not null default 0;
alter table public.hotel_guarantees add column if not exists reveal_window_started_at timestamptz;
alter table public.hotel_guarantees add column if not exists last_revealed_at timestamptz;
alter table public.hotel_guarantees add column if not exists secure_access_expires_at timestamptz;
alter table public.hotel_guarantees add column if not exists purge_at timestamptz;
alter table public.hotel_guarantees add column if not exists deleted_at timestamptz;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='hotel_guarantees_reveal_count_check' and conrelid='public.hotel_guarantees'::regclass) then
    alter table public.hotel_guarantees add constraint hotel_guarantees_reveal_count_check check(reveal_count between 0 and 3);
  end if;
end $$;

create table if not exists public.hotel_guarantee_access_events(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  guarantee_id uuid not null references public.hotel_guarantees(id) on delete cascade,
  action text not null check(action in ('reveal','reveal_denied','purged')),
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists hotel_guarantee_access_events_lookup_idx on public.hotel_guarantee_access_events(property_id,reservation_id,created_at desc);
alter table public.hotel_guarantee_access_events enable row level security;
revoke all on public.hotel_guarantee_access_events from anon;
grant select,insert on public.hotel_guarantee_access_events to authenticated;
drop policy if exists hotel_guarantee_access_events_select on public.hotel_guarantee_access_events;
create policy hotel_guarantee_access_events_select on public.hotel_guarantee_access_events for select to authenticated using(private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));
drop policy if exists hotel_guarantee_access_events_insert on public.hotel_guarantee_access_events;
create policy hotel_guarantee_access_events_insert on public.hotel_guarantee_access_events for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit']::text[]));

drop policy if exists hotel_guarantees_select_access on public.hotel_guarantees;
create policy hotel_guarantees_select_secure_roles on public.hotel_guarantees for select to authenticated using(private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit']::text[]));

create or replace function public.hl_register_guarantee_reveal(p_guarantee_id uuid)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  g public.hotel_guarantees%rowtype;
  v_started timestamptz;
  v_count integer;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into g from public.hotel_guarantees where id=p_guarantee_id for update;
  if not found then raise exception using errcode='P0002',message='Garantía inexistente.'; end if;
  if not private.user_has_property_role(g.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permiso para visualizar datos de garantía.'; end if;
  if g.deleted_at is not null or (g.purge_at is not null and g.purge_at<=now()) then
    insert into public.hotel_guarantee_access_events(property_id,reservation_id,guarantee_id,action,actor_user_id,metadata) values(g.property_id,g.reserva_id,g.id,'reveal_denied',auth.uid(),jsonb_build_object('reason','expired'));
    raise exception using errcode='P0001',message='Los datos seguros de esta tarjeta ya expiraron.';
  end if;
  if nullif(g.secure_reference,'') is null and coalesce((g.metadata->>'qa_simulated')::boolean,false)=false then
    insert into public.hotel_guarantee_access_events(property_id,reservation_id,guarantee_id,action,actor_user_id,metadata) values(g.property_id,g.reserva_id,g.id,'reveal_denied',auth.uid(),jsonb_build_object('reason','no_secure_reference'));
    raise exception using errcode='P0001',message='Esta garantía no tiene una referencia segura disponible para revelar.';
  end if;
  v_started:=coalesce(g.reveal_window_started_at,now());
  if now()>v_started+interval '30 minutes' then
    insert into public.hotel_guarantee_access_events(property_id,reservation_id,guarantee_id,action,actor_user_id,metadata) values(g.property_id,g.reserva_id,g.id,'reveal_denied',auth.uid(),jsonb_build_object('reason','window_expired'));
    raise exception using errcode='P0001',message='La ventana de visualización de 30 minutos ya venció.';
  end if;
  if g.reveal_count>=3 then
    insert into public.hotel_guarantee_access_events(property_id,reservation_id,guarantee_id,action,actor_user_id,metadata) values(g.property_id,g.reserva_id,g.id,'reveal_denied',auth.uid(),jsonb_build_object('reason','max_views'));
    raise exception using errcode='P0001',message='Se alcanzó el máximo de 3 visualizaciones permitidas.';
  end if;
  v_count:=g.reveal_count+1;
  update public.hotel_guarantees set reveal_count=v_count,reveal_window_started_at=v_started,last_revealed_at=now(),updated_at=now() where id=g.id;
  insert into public.hotel_guarantee_access_events(property_id,reservation_id,guarantee_id,action,actor_user_id,metadata) values(g.property_id,g.reserva_id,g.id,'reveal',auth.uid(),jsonb_build_object('view_number',v_count,'window_started_at',v_started));
  return jsonb_build_object('guarantee_id',g.id,'view_number',v_count,'views_remaining',3-v_count,'window_expires_at',v_started+interval '30 minutes');
end;
$function$;

revoke all on function public.hl_register_guarantee_reveal(uuid) from public;
revoke all on function public.hl_register_guarantee_reveal(uuid) from anon;
grant execute on function public.hl_register_guarantee_reveal(uuid) to authenticated;
grant execute on function public.hl_register_guarantee_reveal(uuid) to service_role;

create or replace function private.hl_sync_guarantee_retention()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
begin
  if coalesce(new.no_show,false)=true and coalesce(old.no_show,false)=false then
    update public.hotel_guarantees set purge_at=coalesce(purge_at,now()+interval '7 days'),secure_access_expires_at=coalesce(secure_access_expires_at,now()+interval '7 days'),updated_at=now() where property_id=new.property_id and reserva_id=new.id;
  elsif new.estado='cancelada' and old.estado is distinct from 'cancelada' then
    update public.hotel_guarantees set purge_at=coalesce(purge_at,now()+interval '7 days'),secure_access_expires_at=coalesce(secure_access_expires_at,now()+interval '7 days'),updated_at=now() where property_id=new.property_id and reserva_id=new.id;
  elsif new.estado='finalizada' and old.estado is distinct from 'finalizada' then
    update public.hotel_guarantees set purge_at=coalesce(purge_at,now()+interval '1 month'),secure_access_expires_at=coalesce(secure_access_expires_at,now()+interval '1 month'),updated_at=now() where property_id=new.property_id and reserva_id=new.id;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_hl_sync_guarantee_retention on public.reservas;
create trigger trg_hl_sync_guarantee_retention after update of no_show,estado on public.reservas for each row execute function private.hl_sync_guarantee_retention();