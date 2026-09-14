create or replace function public.hl_public_site_by_domain(p_hostname text)
returns jsonb
language sql
stable
security definer
set search_path='public','pg_temp'
as $$
select jsonb_build_object('slug',e.slug,'property_id',e.property_id)
from public.hotel_websites w
join public.hotel_booking_engines e on e.property_id=w.property_id and e.enabled=true
where w.mode='managed' and w.enabled=true and w.domain_status='verified'
  and lower(regexp_replace(coalesce(w.custom_domain,''),'^www\\.',''))=lower(regexp_replace(split_part(trim(p_hostname),':',1),'^www\\.',''))
limit 1;
$$;
revoke all on function public.hl_public_site_by_domain(text) from public;
grant execute on function public.hl_public_site_by_domain(text) to anon,authenticated;
