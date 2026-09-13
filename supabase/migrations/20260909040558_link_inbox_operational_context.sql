alter table public.inbox_conversations
  add column if not exists guest_profile_id uuid,
  add column if not exists reservation_id bigint,
  add column if not exists room_id bigint,
  add column if not exists context_link_source text,
  add column if not exists context_linked_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='inbox_conversations_guest_profile_id_fkey') then
    alter table public.inbox_conversations
      add constraint inbox_conversations_guest_profile_id_fkey foreign key (guest_profile_id) references public.hotel_guest_profiles(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='inbox_conversations_reservation_id_fkey') then
    alter table public.inbox_conversations
      add constraint inbox_conversations_reservation_id_fkey foreign key (reservation_id) references public.reservas(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='inbox_conversations_room_id_fkey') then
    alter table public.inbox_conversations
      add constraint inbox_conversations_room_id_fkey foreign key (room_id) references public.habitaciones(id) on delete set null;
  end if;
end $$;

create index if not exists inbox_conversations_property_guest_idx on public.inbox_conversations(property_id,guest_profile_id) where guest_profile_id is not null;
create index if not exists inbox_conversations_property_reservation_idx on public.inbox_conversations(property_id,reservation_id) where reservation_id is not null;
create index if not exists inbox_conversations_property_room_idx on public.inbox_conversations(property_id,room_id) where room_id is not null;

create or replace function public.hl_get_inbox_operational_context(p_property_id uuid,p_conversation_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  c public.inbox_conversations%rowtype;
  r public.reservas%rowtype;
  g public.hotel_guest_profiles%rowtype;
  v_guest_id uuid;
  v_reservation_id bigint;
  v_room_id bigint;
  v_ref_date date;
  v_source text;
  v_paid numeric:=0;
  v_payment_count integer:=0;
  v_last_payment timestamptz;
  v_housekeeping jsonb:='[]'::jsonb;
  v_maintenance jsonb:='[]'::jsonb;
  v_rooms jsonb:='[]'::jsonb;
  v_total numeric:=0;
  v_currency text:='ARS';
begin
  select * into c
  from public.inbox_conversations
  where id=p_conversation_id and property_id=p_property_id;
  if not found then return null; end if;

  v_guest_id:=c.guest_profile_id;
  v_reservation_id:=c.reservation_id;
  v_room_id:=c.room_id;
  v_ref_date:=coalesce(c.last_message_at,c.updated_at,c.created_at,now())::date;
  v_source:=case when c.reservation_id is not null then coalesce(c.context_link_source,'existing') else c.context_link_source end;

  if v_guest_id is null and (nullif(trim(c.contact_email),'') is not null or nullif(regexp_replace(coalesce(c.contact_phone,''),'\D','','g'),'') is not null) then
    select gp.id into v_guest_id
    from public.hotel_guest_profiles gp
    where gp.property_id=p_property_id
      and (
        (nullif(trim(c.contact_email),'') is not null and lower(trim(gp.email))=lower(trim(c.contact_email)))
        or
        (nullif(regexp_replace(coalesce(c.contact_phone,''),'\D','','g'),'') is not null and regexp_replace(coalesce(gp.phone,''),'\D','','g')=regexp_replace(c.contact_phone,'\D','','g'))
      )
    order by gp.last_stay_at desc nulls last,gp.updated_at desc nulls last
    limit 1;
  end if;

  if v_reservation_id is null then
    select rr.id into v_reservation_id
    from public.reservas rr
    where rr.property_id=p_property_id
      and (
        (v_guest_id is not null and rr.guest_profile_id=v_guest_id)
        or (nullif(trim(c.contact_email),'') is not null and lower(trim(rr.email_huesped))=lower(trim(c.contact_email)))
        or (nullif(regexp_replace(coalesce(c.contact_phone,''),'\D','','g'),'') is not null and regexp_replace(coalesce(rr.telefono_huesped,''),'\D','','g')=regexp_replace(c.contact_phone,'\D','','g'))
      )
    order by
      case when v_ref_date between rr.fecha_entrada and rr.fecha_salida then 0 when rr.fecha_salida>=v_ref_date then 1 else 2 end,
      case when rr.estado in ('cancelada','cancelado','no_show','no show') or rr.cancelled_at is not null or rr.no_show then 1 else 0 end,
      abs(rr.fecha_entrada-v_ref_date),rr.created_at desc
    limit 1;
    if v_reservation_id is not null then
      v_source:=case
        when v_guest_id is not null then 'guest_profile'
        when nullif(trim(c.contact_email),'') is not null then 'contact_email'
        else 'contact_phone'
      end;
    end if;
  end if;

  if v_reservation_id is not null then
    select * into r from public.reservas where id=v_reservation_id and property_id=p_property_id;
    if found then
      v_guest_id:=coalesce(v_guest_id,r.guest_profile_id);
      v_room_id:=coalesce(v_room_id,r.habitacion_id,case when coalesce(array_length(r.habitaciones_ids,1),0)=1 then r.habitaciones_ids[1] else null end);
      v_total:=coalesce(r.precio_total,0);
      v_currency:=coalesce(nullif(r.moneda,''),'ARS');
    else
      v_reservation_id:=null;
    end if;
  end if;

  if v_guest_id is not null then
    select * into g from public.hotel_guest_profiles where id=v_guest_id and property_id=p_property_id;
    if not found then v_guest_id:=null; end if;
  end if;

  if c.guest_profile_id is distinct from v_guest_id or c.reservation_id is distinct from v_reservation_id or c.room_id is distinct from v_room_id then
    update public.inbox_conversations
      set guest_profile_id=v_guest_id,reservation_id=v_reservation_id,room_id=v_room_id,
          context_link_source=coalesce(v_source,'resolved'),context_linked_at=now(),updated_at=now()
    where id=p_conversation_id and property_id=p_property_id;
  end if;

  if v_reservation_id is not null then
    select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))) filter(where lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled')),0),
           count(*) filter(where lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled')),
           max(p.created_at) filter(where lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled'))
      into v_paid,v_payment_count,v_last_payment
    from public.pagos p where p.property_id=p_property_id and p.reserva_id=v_reservation_id;

    select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb) into v_housekeeping
    from (
      select jsonb_build_object('id',t.id,'task_type',t.task_type,'priority',t.priority,'status',t.status,'scheduled_for',t.scheduled_for,'notes',t.notes) payload,
             coalesce(t.scheduled_for,t.created_at) sort_at
      from public.hotel_housekeeping_tasks t
      where t.property_id=p_property_id and t.reservation_id=v_reservation_id
        and lower(coalesce(t.status,'')) not in ('done','completed','cancelled','canceled','resolved')
      order by coalesce(t.scheduled_for,t.created_at) desc limit 6
    ) x;

    select coalesce(jsonb_agg(x.payload order by x.sort_at desc),'[]'::jsonb) into v_maintenance
    from (
      select jsonb_build_object('id',t.id,'title',t.title,'priority',t.priority,'status',t.status,'due_at',t.due_at,'description',t.description) payload,
             coalesce(t.due_at,t.created_at) sort_at
      from public.hotel_maintenance_tickets t
      where t.property_id=p_property_id and t.reservation_id=v_reservation_id
        and lower(coalesce(t.status,'')) not in ('done','completed','cancelled','canceled','resolved','closed')
      order by coalesce(t.due_at,t.created_at) desc limit 6
    ) x;

    select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.nombre,'type',h.tipo,'status',h.estado,'zone',h.housekeeping_zone) order by h.sort_order nulls last,h.id),'[]'::jsonb)
      into v_rooms
    from public.habitaciones h
    where h.property_id=p_property_id and (
      h.id=r.habitacion_id or h.id=any(coalesce(r.habitaciones_ids,array[]::bigint[]))
    );
  end if;

  return jsonb_build_object(
    'linked',v_reservation_id is not null or v_guest_id is not null,
    'link_source',coalesce(v_source,c.context_link_source),
    'guest',case when v_guest_id is null then null else jsonb_build_object('id',g.id,'name',g.full_name,'email',g.email,'phone',g.phone,'language',g.language,'vip_level',g.vip_level,'tags',coalesce(to_jsonb(g.tags),'[]'::jsonb),'preferences',coalesce(g.preferences,'{}'::jsonb)) end,
    'reservation',case when v_reservation_id is null then null else jsonb_build_object('id',r.id,'number',r.numero_reserva,'status',r.estado,'guest_name',r.nombre_huesped,'arrival',r.fecha_entrada,'departure',r.fecha_salida,'total',v_total,'currency',v_currency,'early_checkin',r.early_checkin,'late_checkout',r.late_checkout,'arrival_time',r.hora_llegada_estimada,'departure_time',r.hora_salida_estimada) end,
    'rooms',v_rooms,
    'payments',jsonb_build_object('paid',coalesce(v_paid,0),'total',v_total,'pending',greatest(0,v_total-coalesce(v_paid,0)),'count',coalesce(v_payment_count,0),'last_payment_at',v_last_payment,'currency',v_currency),
    'housekeeping',v_housekeeping,
    'maintenance',v_maintenance
  );
end;
$$;

revoke all on function public.hl_get_inbox_operational_context(uuid,uuid) from public;
grant execute on function public.hl_get_inbox_operational_context(uuid,uuid) to authenticated;
