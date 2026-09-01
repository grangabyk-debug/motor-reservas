-- Habitación Llena · expose only the permission-checked Planning RPCs.

-- Retire the legacy split overload. The replacement validates tenant role,
-- blocks, timestamp occupancy conflicts and optional repricing.
drop function if exists public.hl_split_reservation_atomic(bigint,date,bigint);

revoke all on function public.hl_apply_planning_restriction_atomic(uuid,date,date,text,integer,text,bigint[],text[],smallint[],text) from public;
revoke all on function public.hl_apply_planning_restriction_atomic(uuid,date,date,text,integer,text,bigint[],text[],smallint[],text) from anon;
grant execute on function public.hl_apply_planning_restriction_atomic(uuid,date,date,text,integer,text,bigint[],text[],smallint[],text) to authenticated;

revoke all on function public.hl_split_reservation_atomic(bigint,date,bigint,boolean) from public;
revoke all on function public.hl_split_reservation_atomic(bigint,date,bigint,boolean) from anon;
grant execute on function public.hl_split_reservation_atomic(bigint,date,bigint,boolean) to authenticated;
