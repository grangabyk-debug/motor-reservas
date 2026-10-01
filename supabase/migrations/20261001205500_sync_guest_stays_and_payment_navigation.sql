-- Sincroniza tramos de huéspedes cuando la ocupación nocturna permite una asignación inequívoca.
create or replace function private.hl_sync_guest_stays_from_occupancy(p_reservation_id bigint)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  d jsonb;
  rid bigint;
  max_guests integer;
  g record;
  first_day date;
  last_day date;
  active_count integer;
  span_count integer;
  synced integer:=0;
  skipped integer:=0;
begin
  for d in
    select e
    from public.reservas r
    cross join lateral jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) e
    where r.id=p_reservation_id
      and coalesce(e->>'habitacion_id','')~'^[0-9]+$'
      and jsonb_typeof(e->'occupancy_nights')='array'
      and jsonb_array_length(e->'occupancy_nights')>0
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
  loop
    rid:=(d->>'habitacion_id')::bigint;
    select max(greatest(1,coalesce(nullif(n->>'guests','')::integer,1)))
      into max_guests
    from jsonb_array_elements(d->'occupancy_nights') n;

    for g in
      select x.*,row_number() over(order by case when role='primary' then 0 else 1 end,sort_order nulls last,created_at,id) as rn
      from public.hotel_reservation_guests x
      where x.reservation_id=p_reservation_id and x.room_id=rid and x.checked_out_at is null
      order by case when role='primary' then 0 else 1 end,sort_order nulls last,created_at,id
    loop
      if g.rn>coalesce(max_guests,0) then continue; end if;
      select min((n->>'date')::date),max((n->>'date')::date),count(*)
        into first_day,last_day,active_count
      from jsonb_array_elements(d->'occupancy_nights') n
      where coalesce(n->>'date','')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        and greatest(1,coalesce(nullif(n->>'guests','')::integer,1))>=g.rn;

      if active_count=0 or first_day is null or last_day is null then continue; end if;
      span_count:=last_day-first_day+1;
      if active_count<>span_count then skipped:=skipped+1;continue;end if;

      update public.hotel_reservation_guests
         set stay_from=first_day,stay_to=last_day+1,updated_at=now()
       where id=g.id
         and (stay_from is distinct from first_day or stay_to is distinct from last_day+1);
      if found then synced:=synced+1;end if;
    end loop;
  end loop;
  return jsonb_build_object('reservation_id',p_reservation_id,'synced',synced,'skipped_ambiguous',skipped);
end
$$;

create or replace function private.hl_sync_guest_stays_from_occupancy_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
begin
  perform private.hl_sync_guest_stays_from_occupancy(new.id);
  return new;
end
$$;

drop trigger if exists zz_hl_sync_guest_stays_from_occupancy on public.reservas;
create trigger zz_hl_sync_guest_stays_from_occupancy
after update of habitaciones_detalle on public.reservas
for each row
when (old.habitaciones_detalle is distinct from new.habitaciones_detalle)
execute function private.hl_sync_guest_stays_from_occupancy_trigger();
