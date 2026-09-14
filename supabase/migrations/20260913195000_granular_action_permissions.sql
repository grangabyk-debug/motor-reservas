create or replace function public.hl_can_property_action(p_property_id uuid, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_role text;
  v_override text;
  v_known_actions text[] := array[
    'payments.create_request',
    'payments.verify_request',
    'api.manage_keys',
    'staff.invite'
  ];
begin
  if auth.uid() is null or p_property_id is null or coalesce(trim(p_action),'') = '' then
    return false;
  end if;

  if exists (
    select 1 from public.properties p
    where p.id = p_property_id and p.owner_id = auth.uid()
  ) then
    return true;
  end if;

  select pm.role into v_role
  from public.property_members pm
  where pm.property_id = p_property_id and pm.user_id = auth.uid()
  limit 1;

  if v_role is null then
    return false;
  end if;

  if not (p_action = any(v_known_actions)) then
    return false;
  end if;

  select ps.settings #>> array['role_permissions','__actions',v_role,p_action]
  into v_override
  from public.property_settings ps
  where ps.property_id = p_property_id;

  if v_override is not null then
    return lower(v_override) = 'true';
  end if;

  if v_role in ('manager','admin') then
    return true;
  end if;

  if v_role in ('reception','night_audit') then
    return p_action in ('payments.create_request','payments.verify_request');
  end if;

  return false;
end;
$$;

revoke all on function public.hl_can_property_action(uuid,text) from public;
grant execute on function public.hl_can_property_action(uuid,text) to authenticated;
