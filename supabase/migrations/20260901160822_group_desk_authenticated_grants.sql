revoke all on table public.hotel_groups from anon;
revoke all on table public.hotel_group_quotes from anon;
revoke all on table public.hotel_group_quote_lines from anon;
revoke all on table public.hotel_group_rooming from anon;
revoke all on table public.hotel_group_inventory_blocks from anon;

revoke truncate, references, trigger on table public.hotel_groups from authenticated;
revoke truncate, references, trigger on table public.hotel_group_quotes from authenticated;
revoke truncate, references, trigger on table public.hotel_group_quote_lines from authenticated;
revoke truncate, references, trigger on table public.hotel_group_rooming from authenticated;
revoke truncate, references, trigger on table public.hotel_group_inventory_blocks from authenticated;

grant select, insert, update, delete on table public.hotel_groups to authenticated;
grant select, insert, update, delete on table public.hotel_group_quotes to authenticated;
grant select, insert, update, delete on table public.hotel_group_quote_lines to authenticated;
grant select, insert, update, delete on table public.hotel_group_rooming to authenticated;
grant select, insert, update, delete on table public.hotel_group_inventory_blocks to authenticated;
