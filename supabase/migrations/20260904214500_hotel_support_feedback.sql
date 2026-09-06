-- Habitación Llena — soporte y feedback de producto, aislado por propiedad.
-- Preparado para preview/staging. No aplicar directamente sobre producción sin QA.

begin;

create table if not exists public.hotel_support_threads(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  subject text not null check(length(subject) between 1 and 160),
  status text not null default 'open' check(status in('open','waiting_hotel','waiting_support','resolved','closed')),
  priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
  created_by uuid not null references auth.users(id) on delete restrict,
  assigned_label text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_support_threads_property_last_idx on public.hotel_support_threads(property_id,last_message_at desc);

create table if not exists public.hotel_support_messages(
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.hotel_support_threads(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_kind text not null default 'hotel' check(sender_kind in('hotel','support','system')),
  body text not null check(length(body) between 1 and 10000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hotel_support_messages_thread_idx on public.hotel_support_messages(thread_id,created_at);
create index if not exists hotel_support_messages_property_idx on public.hotel_support_messages(property_id,created_at desc);

create table if not exists public.hotel_product_feedback(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  category text not null default 'improvement' check(category in('improvement','idea','usability','integration','report','other')),
  title text not null check(length(title) between 3 and 160),
  body text not null check(length(body) between 3 and 10000),
  status text not null default 'received' check(status in('received','reviewing','planned','in_progress','shipped','declined')),
  support_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_product_feedback_property_idx on public.hotel_product_feedback(property_id,created_at desc);
create index if not exists hotel_product_feedback_status_idx on public.hotel_product_feedback(status,created_at desc);

alter table public.hotel_support_threads enable row level security;
alter table public.hotel_support_messages enable row level security;
alter table public.hotel_product_feedback enable row level security;

drop policy if exists hotel_support_threads_select_property on public.hotel_support_threads;
create policy hotel_support_threads_select_property on public.hotel_support_threads for select to authenticated
using(private.user_has_property_access(property_id));

drop policy if exists hotel_support_threads_insert_property on public.hotel_support_threads;
create policy hotel_support_threads_insert_property on public.hotel_support_threads for insert to authenticated
with check(private.user_has_property_access(property_id) and created_by=auth.uid());

drop policy if exists hotel_support_threads_update_property on public.hotel_support_threads;
create policy hotel_support_threads_update_property on public.hotel_support_threads for update to authenticated
using(private.user_has_property_access(property_id))
with check(private.user_has_property_access(property_id));

drop policy if exists hotel_support_messages_select_property on public.hotel_support_messages;
create policy hotel_support_messages_select_property on public.hotel_support_messages for select to authenticated
using(private.user_has_property_access(property_id));

drop policy if exists hotel_support_messages_insert_hotel on public.hotel_support_messages;
create policy hotel_support_messages_insert_hotel on public.hotel_support_messages for insert to authenticated
with check(
  private.user_has_property_access(property_id)
  and sender_kind='hotel'
  and sender_user_id=auth.uid()
  and exists(select 1 from public.hotel_support_threads t where t.id=thread_id and t.property_id=hotel_support_messages.property_id)
);

drop policy if exists hotel_product_feedback_select_property on public.hotel_product_feedback;
create policy hotel_product_feedback_select_property on public.hotel_product_feedback for select to authenticated
using(private.user_has_property_access(property_id));

drop policy if exists hotel_product_feedback_insert_property on public.hotel_product_feedback;
create policy hotel_product_feedback_insert_property on public.hotel_product_feedback for insert to authenticated
with check(private.user_has_property_access(property_id) and created_by=auth.uid());

drop policy if exists hotel_product_feedback_update_author on public.hotel_product_feedback;
create policy hotel_product_feedback_update_author on public.hotel_product_feedback for update to authenticated
using(private.user_has_property_access(property_id) and created_by=auth.uid() and status='received')
with check(private.user_has_property_access(property_id) and created_by=auth.uid());

grant select,insert,update on public.hotel_support_threads to authenticated;
grant select,insert on public.hotel_support_messages to authenticated;
grant select,insert,update on public.hotel_product_feedback to authenticated;

commit;
