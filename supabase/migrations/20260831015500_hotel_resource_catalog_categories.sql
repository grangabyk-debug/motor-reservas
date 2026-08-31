-- Habitación Llena · hotel-specific extras/services catalog
-- Keeps every configurable price scoped by property_id in hotel_resources.

alter table public.hotel_resources
  drop constraint if exists hotel_resources_category_check;

alter table public.hotel_resources
  add constraint hotel_resources_category_check
  check (category = any (array[
    'parking'::text,
    'pet'::text,
    'spa'::text,
    'meeting_room'::text,
    'event_space'::text,
    'crib'::text,
    'equipment'::text,
    'transfer'::text,
    'amenity'::text,
    'sport'::text,
    'service'::text,
    'other'::text
  ]));

alter table public.hotel_resources
  drop constraint if exists hotel_resources_charge_mode_check;

alter table public.hotel_resources
  add constraint hotel_resources_charge_mode_check
  check (charge_mode = any (array[
    'per_use'::text,
    'per_stay'::text,
    'per_hour'::text,
    'per_day'::text,
    'per_night'::text,
    'per_person'::text
  ]));
