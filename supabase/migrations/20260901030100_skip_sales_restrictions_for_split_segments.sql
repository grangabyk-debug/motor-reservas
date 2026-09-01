-- Split segments are operational continuations of an already-sold stay.
-- Sales restrictions must block new sales, not an internal room change.
drop trigger if exists trg_hl_enforce_planning_restrictions on public.reservas;
create trigger trg_hl_enforce_planning_restrictions
before insert on public.reservas
for each row
when (new.stay_chain_id is null)
execute function private.hl_enforce_planning_restrictions();
