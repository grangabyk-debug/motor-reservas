revoke execute on function public.hl_housekeeping_set_room_state(bigint,text,jsonb,text,text) from public;
revoke execute on function public.hl_housekeeping_set_room_state(bigint,text,jsonb,text,text) from anon;
grant execute on function public.hl_housekeeping_set_room_state(bigint,text,jsonb,text,text) to authenticated;

revoke execute on function public.hl_housekeeping_save_schedule(bigint,text,integer,smallint[],boolean,text) from public;
revoke execute on function public.hl_housekeeping_save_schedule(bigint,text,integer,smallint[],boolean,text) from anon;
grant execute on function public.hl_housekeeping_save_schedule(bigint,text,integer,smallint[],boolean,text) to authenticated;

revoke execute on function public.hl_housekeeping_assign_task(uuid,uuid) from public;
revoke execute on function public.hl_housekeeping_assign_task(uuid,uuid) from anon;
grant execute on function public.hl_housekeeping_assign_task(uuid,uuid) to authenticated;

revoke execute on function public.hl_housekeeping_auto_assign(uuid,date) from public;
revoke execute on function public.hl_housekeeping_auto_assign(uuid,date) from anon;
grant execute on function public.hl_housekeeping_auto_assign(uuid,date) to authenticated;

revoke execute on function public.hl_housekeeping_next_cleaning_date(date,date,text,integer,smallint[],date) from public;
revoke execute on function public.hl_housekeeping_next_cleaning_date(date,date,text,integer,smallint[],date) from anon;
grant execute on function public.hl_housekeeping_next_cleaning_date(date,date,text,integer,smallint[],date) to authenticated;
