create or replace function public.hl_website_funnel(p_property_id uuid,p_days integer default 30)
returns jsonb
language sql
stable
security invoker
set search_path='public','pg_temp'
as $$
with base as (
  select event_name,source,session_id from public.hotel_web_events
  where property_id=p_property_id and created_at>=now()-(least(greatest(coalesce(p_days,30),1),90)||' days')::interval
), counts as (
  select count(*) filter(where event_name='site_view') site_views,
         count(*) filter(where event_name='engine_view') engine_views,
         count(*) filter(where event_name='availability_search') searches,
         count(*) filter(where event_name='availability_result') results,
         count(*) filter(where event_name='booking_start') starts,
         count(*) filter(where event_name='booking_confirmed') confirmed,
         count(distinct nullif(session_id,'')) sessions
  from base
), sources as (
  select coalesce(jsonb_object_agg(source,cnt),'{}'::jsonb) data
  from (select source,count(*) cnt from base where event_name in('site_view','engine_view') group by source order by count(*) desc) q
)
select jsonb_build_object(
  'days',least(greatest(coalesce(p_days,30),1),90),
  'site_views',c.site_views,'engine_views',c.engine_views,'visits',c.site_views+c.engine_views,
  'searches',c.searches,'results',c.results,'booking_starts',c.starts,'confirmed',c.confirmed,'sessions',c.sessions,
  'conversion_pct',case when(c.site_views+c.engine_views)>0 then round((c.confirmed::numeric/(c.site_views+c.engine_views)::numeric)*100,1) else 0 end,
  'sources',s.data
) from counts c cross join sources s;
$$;
grant execute on function public.hl_website_funnel(uuid,integer) to authenticated;
