revoke execute on function public.hl_move_reservation_atomic(bigint,bigint,date,date) from public;
revoke execute on function public.hl_checkout_reservation_atomic(bigint) from public;
revoke execute on function public.hl_split_reservation_atomic(bigint,date,bigint) from public;
revoke execute on function public.hl_create_web_checkin_token(uuid,bigint,integer) from public;

grant execute on function public.hl_move_reservation_atomic(bigint,bigint,date,date) to authenticated, service_role;
grant execute on function public.hl_checkout_reservation_atomic(bigint) to authenticated, service_role;
grant execute on function public.hl_split_reservation_atomic(bigint,date,bigint) to authenticated, service_role;
grant execute on function public.hl_create_web_checkin_token(uuid,bigint,integer) to authenticated, service_role;

revoke execute on function public.hl_get_web_checkin(text) from public;
revoke execute on function public.hl_submit_web_checkin(text,jsonb,text,text) from public;
grant execute on function public.hl_get_web_checkin(text) to anon, authenticated, service_role;
grant execute on function public.hl_submit_web_checkin(text,jsonb,text,text) to anon, authenticated, service_role;
