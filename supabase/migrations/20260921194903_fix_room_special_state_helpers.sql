CREATE OR REPLACE FUNCTION public.hl_reservation_room_early_checkin(p_details jsonb, p_room_id bigint, p_room_start date, p_reservation_start date, p_global boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v jsonb; v_explicit text;
begin
  select e into v
  from jsonb_array_elements(case when jsonb_typeof(p_details)='array' then p_details else '[]'::jsonb end) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=p_room_id
  limit 1;
  if v ? 'early_checkin_requested' then
    v_explicit:=lower(coalesce(v->>'early_checkin_requested','false'));
    return v_explicit in('true','t','1','yes','on');
  end if;
  if coalesce(v->>'early_checkin_time','')<>'' or coalesce(nullif(v->>'early_checkin_net','')::numeric,0)>0 then return true; end if;
  return coalesce(p_global,false) and p_room_start is not distinct from p_reservation_start;
end
$function$


CREATE OR REPLACE FUNCTION public.hl_reservation_room_late_checkout(p_details jsonb, p_checkout_dates jsonb, p_room_id bigint, p_room_end date, p_reservation_end date, p_global boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare v jsonb; v_explicit text;
begin
  if coalesce(p_checkout_dates->>('late:'||p_room_id::text),'')~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return true; end if;
  select e into v
  from jsonb_array_elements(case when jsonb_typeof(p_details)='array' then p_details else '[]'::jsonb end) e
  where coalesce(e->>'habitacion_id','')~'^[0-9]+$'
    and (e->>'habitacion_id')::bigint=p_room_id
  limit 1;
  if v ? 'late_checkout_requested' then
    v_explicit:=lower(coalesce(v->>'late_checkout_requested','false'));
    return v_explicit in('true','t','1','yes','on');
  end if;
  if coalesce(v->>'late_checkout_time','')<>'' or coalesce(nullif(v->>'late_checkout_net','')::numeric,0)>0 then return true; end if;
  return coalesce(p_global,false) and p_room_end is not distinct from p_reservation_end;
end
$function$

