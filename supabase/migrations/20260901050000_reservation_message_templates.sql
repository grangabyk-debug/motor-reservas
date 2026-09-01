create table if not exists public.hotel_message_templates (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  code text not null,
  name text not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp','email')),
  subject text,
  body text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id, code, channel)
);

create index if not exists hotel_message_templates_property_sort_idx
  on public.hotel_message_templates(property_id, enabled, sort_order, name);
create index if not exists hotel_message_templates_created_by_idx
  on public.hotel_message_templates(created_by);

alter table public.hotel_message_templates enable row level security;

drop policy if exists hotel_message_templates_select_access on public.hotel_message_templates;
create policy hotel_message_templates_select_access
  on public.hotel_message_templates for select to authenticated
  using (private.user_has_property_access(property_id));

drop policy if exists hotel_message_templates_insert_access on public.hotel_message_templates;
create policy hotel_message_templates_insert_access
  on public.hotel_message_templates for insert to authenticated
  with check (private.user_has_property_access(property_id));

drop policy if exists hotel_message_templates_update_access on public.hotel_message_templates;
create policy hotel_message_templates_update_access
  on public.hotel_message_templates for update to authenticated
  using (private.user_has_property_access(property_id))
  with check (private.user_has_property_access(property_id));

drop policy if exists hotel_message_templates_delete_access on public.hotel_message_templates;
create policy hotel_message_templates_delete_access
  on public.hotel_message_templates for delete to authenticated
  using (private.user_has_property_access(property_id));

grant select, insert, update, delete on public.hotel_message_templates to authenticated;

create table if not exists public.hotel_reservation_messages (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  template_id uuid references public.hotel_message_templates(id) on delete set null,
  channel text not null check (channel in ('whatsapp','email')),
  status text not null default 'opened' check (status in ('prepared','opened','copied','sent','failed')),
  recipient text,
  subject text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hotel_reservation_messages_reservation_created_idx
  on public.hotel_reservation_messages(property_id, reservation_id, created_at desc);
create index if not exists hotel_reservation_messages_template_idx
  on public.hotel_reservation_messages(template_id);
create index if not exists hotel_reservation_messages_created_by_idx
  on public.hotel_reservation_messages(created_by);

alter table public.hotel_reservation_messages enable row level security;

drop policy if exists hotel_reservation_messages_select_access on public.hotel_reservation_messages;
create policy hotel_reservation_messages_select_access
  on public.hotel_reservation_messages for select to authenticated
  using (private.user_has_property_access(property_id));

drop policy if exists hotel_reservation_messages_insert_access on public.hotel_reservation_messages;
create policy hotel_reservation_messages_insert_access
  on public.hotel_reservation_messages for insert to authenticated
  with check (
    private.user_has_property_access(property_id)
    and exists (
      select 1 from public.reservas r
      where r.id = reservation_id and r.property_id = property_id
    )
  );

grant select, insert on public.hotel_reservation_messages to authenticated;
