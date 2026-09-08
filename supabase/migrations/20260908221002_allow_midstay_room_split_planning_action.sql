alter table public.hotel_planning_operation_log
  drop constraint if exists hotel_planning_operation_log_action_check;

alter table public.hotel_planning_operation_log
  add constraint hotel_planning_operation_log_action_check
  check (action = any (array['move'::text,'resize'::text,'change_room'::text,'swap'::text,'split_room_move'::text]));
