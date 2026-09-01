create or replace function private.hl_log_reservation_commercial_change()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_actor uuid:=auth.uid();
  v_name text:=private.hl_event_actor_name();
begin
  if new.tentative_expired_at is distinct from old.tentative_expired_at and new.tentative_expired_at is not null then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'tentative','Tentativa vencida','La habitación volvió a quedar disponible',jsonb_build_object('expired_at',new.tentative_expired_at,'scheduled_for',old.tentative_expires_at),v_actor,v_name);
  elsif new.estado='tentativa' and (old.estado is distinct from 'tentativa' or new.tentative_expires_at is distinct from old.tentative_expires_at) then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'tentative',case when old.estado='tentativa' then 'Tentativa extendida' else 'Reserva en tentativa' end,'Retención hasta '||coalesce(to_char(new.tentative_expires_at at time zone 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI'),'sin vencimiento'),jsonb_build_object('before_expiry',old.tentative_expires_at,'after_expiry',new.tentative_expires_at,'note',new.tentative_note),v_actor,v_name);
  elsif old.estado='tentativa' and new.estado='confirmada' then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(new.property_id,new.id,'tentative','Tentativa confirmada','La reserva quedó confirmada',jsonb_build_object('previous_expiry',old.tentative_expires_at),v_actor,v_name);
  end if;

  if new.package_id is distinct from old.package_id then
    insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id,actor_name)
    values(
      new.property_id,
      new.id,
      'package',
      case when new.package_id is null then 'Pack retirado' when old.package_id is null then 'Pack aplicado' else 'Pack reemplazado' end,
      coalesce(new.package_snapshot->>'name',old.package_snapshot->>'name','Oferta comercial'),
      jsonb_build_object('before_package_id',old.package_id,'after_package_id',new.package_id,'before_snapshot',old.package_snapshot,'after_snapshot',new.package_snapshot,'meal_plan',new.regimen),
      v_actor,
      v_name
    );
  end if;
  return new;
end;
$$;

drop trigger if exists hl_reservation_commercial_history_trg on public.reservas;
create trigger hl_reservation_commercial_history_trg
after update of estado,tentative_expires_at,tentative_expired_at,package_id,regimen on public.reservas
for each row execute function private.hl_log_reservation_commercial_change();
