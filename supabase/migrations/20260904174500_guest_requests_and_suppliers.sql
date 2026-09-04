-- Habitación Llena — backends faltantes: solicitudes de huésped y proveedores
-- EXPAND migration. Aplicar primero en preview/staging.

begin;

create table if not exists public.hotel_guest_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint references public.reservas(id) on delete set null,
  room_id bigint references public.habitaciones(id) on delete set null,
  guest_profile_id uuid references public.hotel_guest_profiles(id) on delete set null,
  category text not null default 'general' check (category in ('general','housekeeping','maintenance','food_beverage','transport','late_checkout','early_checkin','amenity','other')),
  title text not null check (length(trim(title)) between 1 and 180),
  description text,
  status text not null default 'open' check (status in ('open','acknowledged','in_progress','waiting_guest','completed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  source text not null default 'frontdesk' check (source in ('frontdesk','guest','web_checkin','whatsapp','email','phone','internal','other')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotel_guest_requests_property_status_idx on public.hotel_guest_requests(property_id,status,created_at desc);
create index if not exists hotel_guest_requests_reservation_idx on public.hotel_guest_requests(reservation_id) where reservation_id is not null;
create index if not exists hotel_guest_requests_room_idx on public.hotel_guest_requests(room_id) where room_id is not null;
create index if not exists hotel_guest_requests_assigned_idx on public.hotel_guest_requests(assigned_to,status) where assigned_to is not null;

alter table public.hotel_guest_requests enable row level security;

drop policy if exists hotel_guest_requests_select_access on public.hotel_guest_requests;
create policy hotel_guest_requests_select_access on public.hotel_guest_requests
for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_guest_requests_insert_access on public.hotel_guest_requests;
create policy hotel_guest_requests_insert_access on public.hotel_guest_requests
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit','housekeeping','maintenance']::text[]));

drop policy if exists hotel_guest_requests_update_access on public.hotel_guest_requests;
create policy hotel_guest_requests_update_access on public.hotel_guest_requests
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit','housekeeping','maintenance']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit','housekeeping','maintenance']::text[]));

drop policy if exists hotel_guest_requests_delete_management on public.hotel_guest_requests;
create policy hotel_guest_requests_delete_management on public.hotel_guest_requests
for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

create table if not exists public.hotel_suppliers (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 180),
  legal_name text,
  tax_id text,
  category text not null default 'other' check (category in ('food_beverage','cleaning','laundry','maintenance','amenities','technology','utilities','transport','professional','other')),
  contact_name text,
  email text,
  phone text,
  address text,
  city text,
  province text,
  country text,
  payment_terms text,
  notes text,
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(property_id,name)
);

create index if not exists hotel_suppliers_property_active_idx on public.hotel_suppliers(property_id,active,name);
create index if not exists hotel_suppliers_tax_id_idx on public.hotel_suppliers(property_id,tax_id) where tax_id is not null;

alter table public.hotel_suppliers enable row level security;

drop policy if exists hotel_suppliers_select_access on public.hotel_suppliers;
create policy hotel_suppliers_select_access on public.hotel_suppliers
for select to authenticated
using (private.user_has_property_access(property_id));

drop policy if exists hotel_suppliers_insert_management on public.hotel_suppliers;
create policy hotel_suppliers_insert_management on public.hotel_suppliers
for insert to authenticated
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists hotel_suppliers_update_management on public.hotel_suppliers;
create policy hotel_suppliers_update_management on public.hotel_suppliers
for update to authenticated
using (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]))
with check (private.user_has_property_role(property_id,array['owner','admin','manager']::text[]));

drop policy if exists hotel_suppliers_delete_management on public.hotel_suppliers;
create policy hotel_suppliers_delete_management on public.hotel_suppliers
for delete to authenticated
using (private.user_has_property_role(property_id,array['owner','admin']::text[]));

-- Integridad tenant: una solicitud nunca puede apuntar a una reserva/habitación/perfil de otra propiedad.
create or replace function private.hl_guest_request_tenant_guard()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $function$
begin
  if new.reservation_id is not null and not exists(select 1 from public.reservas r where r.id=new.reservation_id and r.property_id=new.property_id) then
    raise exception using errcode='23514',message='La reserva no pertenece a la propiedad.';
  end if;
  if new.room_id is not null and not exists(select 1 from public.habitaciones h where h.id=new.room_id and h.property_id=new.property_id) then
    raise exception using errcode='23514',message='La habitación no pertenece a la propiedad.';
  end if;
  if new.guest_profile_id is not null and not exists(select 1 from public.hotel_guest_profiles g where g.id=new.guest_profile_id and g.property_id=new.property_id) then
    raise exception using errcode='23514',message='El huésped no pertenece a la propiedad.';
  end if;
  new.updated_at:=now();
  if new.status='completed' and old.status is distinct from 'completed' then new.completed_at:=coalesce(new.completed_at,now()); end if;
  if new.status<>'completed' then new.completed_at:=null; end if;
  return new;
end
$function$;

drop trigger if exists hotel_guest_requests_tenant_guard on public.hotel_guest_requests;
create trigger hotel_guest_requests_tenant_guard
before insert or update on public.hotel_guest_requests
for each row execute function private.hl_guest_request_tenant_guard();

commit;
