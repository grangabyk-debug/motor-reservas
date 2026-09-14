-- Mirrors production migration route_new_room_services_to_room_folio.
-- New auto-synced service charges that explicitly reference a room must start
-- in that room's folio. Explicit folio assignments still take precedence.

create or replace function private.hl_route_new_room_service_item()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_room_text text;
  v_room_id bigint;
  v_folio_id uuid;
begin
  if new.invoice_document_id is not null then return new; end if;
  if coalesce(new.metadata->>'auto_synced','false')<>'true' then return new; end if;
  if nullif(coalesce(new.metadata->'source_payload'->>'folio_id',''),'') is not null then return new; end if;

  v_room_text:=coalesce(
    nullif(new.metadata->'source_payload'->>'habitacion_id',''),
    nullif(new.metadata->'source_payload'->>'room_id','')
  );
  if v_room_text is null or v_room_text !~ '^\d+$' then return new; end if;

  v_room_id:=v_room_text::bigint;
  select f.id into v_folio_id
  from public.hotel_folios f
  where f.reservation_id=new.reservation_id
    and f.room_id=v_room_id
    and f.folio_type='room'
    and f.status<>'void'
  order by f.sort_order,f.created_at
  limit 1;

  if v_folio_id is not null then
    new.room_id:=v_room_id;
    new.folio_id:=v_folio_id;
  end if;
  return new;
end;
$function$;

drop trigger if exists aa_hl_route_new_room_service_item on public.hotel_folio_items;
create trigger aa_hl_route_new_room_service_item
before insert on public.hotel_folio_items
for each row execute function private.hl_route_new_room_service_item();
