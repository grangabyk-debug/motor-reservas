-- QA regression fixes discovered on 2026-09-14.
-- Canonical source is production migration history; this file keeps repo migrations aligned.

-- 1) Merge-safe folio source keys: when moving secondary folio items into the
-- primary reservation, prefix colliding source keys with the secondary
-- reservation id so the unique (reservation_id, source_key) constraint is preserved.
-- 2) Group room cancellation: when no detailed guest rows exist yet, preserve
-- guest count from active habitaciones_detalle instead of collapsing to 1.
-- 3) Shared rate-calendar helper used by subsequent room/date repricing fixes.

create or replace function public.hl_rate_calendar_net_total(
  p_property_id uuid,
  p_room_id bigint,
  p_start date,
  p_end date
) returns numeric
language sql
stable
set search_path = 'pg_catalog','public'
as $$
  select coalesce(sum(rc.price),0)
  from public.hotel_rate_calendar rc
  where rc.property_id=p_property_id
    and rc.habitacion_id=p_room_id
    and rc.stay_date>=p_start
    and rc.stay_date<p_end
$$;

create or replace function public.hl_rate_calendar_avg_net(
  p_property_id uuid,
  p_room_id bigint,
  p_start date,
  p_end date
) returns numeric
language sql
stable
set search_path = 'pg_catalog','public'
as $$
  select case when p_end>p_start
    then public.hl_rate_calendar_net_total(p_property_id,p_room_id,p_start,p_end)/(p_end-p_start)
    else 0 end
$$;

-- Function bodies for hl_merge_reservations_atomic and hl_cancel_group_room_atomic
-- were patched in production in the same migration. They are intentionally not
-- duplicated here because their canonical definitions are already tracked by the
-- next consolidated migration in this series.
