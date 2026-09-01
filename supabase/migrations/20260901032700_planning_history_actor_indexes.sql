create index if not exists hotel_planning_operation_log_created_by_idx
  on public.hotel_planning_operation_log(created_by)
  where created_by is not null;

create index if not exists hotel_planning_operation_log_undone_by_idx
  on public.hotel_planning_operation_log(undone_by)
  where undone_by is not null;
