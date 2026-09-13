create or replace function public.hl_get_reservation_conversation(p_property_id uuid,p_reservation_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  r public.reservas%rowtype;
  c record;
  v_context jsonb;
  v_phone text;
begin
  select * into r
  from public.reservas
  where id=p_reservation_id and property_id=p_property_id;
  if not found then return null; end if;

  select c0.id,c0.channel,c0.contact_name,c0.last_message_at,c0.last_message_text
    into c
  from public.inbox_conversations c0
  where c0.property_id=p_property_id and c0.reservation_id=p_reservation_id
  order by c0.last_message_at desc nulls last,c0.updated_at desc
  limit 1;

  if found then
    return jsonb_build_object('id',c.id,'channel',c.channel,'contact_name',c.contact_name,'last_message_at',c.last_message_at,'last_message_text',c.last_message_text);
  end if;

  v_phone:=nullif(regexp_replace(coalesce(r.telefono_huesped,''),'\D','','g'),'');

  for c in
    select c0.id,c0.channel,c0.contact_name,c0.last_message_at,c0.last_message_text
    from public.inbox_conversations c0
    where c0.property_id=p_property_id
      and c0.reservation_id is null
      and (
        (r.guest_profile_id is not null and c0.guest_profile_id=r.guest_profile_id)
        or (nullif(trim(r.email_huesped),'') is not null and lower(trim(c0.contact_email))=lower(trim(r.email_huesped)))
        or (v_phone is not null and regexp_replace(coalesce(c0.contact_phone,''),'\D','','g')=v_phone)
      )
    order by
      case when coalesce(c0.last_message_at,c0.updated_at,c0.created_at)::date between r.fecha_entrada and r.fecha_salida then 0 else 1 end,
      least(abs(coalesce(c0.last_message_at,c0.updated_at,c0.created_at)::date-r.fecha_entrada),abs(coalesce(c0.last_message_at,c0.updated_at,c0.created_at)::date-r.fecha_salida)),
      c0.last_message_at desc nulls last
    limit 8
  loop
    v_context:=public.hl_get_inbox_operational_context(p_property_id,c.id);
    if nullif(v_context->'reservation'->>'id','')::bigint=p_reservation_id then
      return jsonb_build_object('id',c.id,'channel',c.channel,'contact_name',c.contact_name,'last_message_at',c.last_message_at,'last_message_text',c.last_message_text);
    end if;
  end loop;

  return null;
end;
$$;

revoke all on function public.hl_get_reservation_conversation(uuid,bigint) from public;
grant execute on function public.hl_get_reservation_conversation(uuid,bigint) to authenticated;
