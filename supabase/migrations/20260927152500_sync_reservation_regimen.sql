begin;

create or replace function private.hl_sync_reservation_regimen_from_details()
returns trigger
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare
  v_active_count integer:=0;
  v_labeled_count integer:=0;
  v_distinct_count integer:=0;
  v_single_regimen text;
begin
  if new.habitaciones_detalle is null or jsonb_typeof(new.habitaciones_detalle)<>'array' then
    return new;
  end if;

  with active_details as (
    select value d
    from jsonb_array_elements(new.habitaciones_detalle)
    where lower(coalesce(value->>'segment_role','active_room')) not in
      ('previous_room','transient_room','cancelled_room','no_show_room')
  ),
  labels as (
    select nullif(trim(coalesce(d->>'rate_plan_regimen',d->>'rate_plan_name','')),'') regimen
    from active_details
  )
  select
    (select count(*) from active_details),
    count(regimen),
    count(distinct regimen),
    min(regimen)
  into v_active_count,v_labeled_count,v_distinct_count,v_single_regimen
  from labels;

  if v_active_count>0 and v_labeled_count=v_active_count then
    new.regimen:=case when v_distinct_count=1 then v_single_regimen else 'Mixto' end;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hl_sync_reservation_regimen_from_details on public.reservas;
create trigger trg_hl_sync_reservation_regimen_from_details
before insert or update of habitaciones_detalle
on public.reservas
for each row
execute function private.hl_sync_reservation_regimen_from_details();

with derived as (
  select
    r.id,
    case when count(distinct nullif(trim(coalesce(d->>'rate_plan_regimen',d->>'rate_plan_name','')),''))=1
      then min(nullif(trim(coalesce(d->>'rate_plan_regimen',d->>'rate_plan_name','')),''))
      else 'Mixto'
    end as regimen,
    count(*) as active_count,
    count(nullif(trim(coalesce(d->>'rate_plan_regimen',d->>'rate_plan_name','')),'')) as labeled_count
  from public.reservas r
  cross join lateral jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) d
  where lower(coalesce(d->>'segment_role','active_room')) not in
    ('previous_room','transient_room','cancelled_room','no_show_room')
  group by r.id
)
update public.reservas r
set regimen=d.regimen
from derived d
where r.id=d.id
  and d.active_count>0
  and d.labeled_count=d.active_count
  and coalesce(r.regimen,'') is distinct from coalesce(d.regimen,'');

commit;
