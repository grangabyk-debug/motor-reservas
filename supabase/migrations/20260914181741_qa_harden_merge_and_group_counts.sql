-- Mirrors production migration 20260914181741 qa_harden_merge_and_group_counts.

create or replace function private.hl_resolve_folio_source_collision()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
begin
  if new.reservation_id is distinct from old.reservation_id
     and new.source_key is not null
     and exists(
       select 1 from public.hotel_folio_items x
       where x.reservation_id=new.reservation_id
         and x.source_key=new.source_key
         and x.id<>new.id
     ) then
    new.source_key:=new.source_key||':merged:'||old.reservation_id::text||':'||left(new.id::text,8);
  end if;
  return new;
end;
$function$;

drop trigger if exists aa_hl_resolve_folio_source_collision on public.hotel_folio_items;
create trigger aa_hl_resolve_folio_source_collision
before update of reservation_id,source_key on public.hotel_folio_items
for each row execute function private.hl_resolve_folio_source_collision();

create or replace function private.hl_preserve_group_guest_count_on_room_removal()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_old_count integer;
  v_new_count integer;
  v_expected integer:=0;
begin
  v_old_count:=cardinality(coalesce(old.habitaciones_ids,array[]::bigint[]));
  v_new_count:=cardinality(coalesce(new.habitaciones_ids,array[]::bigint[]));
  if old.estado<>'alojado'
     and v_old_count>1
     and v_new_count>0
     and v_new_count<v_old_count then
    select coalesce(sum(greatest(0,coalesce(nullif(e->>'huespedes','')::integer,0))),0)
      into v_expected
    from jsonb_array_elements(coalesce(new.habitaciones_detalle,'[]'::jsonb)) e
    where coalesce(e->>'habitacion_id','') ~ '^\d+$'
      and (e->>'habitacion_id')::bigint=any(coalesce(new.habitaciones_ids,array[]::bigint[]))
      and coalesce(e->>'segment_role','active_room') not in('previous_room','cancelled_room');
    if v_expected>0 then new.cantidad_huespedes:=v_expected; end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists aa_hl_preserve_group_guest_count on public.reservas;
create trigger aa_hl_preserve_group_guest_count
before update of habitaciones_ids,habitaciones_detalle,cantidad_huespedes on public.reservas
for each row execute function private.hl_preserve_group_guest_count_on_room_removal();

create or replace function private.hl_calendar_room_pricing(p_property_id uuid,p_room_id bigint,p_start date,p_end date)
returns table(nights integer,net_total numeric,avg_rate numeric)
language plpgsql
stable
set search_path to 'public','private','pg_temp'
as $function$
declare v_expected integer;v_count integer;v_sum numeric;
begin
  if p_start is null or p_end is null or p_end<=p_start then
    raise exception using errcode='22023',message='El rango tarifario no es válido.';
  end if;
  v_expected:=p_end-p_start;
  select count(*),coalesce(sum(rc.price),0) into v_count,v_sum
  from public.hotel_rate_calendar rc
  where rc.property_id=p_property_id and rc.habitacion_id=p_room_id
    and rc.stay_date>=p_start and rc.stay_date<p_end;
  if v_count<>v_expected then
    raise exception using errcode='P0001',message=format('Falta configurar la tarifa de la habitación para %s noche(s) del rango %s → %s.',v_expected-v_count,p_start,p_end);
  end if;
  nights:=v_expected;net_total:=round(v_sum,2);avg_rate:=round(v_sum/v_expected,6);return next;
end;
$function$;
