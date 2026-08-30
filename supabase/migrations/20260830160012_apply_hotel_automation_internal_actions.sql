create or replace function private.hl_apply_automation_event_action()
returns trigger
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_action text;
  v_created_by uuid;
begin
  select action_code, created_by
    into v_action, v_created_by
  from public.hotel_automations
  where id = new.automation_id
    and property_id = new.property_id;

  if v_action = 'housekeeping_priority' and new.room_id is not null then
    if not exists (
      select 1
      from public.hotel_housekeeping_tasks t
      where t.property_id = new.property_id
        and t.room_id = new.room_id
        and t.reservation_id is not distinct from new.reservation_id
        and t.notes = new.message
        and t.status in ('scheduled','pending','in_progress')
    ) then
      insert into public.hotel_housekeeping_tasks(
        property_id, room_id, reservation_id, task_type, priority, status,
        scheduled_for, notes, created_by
      ) values (
        new.property_id, new.room_id, new.reservation_id, 'cleaning',
        case when new.event_type = 'checkout' then 'urgent' else 'high' end,
        'pending', now(), new.message, v_created_by
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists hl_apply_automation_event_action on public.hotel_automation_events;
create trigger hl_apply_automation_event_action
after insert on public.hotel_automation_events
for each row execute function private.hl_apply_automation_event_action();

revoke all on function private.hl_apply_automation_event_action() from public, anon, authenticated;
