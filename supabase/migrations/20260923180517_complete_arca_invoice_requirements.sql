alter table public.hotel_arca_settings
  add column if not exists gross_income_number text,
  add column if not exists gross_income_condition text not null default 'registered',
  add column if not exists activity_start_date date,
  add column if not exists invoice_a_variant text not null default 'standard';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname='hotel_arca_settings_gross_income_condition_check'
  ) then
    alter table public.hotel_arca_settings
      add constraint hotel_arca_settings_gross_income_condition_check
      check (gross_income_condition in ('registered','non_contributor'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='hotel_arca_settings_invoice_a_variant_check'
  ) then
    alter table public.hotel_arca_settings
      add constraint hotel_arca_settings_invoice_a_variant_check
      check (invoice_a_variant in ('standard','cbu','retention'));
  end if;
end $$;

comment on column public.hotel_arca_settings.gross_income_number is
  'Número de inscripción en Ingresos Brutos para la representación gráfica del comprobante.';
comment on column public.hotel_arca_settings.gross_income_condition is
  'registered o non_contributor según la situación fiscal del emisor.';
comment on column public.hotel_arca_settings.activity_start_date is
  'Fecha de inicio de actividades que debe figurar en la representación del comprobante.';
comment on column public.hotel_arca_settings.invoice_a_variant is
  'Modalidad autorizada de comprobantes A: standard, cbu o retention.';
