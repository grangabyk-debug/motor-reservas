-- Channel Hub: los permisos de tabla habilitan al rol authenticated.
-- El aislamiento real sigue estando en las políticas RLS por property_id.

grant select, insert, update, delete
on table public.hotel_channel_hubs
to authenticated;

grant select, insert, update, delete
on table public.hotel_channel_hub_mappings
to authenticated;
