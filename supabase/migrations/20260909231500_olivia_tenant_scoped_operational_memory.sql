create table if not exists public.hotel_olivia_memory (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  memory_type text not null default 'operational_example' check (memory_type in ('operational_example','terminology','preference')),
  phrase_key text not null,
  example_text text not null,
  meaning text not null,
  action_type text not null default 'none' check (action_type in ('none','create_guest_request','create_maintenance_ticket')),
  assigned_area text null check (assigned_area is null or assigned_area in ('reception','housekeeping','maintenance')),
  payload_template jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null default 0.550 check (confidence >= 0 and confidence <= 1),
  positive_count integer not null default 0 check (positive_count >= 0),
  negative_count integer not null default 0 check (negative_count >= 0),
  is_active boolean not null default true,
  learned_from_action uuid null references public.hotel_ai_action_requests(id) on delete set null,
  created_by uuid null,
  updated_by uuid null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,memory_type,phrase_key,action_type)
);

create index if not exists hotel_olivia_memory_property_rank_idx
  on public.hotel_olivia_memory(property_id,is_active,confidence desc,last_seen_at desc);

alter table public.hotel_olivia_memory enable row level security;
drop policy if exists hotel_olivia_memory_property_select on public.hotel_olivia_memory;
create policy hotel_olivia_memory_property_select on public.hotel_olivia_memory
  for select to authenticated
  using (private.user_has_property_access(property_id));

revoke all on table public.hotel_olivia_memory from anon;
revoke insert,update,delete on table public.hotel_olivia_memory from authenticated;
grant select on table public.hotel_olivia_memory to authenticated;

create or replace function olivia_private.hl_olivia_phrase_key(p_text text)
returns text
language sql
immutable
set search_path = public
as $$
  select left(trim(regexp_replace(lower(coalesce(p_text,'')), '[^a-z0-9áéíóúüñ]+', ' ', 'gi')), 240);
$$;

create or replace function olivia_private.hl_olivia_learn_from_action()
returns trigger
language plpgsql
security definer
set search_path = public, private, olivia_private
as $$
declare
  v_source text;
  v_key text;
  v_area text;
  v_meaning text;
  v_positive integer;
  v_negative integer;
begin
  if old.status is not distinct from new.status or new.status not in ('executed','rejected') then return new; end if;
  if new.action_type not in ('create_guest_request','create_maintenance_ticket') then return new; end if;
  v_source := left(trim(coalesce(new.payload->>'olivia_source_text','')), 500);
  if length(v_source) < 3 then return new; end if;
  v_key := olivia_private.hl_olivia_phrase_key(v_source);
  if length(v_key) < 2 then return new; end if;
  v_area := case when new.action_type='create_maintenance_ticket' then 'maintenance' else nullif(new.payload->>'assigned_area','') end;
  if v_area not in ('reception','housekeeping','maintenance') then v_area := null; end if;
  v_meaning := case
    when new.action_type='create_maintenance_ticket' then 'Reportar una incidencia de mantenimiento'
    when v_area='housekeeping' then 'Crear un pedido para Housekeeping'
    when v_area='maintenance' then 'Crear un pedido para Mantenimiento'
    else 'Crear una petición operativa'
  end;
  v_positive := case when new.status='executed' then 1 else 0 end;
  v_negative := case when new.status='rejected' then 1 else 0 end;

  insert into public.hotel_olivia_memory(
    property_id,memory_type,phrase_key,example_text,meaning,action_type,assigned_area,payload_template,
    confidence,positive_count,negative_count,is_active,learned_from_action,created_by,updated_by,last_seen_at
  ) values (
    new.property_id,'operational_example',v_key,v_source,v_meaning,new.action_type,v_area,
    jsonb_strip_nulls(jsonb_build_object('assigned_area',v_area,'priority',nullif(new.payload->>'priority',''))),
    case when new.status='executed' then 0.68 else 0.25 end,
    v_positive,v_negative,new.status='executed',new.id,new.requested_by,coalesce(new.executed_by,new.approved_by,new.requested_by),now()
  )
  on conflict(property_id,memory_type,phrase_key,action_type) do update set
    example_text=excluded.example_text,
    meaning=excluded.meaning,
    assigned_area=coalesce(excluded.assigned_area,public.hotel_olivia_memory.assigned_area),
    payload_template=excluded.payload_template,
    positive_count=public.hotel_olivia_memory.positive_count+v_positive,
    negative_count=public.hotel_olivia_memory.negative_count+v_negative,
    confidence=greatest(0.05,least(0.98,
      0.50 + (public.hotel_olivia_memory.positive_count+v_positive)*0.10 - (public.hotel_olivia_memory.negative_count+v_negative)*0.18
    )),
    is_active=(public.hotel_olivia_memory.positive_count+v_positive) > (public.hotel_olivia_memory.negative_count+v_negative),
    learned_from_action=new.id,
    updated_by=coalesce(new.executed_by,new.approved_by,new.requested_by),
    last_seen_at=now(),updated_at=now();
  return new;
end;
$$;

drop trigger if exists hotel_olivia_memory_action_learning on public.hotel_ai_action_requests;
create trigger hotel_olivia_memory_action_learning
after update of status on public.hotel_ai_action_requests
for each row execute function olivia_private.hl_olivia_learn_from_action();

create or replace function olivia_private.hl_olivia_remember_term_internal(
  p_property_id uuid,
  p_phrase text,
  p_meaning text
) returns jsonb
language plpgsql
security definer
set search_path = public, private, olivia_private
as $$
declare
  v_user uuid := auth.uid();
  v_phrase text := left(trim(coalesce(p_phrase,'')),120);
  v_meaning text := left(trim(coalesce(p_meaning,'')),180);
  v_key text;
  v_row public.hotel_olivia_memory;
begin
  if v_user is null then raise exception 'authentication required' using errcode='42501'; end if;
  if not private.user_has_property_access(p_property_id) then raise exception 'property access denied' using errcode='42501'; end if;
  if length(v_phrase)<2 or length(v_meaning)<2 then raise exception 'phrase and meaning required'; end if;
  v_key := olivia_private.hl_olivia_phrase_key(v_phrase);

  insert into public.hotel_olivia_memory(property_id,memory_type,phrase_key,example_text,meaning,action_type,confidence,positive_count,is_active,created_by,updated_by,last_seen_at)
  values(p_property_id,'terminology',v_key,v_phrase,v_meaning,'none',0.92,1,true,v_user,v_user,now())
  on conflict(property_id,memory_type,phrase_key,action_type) do update set
    example_text=excluded.example_text,meaning=excluded.meaning,confidence=greatest(public.hotel_olivia_memory.confidence,0.92),
    positive_count=public.hotel_olivia_memory.positive_count+1,is_active=true,updated_by=v_user,last_seen_at=now(),updated_at=now()
  returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.hl_olivia_remember_term(p_property_id uuid,p_phrase text,p_meaning text)
returns jsonb
language sql
set search_path = public, olivia_private
as $$ select olivia_private.hl_olivia_remember_term_internal(p_property_id,p_phrase,p_meaning); $$;

revoke all on function public.hl_olivia_remember_term(uuid,text,text) from public,anon;
grant execute on function public.hl_olivia_remember_term(uuid,text,text) to authenticated;
