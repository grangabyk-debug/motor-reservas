alter table public.reservas add column if not exists tipo_cama text;

comment on column public.reservas.tipo_cama is 'Configuración o preferencia de cama elegida para la reserva.';
