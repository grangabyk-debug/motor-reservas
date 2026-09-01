create table public.hotel_onboarding_projects (
  property_id uuid primary key references public.properties(id) on delete cascade,
  source_system text,
  source_system_version text,
  target_go_live date,
  status text not null default 'planning' check (status in ('planning','configuring','importing','parallel','ready','live','paused')),
  migration_mode text not null default 'parallel' check (migration_mode in ('parallel','staged')),
  responsibles jsonb not null default '{"project":"","data":"","training":""}'::jsonb,
  data_scope jsonb not null default '{"reservations":true,"guests":true,"companies":true,"agencies":true,"balances":true,"rates":true,"inventory":true,"notes":true}'::jsonb,
  checklist jsonb not null default '{"config":{"identity":false,"rooms":false,"rates":false,"taxes":false,"users":false,"payments":false},"data":{"mapping":false,"future_reservations":false,"guests":false,"partners":false,"balances":false,"reconciliation":false},"training":{"reception":false,"housekeeping":false,"management":false,"shadow_mode":false},"golive":{"delta_import":false,"final_reconciliation":false,"team_signoff":false,"channel_cutover":false}}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  notes text,
  started_at timestamptz not null default now(),
  went_live_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(responsibles) = 'object'),
  check (jsonb_typeof(data_scope) = 'object'),
  check (jsonb_typeof(checklist) = 'object'),
  check (jsonb_typeof(blockers) = 'array')
);

alter table public.hotel_onboarding_projects enable row level security;

revoke all on table public.hotel_onboarding_projects from anon;
revoke all on table public.hotel_onboarding_projects from authenticated;
grant select, insert, update on table public.hotel_onboarding_projects to authenticated;

create policy hotel_onboarding_projects_select_access on public.hotel_onboarding_projects
for select to authenticated
using (private.user_has_property_access(property_id));

create policy hotel_onboarding_projects_insert_access on public.hotel_onboarding_projects
for insert to authenticated
with check (private.user_has_property_role(property_id, array['owner','manager','admin']));

create policy hotel_onboarding_projects_update_access on public.hotel_onboarding_projects
for update to authenticated
using (private.user_has_property_role(property_id, array['owner','manager','admin']))
with check (private.user_has_property_role(property_id, array['owner','manager','admin']));

create or replace function public.hl_onboarding_set_task(
  p_property_id uuid,
  p_section text,
  p_task text,
  p_done boolean
)
returns public.hotel_onboarding_projects
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_row public.hotel_onboarding_projects;
begin
  if p_section not in ('config','data','training','golive') then
    raise exception 'invalid onboarding section' using errcode = '22023';
  end if;
  if coalesce(length(trim(p_task)),0) < 1 or length(p_task) > 64 then
    raise exception 'invalid onboarding task' using errcode = '22023';
  end if;

  insert into public.hotel_onboarding_projects(property_id, checklist, created_by, updated_by)
  values (
    p_property_id,
    jsonb_build_object(p_section, jsonb_build_object(p_task, to_jsonb(coalesce(p_done,false)))),
    (select auth.uid()),
    (select auth.uid())
  )
  on conflict (property_id) do update
  set checklist = coalesce(public.hotel_onboarding_projects.checklist,'{}'::jsonb)
      || jsonb_build_object(
           p_section,
           coalesce(public.hotel_onboarding_projects.checklist -> p_section,'{}'::jsonb)
           || jsonb_build_object(p_task, to_jsonb(coalesce(p_done,false)))
         ),
      updated_by = (select auth.uid()),
      updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.hl_onboarding_set_task(uuid,text,text,boolean) from public, anon;
grant execute on function public.hl_onboarding_set_task(uuid,text,text,boolean) to authenticated;
