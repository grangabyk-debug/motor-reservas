create unique index if not exists hotel_reservation_guests_one_primary_per_reservation_idx
on public.hotel_reservation_guests(property_id,reservation_id)
where role='primary';

insert into public.hotel_reservation_guests(
  property_id,reservation_id,room_id,role,full_name,email,phone,document_type,document_number,
  birth_date,nationality,address,city,province,country,relationship,document_front_path,sort_order,created_by
)
select
  r.property_id,r.id,r.habitacion_id,'primary',coalesce(r.nombre_huesped,''),r.email_huesped,r.telefono_huesped,
  coalesce(r.tipo_documento_huesped,'DNI'),r.dni_huesped,r.fecha_nacimiento_huesped,r.nacionalidad_huesped,
  r.direccion_huesped,r.ciudad_huesped,r.provincia_estado_huesped,coalesce(r.pais_huesped,'Argentina'),
  'Titular',r.documento_path,0,r.user_id
from public.reservas r
where not exists (
  select 1 from public.hotel_reservation_guests g
  where g.property_id=r.property_id and g.reservation_id=r.id and g.role='primary'
)
on conflict do nothing;

create or replace function public.hl_create_primary_guest_for_reservation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  insert into public.hotel_reservation_guests(
    property_id,reservation_id,room_id,role,full_name,email,phone,document_type,document_number,
    birth_date,nationality,address,city,province,country,relationship,document_front_path,sort_order,created_by
  ) values (
    new.property_id,new.id,new.habitacion_id,'primary',coalesce(new.nombre_huesped,''),new.email_huesped,new.telefono_huesped,
    coalesce(new.tipo_documento_huesped,'DNI'),new.dni_huesped,new.fecha_nacimiento_huesped,new.nacionalidad_huesped,
    new.direccion_huesped,new.ciudad_huesped,new.provincia_estado_huesped,coalesce(new.pais_huesped,'Argentina'),
    'Titular',new.documento_path,0,new.user_id
  ) on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.hl_create_primary_guest_for_reservation() from public;

drop trigger if exists trg_hl_create_primary_guest_for_reservation on public.reservas;
create trigger trg_hl_create_primary_guest_for_reservation
after insert on public.reservas
for each row execute function public.hl_create_primary_guest_for_reservation();