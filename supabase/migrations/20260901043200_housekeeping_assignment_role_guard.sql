create or replace function public.hl_housekeeping_assign_task(p_task_id uuid,p_assignee uuid)
returns public.hotel_housekeeping_tasks
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_task public.hotel_housekeeping_tasks%rowtype;
begin
  select * into v_task from public.hotel_housekeeping_tasks where id=p_task_id for update;
  if not found then raise exception using errcode='P0002',message='Tarea de housekeeping inexistente.'; end if;
  if not private.user_has_property_role(v_task.property_id,array['owner','manager','reception','housekeeping']::text[]) then raise exception using errcode='42501',message='No tenés permiso para asignar tareas de Housekeeping.'; end if;
  if p_assignee is not null and not exists(select 1 from public.property_members pm where pm.property_id=v_task.property_id and pm.user_id=p_assignee) then raise exception using errcode='22023',message='La persona elegida no pertenece a este hotel.'; end if;
  update public.hotel_housekeeping_tasks set assigned_to=p_assignee,updated_at=now() where id=v_task.id returning * into v_task;
  return v_task;
end;
$$;
revoke execute on function public.hl_housekeeping_assign_task(uuid,uuid) from anon;
grant execute on function public.hl_housekeeping_assign_task(uuid,uuid) to authenticated;

create or replace function public.hl_housekeeping_auto_assign(p_property_id uuid,p_for_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_task public.hotel_housekeeping_tasks%rowtype;
  v_room public.habitaciones%rowtype;
  v_assignee uuid;
  v_created integer:=0;
  v_assigned integer:=0;
begin
  if not private.user_has_property_role(p_property_id,array['owner','manager','reception','housekeeping']::text[]) then raise exception using errcode='42501',message='No tenés permiso para autoasignar el turno de Housekeeping.'; end if;
  insert into public.hotel_housekeeping_tasks(property_id,room_id,task_type,priority,status,scheduled_for,notes,created_by,updated_at)
  select h.property_id,h.id,case when lower(coalesce(h.estado,''))='limpia' then 'inspection' else 'cleaning' end,
    case when exists(select 1 from public.reservas r where r.property_id=h.property_id and r.fecha_entrada=p_for_date and r.estado<>'cancelada' and not coalesce(r.no_show,false) and (r.habitacion_id=h.id or h.id=any(coalesce(r.habitaciones_ids,'{}'::bigint[])))) then 'high' else 'normal' end,
    'pending',p_for_date::timestamptz + interval '08:00','Generada por autoasignación del turno',auth.uid(),now()
  from public.habitaciones h
  where h.property_id=p_property_id and coalesce(h.activa,true) and lower(coalesce(h.estado,'')) in ('sucia','limpieza','en_limpieza','limpia')
    and not exists(select 1 from public.hotel_housekeeping_tasks t where t.property_id=h.property_id and t.room_id=h.id and lower(coalesce(t.status,'')) not in ('done','cancelled','canceled') and t.task_type in ('cleaning','clean','inspection'));
  get diagnostics v_created=row_count;
  for v_task in select * from public.hotel_housekeeping_tasks t where t.property_id=p_property_id and lower(coalesce(t.status,'')) not in ('done','cancelled','canceled') and (t.scheduled_for is null or t.scheduled_for::date<=p_for_date) and t.room_id is not null order by coalesce(t.scheduled_for,now()),t.created_at
  loop
    select * into v_room from public.habitaciones where id=v_task.room_id and property_id=p_property_id;
    v_assignee:=null;
    select r.assignee_id into v_assignee from public.hotel_housekeeping_assignment_rules r
    where r.property_id=p_property_id and r.active and exists(select 1 from public.property_members pm where pm.property_id=p_property_id and pm.user_id=r.assignee_id)
      and (r.scope_type='all' or (r.scope_type='floor' and r.scope_value=coalesce(v_room.floor_id::text,'')) or (r.scope_type='zone' and lower(coalesce(r.scope_value,''))=lower(coalesce(v_room.housekeeping_zone,''))) or (r.scope_type='room_type' and lower(coalesce(r.scope_value,''))=lower(coalesce(v_room.tipo,''))))
    order by r.priority asc,case when r.scope_type='all' then 1 else 0 end,r.created_at asc limit 1;
    if v_assignee is not null and v_task.assigned_to is distinct from v_assignee then update public.hotel_housekeeping_tasks set assigned_to=v_assignee,updated_at=now() where id=v_task.id;v_assigned:=v_assigned+1;end if;
  end loop;
  return jsonb_build_object('created',v_created,'assigned',v_assigned,'date',p_for_date);
end;
$$;
revoke execute on function public.hl_housekeeping_auto_assign(uuid,date) from anon;
grant execute on function public.hl_housekeeping_auto_assign(uuid,date) to authenticated;
