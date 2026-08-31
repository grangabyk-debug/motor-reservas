create table if not exists public.hotel_guest_tag_catalog (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null,
  color text not null default '#173126',
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_guest_tag_catalog_label_check check (length(trim(label)) between 1 and 48),
  constraint hotel_guest_tag_catalog_color_check check (color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists hotel_guest_tag_catalog_property_label_uq
  on public.hotel_guest_tag_catalog(property_id, lower(trim(label)));
create index if not exists hotel_guest_tag_catalog_property_sort_idx
  on public.hotel_guest_tag_catalog(property_id, active, sort_order, label);

alter table public.hotel_guest_tag_catalog enable row level security;

drop policy if exists hotel_guest_tag_catalog_select_access on public.hotel_guest_tag_catalog;
create policy hotel_guest_tag_catalog_select_access on public.hotel_guest_tag_catalog
  for select using (private.user_has_property_access(property_id));

drop policy if exists hotel_guest_tag_catalog_write_management on public.hotel_guest_tag_catalog;
create policy hotel_guest_tag_catalog_write_management on public.hotel_guest_tag_catalog
  for all using (private.user_has_property_role(property_id, array['owner','manager']))
  with check (private.user_has_property_role(property_id, array['owner','manager']));

revoke all on public.hotel_guest_tag_catalog from anon;
grant select, insert, update, delete on public.hotel_guest_tag_catalog to authenticated;

insert into public.hotel_guest_tag_catalog(property_id,label,color,sort_order)
select distinct hp.property_id, seed.label, seed.color, seed.sort_order
from public.hotel_guest_profiles hp
cross join (values
  ('VIP','#7A5C16',10),
  ('Huésped frecuente','#2F6B4F',20),
  ('Corporativo','#2B5D76',30),
  ('Facturación empresa','#5A4C8A',40),
  ('Preferencia piso alto','#7B4D32',50),
  ('Early check-in','#3E6F75',60),
  ('Late check-out','#7A5365',70),
  ('Celebración','#8A6B2F',80)
) as seed(label,color,sort_order)
on conflict do nothing;

insert into public.hotel_guest_tag_catalog(property_id,label,color,sort_order)
select distinct hp.property_id, trim(tag), '#56645D', 500
from public.hotel_guest_profiles hp
cross join lateral unnest(coalesce(hp.tags,array[]::text[])) tag
where trim(tag) <> ''
on conflict do nothing;
