-- Guest operations upgrade: individual passenger stays, group-room operations,
-- profile consolidation, check-in controls, finance timeline and optional auto no-show.

alter table public.hotel_reservation_guests add column if not exists stay_from date;
alter table public.hotel_reservation_guests add column if not exists stay_to date;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='hotel_reservation_guests_stay_dates_check') then
    alter table public.hotel_reservation_guests add constraint hotel_reservation_guests_stay_dates_check check (stay_from is null or stay_to is null or stay_to>=stay_from);
  end if;
end $$;

update public.hotel_reservation_guests g
set stay_from=coalesce(g.stay_from,r.fecha_entrada),
    stay_to=coalesce(g.stay_to,case when g.checked_out_at is not null then greatest(r.fecha_entrada,(g.checked_out_at at time zone 'America/Argentina/Buenos_Aires')::date) else r.fecha_salida end)
from public.reservas r
where r.id=g.reservation_id and (g.stay_from is null or g.stay_to is null);

create or replace function private.hl_sync_guest_profile_before()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare
  v_profile public.hotel_guest_profiles%rowtype;
  v_key text;
  v_email text:=lower(nullif(trim(coalesce(new.email,'')),''));
  v_doc text:=lower(nullif(trim(coalesce(new.document_number,'')),''));
  v_phone text:=nullif(regexp_replace(coalesce(new.phone,''),'\D','','g'),'');
  v_last date;
begin
  select r.fecha_salida into v_last from public.reservas r where r.id=new.reservation_id and r.property_id=new.property_id;
  if new.stay_from is null or new.stay_to is null then
    select coalesce(new.stay_from,r.fecha_entrada),coalesce(new.stay_to,r.fecha_salida)
      into new.stay_from,new.stay_to
    from public.reservas r where r.id=new.reservation_id and r.property_id=new.property_id;
  end if;
  if new.guest_profile_id is not null then
    select * into v_profile from public.hotel_guest_profiles p where p.id=new.guest_profile_id and p.property_id=new.property_id;
    if not found then new.guest_profile_id:=null; end if;
  end if;
  if new.guest_profile_id is null then
    if v_email is not null then v_key:='email:'||v_email;
    elsif v_doc is not null then v_key:='doc:'||v_doc;
    elsif v_phone is not null then v_key:='phone:'||v_phone;
    else v_key:='guest:'||new.id::text;
    end if;
    select * into v_profile
    from public.hotel_guest_profiles p
    where p.property_id=new.property_id
      and (p.canonical_key=v_key
        or (v_email is not null and lower(coalesce(p.email,''))=v_email)
        or (v_doc is not null and lower(coalesce(p.document_number,''))=v_doc)
        or (v_phone is not null and regexp_replace(coalesce(p.phone,''),'\D','','g')=v_phone))
    order by case when p.canonical_key=v_key then 0 else 1 end,p.created_at limit 1;
    if found then
      new.guest_profile_id:=v_profile.id;
    else
      insert into public.hotel_guest_profiles(property_id,canonical_key,full_name,email,phone,document_type,document_number,birth_date,nationality,address,city,province,country,sex,marital_status,cuil,postal_code,occupation,travel_reason,document_front_path,document_back_path,notes,last_stay_at)
      values(new.property_id,v_key,coalesce(nullif(trim(new.full_name),''),'Huésped'),nullif(trim(new.email),''),nullif(trim(new.phone),''),nullif(trim(new.document_type),''),nullif(trim(new.document_number),''),new.birth_date,nullif(trim(new.nationality),''),nullif(trim(new.address),''),nullif(trim(new.city),''),nullif(trim(new.province),''),nullif(trim(new.country),''),nullif(trim(new.sex),''),nullif(trim(new.marital_status),''),nullif(trim(new.cuil),''),nullif(trim(new.postal_code),''),nullif(trim(new.occupation),''),nullif(trim(new.travel_reason),''),new.document_front_path,new.document_back_path,nullif(trim(new.notes),''),v_last)
      on conflict(property_id,canonical_key) do update set
        full_name=case when nullif(trim(excluded.full_name),'') is not null then excluded.full_name else public.hotel_guest_profiles.full_name end,
        email=coalesce(excluded.email,public.hotel_guest_profiles.email),phone=coalesce(excluded.phone,public.hotel_guest_profiles.phone),
        document_type=coalesce(excluded.document_type,public.hotel_guest_profiles.document_type),document_number=coalesce(excluded.document_number,public.hotel_guest_profiles.document_number),
        birth_date=coalesce(excluded.birth_date,public.hotel_guest_profiles.birth_date),nationality=coalesce(excluded.nationality,public.hotel_guest_profiles.nationality),
        address=coalesce(excluded.address,public.hotel_guest_profiles.address),city=coalesce(excluded.city,public.hotel_guest_profiles.city),province=coalesce(excluded.province,public.hotel_guest_profiles.province),country=coalesce(excluded.country,public.hotel_guest_profiles.country),
        sex=coalesce(excluded.sex,public.hotel_guest_profiles.sex),marital_status=coalesce(excluded.marital_status,public.hotel_guest_profiles.marital_status),cuil=coalesce(excluded.cuil,public.hotel_guest_profiles.cuil),postal_code=coalesce(excluded.postal_code,public.hotel_guest_profiles.postal_code),occupation=coalesce(excluded.occupation,public.hotel_guest_profiles.occupation),travel_reason=coalesce(excluded.travel_reason,public.hotel_guest_profiles.travel_reason),
        document_front_path=coalesce(excluded.document_front_path,public.hotel_guest_profiles.document_front_path),document_back_path=coalesce(excluded.document_back_path,public.hotel_guest_profiles.document_back_path),
        last_stay_at=greatest(coalesce(public.hotel_guest_profiles.last_stay_at,excluded.last_stay_at),coalesce(excluded.last_stay_at,public.hotel_guest_profiles.last_stay_at)),updated_at=now()
      returning * into v_profile;
      new.guest_profile_id:=v_profile.id;
    end if;
  end if;
  if new.guest_profile_id is not null then
    update public.hotel_guest_profiles p set
      full_name=coalesce(nullif(trim(new.full_name),''),p.full_name),email=coalesce(nullif(trim(new.email),''),p.email),phone=coalesce(nullif(trim(new.phone),''),p.phone),
      document_type=coalesce(nullif(trim(new.document_type),''),p.document_type),document_number=coalesce(nullif(trim(new.document_number),''),p.document_number),birth_date=coalesce(new.birth_date,p.birth_date),
      nationality=coalesce(nullif(trim(new.nationality),''),p.nationality),address=coalesce(nullif(trim(new.address),''),p.address),city=coalesce(nullif(trim(new.city),''),p.city),province=coalesce(nullif(trim(new.province),''),p.province),country=coalesce(nullif(trim(new.country),''),p.country),
      sex=coalesce(nullif(trim(new.sex),''),p.sex),marital_status=coalesce(nullif(trim(new.marital_status),''),p.marital_status),cuil=coalesce(nullif(trim(new.cuil),''),p.cuil),postal_code=coalesce(nullif(trim(new.postal_code),''),p.postal_code),occupation=coalesce(nullif(trim(new.occupation),''),p.occupation),travel_reason=coalesce(nullif(trim(new.travel_reason),''),p.travel_reason),
      document_front_path=coalesce(new.document_front_path,p.document_front_path),document_back_path=coalesce(new.document_back_path,p.document_back_path),last_stay_at=greatest(coalesce(p.last_stay_at,v_last),coalesce(v_last,p.last_stay_at)),updated_at=now()
    where p.id=new.guest_profile_id and p.property_id=new.property_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_hl_guest_profile_sync_before on public.hotel_reservation_guests;
create trigger trg_hl_guest_profile_sync_before before insert or update of full_name,email,phone,document_type,document_number,birth_date,nationality,address,city,province,country,sex,marital_status,cuil,postal_code,occupation,travel_reason,document_front_path,document_back_path,guest_profile_id,stay_from,stay_to on public.hotel_reservation_guests for each row execute function private.hl_sync_guest_profile_before();

create or replace function private.hl_sync_guest_profile_after()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare v_count integer:=0;
begin
  if new.guest_profile_id is null then return new; end if;
  if new.role='primary' then update public.reservas set guest_profile_id=new.guest_profile_id where id=new.reservation_id and property_id=new.property_id; end if;
  select count(distinct g.reservation_id) into v_count
  from public.hotel_reservation_guests g join public.reservas r on r.id=g.reservation_id and r.property_id=g.property_id
  where g.property_id=new.property_id and g.guest_profile_id=new.guest_profile_id and r.estado<>'cancelada' and coalesce(r.no_show,false)=false;
  if v_count>=2 then update public.hotel_guest_profiles set vip_level='frequent',updated_at=now() where id=new.guest_profile_id and property_id=new.property_id and vip_level='standard'; end if;
  return new;
end $$;

drop trigger if exists trg_hl_guest_profile_sync_after on public.hotel_reservation_guests;
create trigger trg_hl_guest_profile_sync_after after insert or update of guest_profile_id,role,reservation_id on public.hotel_reservation_guests for each row execute function private.hl_sync_guest_profile_after();

create or replace function private.hl_log_guest_stay_change()
returns trigger
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare v_from text;v_to text;
begin
  if new.room_id is not distinct from old.room_id and new.stay_from is not distinct from old.stay_from and new.stay_to is not distinct from old.stay_to then return new; end if;
  select nombre into v_from from public.habitaciones where id=old.room_id and property_id=new.property_id;
  select nombre into v_to from public.habitaciones where id=new.room_id and property_id=new.property_id;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(new.property_id,new.reservation_id,'guest_stay_changed','Estadía de pasajero modificada',coalesce(new.full_name,'Pasajero')||' · '||coalesce('Hab. '||v_from,'Sin habitación')||' → '||coalesce('Hab. '||v_to,'Sin habitación')||' · '||coalesce(new.stay_from::text,'—')||' → '||coalesce(new.stay_to::text,'—'),jsonb_build_object('guest_id',new.id,'from_room_id',old.room_id,'to_room_id',new.room_id,'before_start',old.stay_from,'after_start',new.stay_from,'before_end',old.stay_to,'after_end',new.stay_to),auth.uid());
  return new;
end $$;

drop trigger if exists trg_hl_guest_stay_history on public.hotel_reservation_guests;
create trigger trg_hl_guest_stay_history after update of room_id,stay_from,stay_to on public.hotel_reservation_guests for each row execute function private.hl_log_guest_stay_change();

create or replace function public.hl_merge_guest_profiles_atomic(p_primary_id uuid,p_duplicate_id uuid)
returns public.hotel_guest_profiles
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare a public.hotel_guest_profiles%rowtype;b public.hotel_guest_profiles%rowtype;result public.hotel_guest_profiles%rowtype;v_res_ids bigint[];v_vip text;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  if p_primary_id is null or p_duplicate_id is null or p_primary_id=p_duplicate_id then raise exception using errcode='22023',message='Elegí dos perfiles distintos.'; end if;
  select * into a from public.hotel_guest_profiles where id=p_primary_id for update;select * into b from public.hotel_guest_profiles where id=p_duplicate_id for update;
  if a.id is null or b.id is null or a.property_id<>b.property_id then raise exception using errcode='P0002',message='Los perfiles no existen o no pertenecen al mismo hotel.'; end if;
  if not private.user_has_property_role(a.property_id,array['owner','admin','manager']::text[]) then raise exception using errcode='42501',message='Sólo un supervisor puede fusionar perfiles.'; end if;
  select array_agg(distinct x) into v_res_ids from (select id x from public.reservas where property_id=a.property_id and guest_profile_id in(a.id,b.id) union select reservation_id from public.hotel_reservation_guests where property_id=a.property_id and guest_profile_id in(a.id,b.id)) q;
  v_vip:=case greatest(case a.vip_level when 'signature' then 4 when 'vip' then 3 when 'frequent' then 2 else 1 end,case b.vip_level when 'signature' then 4 when 'vip' then 3 when 'frequent' then 2 else 1 end) when 4 then 'signature' when 3 then 'vip' when 2 then 'frequent' else 'standard' end;
  update public.reservas set guest_profile_id=a.id where property_id=a.property_id and guest_profile_id=b.id;
  update public.hotel_reservation_guests set guest_profile_id=a.id where property_id=a.property_id and guest_profile_id=b.id;
  update public.hotel_reservation_documents set guest_profile_id=a.id where property_id=a.property_id and guest_profile_id=b.id;
  update public.inbox_conversations set guest_profile_id=a.id where property_id=a.property_id and guest_profile_id=b.id;
  update public.hotel_guest_profiles set full_name=coalesce(nullif(trim(a.full_name),''),b.full_name),email=coalesce(a.email,b.email),phone=coalesce(a.phone,b.phone),document_type=coalesce(a.document_type,b.document_type),document_number=coalesce(a.document_number,b.document_number),birth_date=coalesce(a.birth_date,b.birth_date),nationality=coalesce(a.nationality,b.nationality),language=coalesce(a.language,b.language),address=coalesce(a.address,b.address),city=coalesce(a.city,b.city),province=coalesce(a.province,b.province),country=coalesce(a.country,b.country),preferences=coalesce(b.preferences,'{}'::jsonb)||coalesce(a.preferences,'{}'::jsonb),tags=(select coalesce(array_agg(distinct x order by x),'{}'::text[]) from unnest(coalesce(a.tags,'{}'::text[])||coalesce(b.tags,'{}'::text[])) x),vip_level=v_vip,notes=case when nullif(trim(coalesce(a.notes,'')),'') is null then b.notes when nullif(trim(coalesce(b.notes,'')),'') is null or trim(a.notes)=trim(b.notes) then a.notes else a.notes||E'\n'||b.notes end,last_stay_at=greatest(coalesce(a.last_stay_at,b.last_stay_at),coalesce(b.last_stay_at,a.last_stay_at)),updated_at=now() where id=a.id returning * into result;
  delete from public.hotel_guest_profiles where id=b.id;
  if v_res_ids is not null then insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) select a.property_id,x,'guest_profile_merged','Perfiles de huésped fusionados','Se unificaron perfiles duplicados y se conservaron historial, contacto y preferencias.',jsonb_build_object('primary_profile_id',a.id,'merged_profile_id',b.id),auth.uid() from unnest(v_res_ids) x; end if;
  return result;
end $$;

create or replace function public.hl_update_reservation_guest_stay_atomic(p_guest_id uuid,p_room_id bigint,p_stay_from date,p_stay_to date)
returns public.hotel_reservation_guests
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare g public.hotel_reservation_guests%rowtype;r public.reservas%rowtype;h public.habitaciones%rowtype;v_detail jsonb;v_ord bigint;v_details jsonb;v_room_start date;v_room_end date;v_rate numeric:=0;v_extra integer:=0;v_subtotal numeric;v_discount numeric;v_net numeric;v_vat numeric;v_total numeric;v_vat_rate numeric;out_guest public.hotel_reservation_guests%rowtype;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into g from public.hotel_reservation_guests where id=p_guest_id for update;if not found then raise exception using errcode='P0002',message='Pasajero inexistente.'; end if;
  select * into r from public.reservas where id=g.reservation_id for update;
  if not private.user_has_property_role(r.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para modificar la estadía del pasajero.'; end if;
  if r.estado in('cancelada','finalizada') or coalesce(r.no_show,false) then raise exception using errcode='P0001',message='La reserva ya no admite cambios de pasajeros.'; end if;
  if p_room_id is null or p_stay_from is null or p_stay_to is null or p_stay_to<=p_stay_from then raise exception using errcode='22007',message='La salida del pasajero debe ser posterior a su entrada.'; end if;
  if not (p_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id])) then raise exception using errcode='22023',message='La habitación elegida no pertenece a esta reserva.'; end if;
  select * into h from public.habitaciones where id=p_room_id and property_id=r.property_id and activa is distinct from false;if not found then raise exception using errcode='P0002',message='Habitación inexistente o inactiva.'; end if;
  select e,ord into v_detail,v_ord from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord) where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' order by ord desc limit 1;
  if v_detail is null then raise exception using errcode='22023',message='La habitación no tiene un tramo activo dentro de la reserva.'; end if;
  v_room_start:=coalesce(nullif(v_detail->>'fecha_entrada','')::date,r.fecha_entrada);v_room_end:=coalesce(nullif(v_detail->>'fecha_salida','')::date,r.fecha_salida);
  if p_stay_from<v_room_start then raise exception using errcode='22007',message='La entrada del pasajero no puede ser anterior al inicio de esa habitación.'; end if;
  if p_stay_to>v_room_end then
    if exists(select 1 from public.reservas x where x.property_id=r.property_id and x.id<>r.id and x.estado<>'cancelada' and coalesce(x.no_show,false)=false and p_room_id=any(coalesce(x.habitaciones_ids,array[]::bigint[])||array[x.habitacion_id]) and public.hl_reservation_room_start_date(x.habitaciones_detalle,p_room_id,x.fecha_entrada)<p_stay_to and public.hl_reservation_room_effective_end_date(x.habitaciones_detalle,x.room_checkout_dates,p_room_id,x.fecha_salida)>v_room_end) then raise exception using errcode='23P01',message='La habitación tiene otra reserva durante la extensión.'; end if;
    if exists(select 1 from public.bloqueos b where b.property_id=r.property_id and b.habitacion_id=p_room_id and b.fecha_desde<p_stay_to and b.fecha_hasta>v_room_end) then raise exception using errcode='23P01',message='La habitación tiene un bloqueo operativo durante la extensión.'; end if;
    v_rate:=greatest(0,coalesce(nullif(v_detail->>'tarifa_noche','')::numeric,h.precio,0));v_extra:=p_stay_to-v_room_end;
    select coalesce(jsonb_agg(case when ord=v_ord then e||jsonb_build_object('fecha_salida',p_stay_to,'noches',greatest(1,p_stay_to-v_room_start)) else e end order by ord),'[]'::jsonb) into v_details from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);
    v_subtotal:=greatest(0,coalesce(r.subtotal,0)+v_rate*v_extra);
    if lower(coalesce(r.descuento_tipo,'')) in('percent','porcentaje','percentage') then v_discount:=round(v_subtotal*least(100,greatest(0,coalesce(r.descuento_valor,0)))/100,2);elsif lower(coalesce(r.descuento_tipo,'')) in('amount','importe','fixed','fijo') then v_discount:=least(v_subtotal,greatest(0,coalesce(r.descuento_importe,r.descuento_valor,0)));else v_discount:=least(v_subtotal,greatest(0,coalesce(r.descuento_importe,0)));end if;
    v_net:=round(greatest(0,v_subtotal-v_discount),2);v_vat_rate:=case when coalesce(r.impuestos_desglosados,false) then greatest(0,coalesce(r.iva_porcentaje,0)) else 0 end;v_vat:=case when coalesce(r.impuestos_desglosados,false) then round(v_net*v_vat_rate/100,2) else 0 end;v_total:=round(v_net+v_vat,2);
    update public.reservas set habitaciones_detalle=v_details,fecha_salida=greatest(fecha_salida,p_stay_to),subtotal=v_subtotal,descuento_importe=v_discount,precio_sin_impuestos_nacionales=v_net,iva_importe=v_vat,precio_total=v_total,precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end where id=r.id returning * into r;
    perform private.hl_sync_reservation_folios_internal(r.id);
  elsif p_stay_to>public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,p_room_id,r.fecha_salida) then raise exception using errcode='22007',message='La habitación ya fue liberada antes de la salida indicada.'; end if;
  update public.hotel_reservation_guests set room_id=p_room_id,stay_from=p_stay_from,stay_to=p_stay_to,updated_at=now() where id=g.id returning * into out_guest;
  return out_guest;
end $$;

create or replace function private.enforce_reservation_room_integrity()
returns trigger
language plpgsql
set search_path='pg_catalog','public','private'
as $$
declare v_room_id bigint;v_room_ids bigint[];v_room_label text;v_old_count integer;v_new_count integer;v_ops jsonb:='{}'::jsonb;v_checkin time:='14:00';v_checkout time:='10:00';v_cutoff time:='05:00';v_arrival time;v_departure time;v_start timestamp;v_end timestamp;v_room_start date;v_room_end date;v_room_start_ts timestamp;v_room_end_ts timestamp;
begin
 if tg_op='UPDATE' then v_old_count:=coalesce(array_length(old.habitaciones_ids,1),case when old.habitacion_id is null then 0 else 1 end);v_new_count:=coalesce(array_length(new.habitaciones_ids,1),case when new.habitacion_id is null then 0 else 1 end);if v_old_count>1 and v_new_count<v_old_count and old.habitaciones_ids is distinct from new.habitaciones_ids and coalesce(current_setting('app.hl_group_room_operation',true),'')<>'on' then raise exception using errcode='23P01',message='La reserva ocupa varias habitaciones. Usá una operación grupal para modificar su asignación.';end if;if new.room_checkout_dates is distinct from old.room_checkout_dates and new.habitacion_id is not distinct from old.habitacion_id and new.habitaciones_ids is not distinct from old.habitaciones_ids and new.fecha_entrada is not distinct from old.fecha_entrada and new.fecha_salida is not distinct from old.fecha_salida and new.tipo_estadia is not distinct from old.tipo_estadia and new.hora_llegada_estimada is not distinct from old.hora_llegada_estimada and new.hora_salida_estimada is not distinct from old.hora_salida_estimada then return new;end if;end if;
 new.tipo_estadia:=coalesce(nullif(new.tipo_estadia,''),'overnight');if new.tipo_estadia not in('overnight','day_use') then raise exception using errcode='22023',message='Tipo de estadía inválido.';end if;
 select coalesce(operational_settings,'{}'::jsonb) into v_ops from public.hotel_os_settings where property_id=new.property_id;v_ops:=coalesce(v_ops,'{}'::jsonb);v_checkin:=private.hl_safe_time(v_ops->>'checkin_time','14:00'::time);v_checkout:=private.hl_safe_time(v_ops->>'checkout_time','10:00'::time);v_cutoff:=private.hl_safe_time(v_ops->>'business_day_cutoff','05:00'::time);v_arrival:=private.hl_safe_time(new.hora_llegada_estimada,v_checkin);v_departure:=private.hl_safe_time(new.hora_salida_estimada,v_checkout);new.hora_llegada_estimada:=to_char(v_arrival,'HH24:MI');new.hora_salida_estimada:=to_char(v_departure,'HH24:MI');
 if new.fecha_entrada is null or new.fecha_salida is null then raise exception using errcode='22007',message='La reserva necesita fecha de entrada y salida.';end if;if new.fecha_salida<new.fecha_entrada then raise exception using errcode='22007',message='La fecha de salida no puede ser anterior a la entrada.';end if;if new.tipo_estadia='day_use' and new.fecha_salida<>new.fecha_entrada then raise exception using errcode='22007',message='Day Use debe comenzar y terminar el mismo día.';end if;
 v_start:=new.fecha_entrada::timestamp+v_arrival;v_end:=new.fecha_salida::timestamp+v_departure;if v_end<=v_start then raise exception using errcode='22007',message='La hora de salida debe ser posterior a la hora de entrada.';end if;new.ocupacion_desde_local:=v_start;new.ocupacion_hasta_local:=v_end;new.fecha_operativa:=case when new.tipo_estadia='overnight' and v_arrival<v_cutoff then new.fecha_entrada-1 else new.fecha_entrada end;new.noches:=case when new.tipo_estadia='day_use' then 0 else greatest(1,new.fecha_salida-new.fecha_operativa) end;
 if new.estado in('cancelada','finalizada') or coalesce(new.no_show,false) then return new;end if;
 select coalesce(array_agg(distinct x order by x),array[]::bigint[]) into v_room_ids from unnest(coalesce(new.habitaciones_ids,array[]::bigint[])||array[new.habitacion_id]) x where x is not null;if coalesce(array_length(v_room_ids,1),0)=0 then if coalesce(current_setting('app.hl_import_mode',true),'')='on' and coalesce(new.codigo_canal,'') like 'BDC:%' then return new;end if;raise exception using errcode='23502',message='La reserva necesita al menos una habitación.';end if;
 foreach v_room_id in array v_room_ids loop v_room_start:=public.hl_reservation_room_start_date(new.habitaciones_detalle,v_room_id,new.fecha_entrada);v_room_end:=public.hl_reservation_room_effective_end_date(new.habitaciones_detalle,new.room_checkout_dates,v_room_id,new.fecha_salida);if v_room_end<=v_room_start then if coalesce(new.room_checkout_dates,'{}'::jsonb)?v_room_id::text then continue;end if;raise exception using errcode='22007',message='Cada habitación necesita una salida posterior a su entrada.';end if;v_room_start_ts:=v_room_start::timestamp+v_arrival;v_room_end_ts:=v_room_end::timestamp+v_departure;select coalesce(nullif(trim(h.nombre),''),h.id::text) into v_room_label from public.habitaciones h where h.id=v_room_id and h.property_id=new.property_id;v_room_label:=coalesce(v_room_label,v_room_id::text);perform pg_advisory_xact_lock(hashtextextended(new.property_id::text||':'||v_room_id::text,0));if exists(select 1 from public.reservas r where r.property_id=new.property_id and r.id<>coalesce(new.id,-1) and r.estado<>'cancelada' and coalesce(r.no_show,false)=false and v_room_id=any(coalesce(r.habitaciones_ids,array[]::bigint[])||array[r.habitacion_id]) and tsrange(public.hl_reservation_room_start_date(r.habitaciones_detalle,v_room_id,r.fecha_entrada)::timestamp+private.hl_safe_time(r.hora_llegada_estimada,v_checkin),public.hl_reservation_room_effective_end_date(r.habitaciones_detalle,r.room_checkout_dates,v_room_id,r.fecha_salida)::timestamp+private.hl_safe_time(r.hora_salida_estimada,v_checkout),'[)')&&tsrange(v_room_start_ts,v_room_end_ts,'[)')) then raise exception using errcode='23P01',message=format('La habitación %s ya está ocupada durante parte de ese horario.',v_room_label);end if;if exists(select 1 from public.bloqueos b where b.property_id=new.property_id and b.habitacion_id=v_room_id and tsrange(b.fecha_desde::timestamp,b.fecha_hasta::timestamp,'[)')&&tsrange(v_room_start_ts,v_room_end_ts,'[)')) then raise exception using errcode='23P01',message=format('La habitación %s tiene un bloqueo operativo durante ese horario.',v_room_label);end if;end loop;return new;
end $$;

create or replace function public.hl_checkin_reservation_atomic(p_reserva_id bigint)
returns public.reservas
language plpgsql
set search_path='public','private','pg_temp'
as $$
declare v public.reservas%rowtype;v_room_ids bigint[];v_bad_rooms text;v_dirty_rooms text;v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;v_policy text:='allow';v_is_manager boolean:=false;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;select * into v from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-in.';end if;if v.estado in('cancelada','finalizada') or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva no admite check-in en su estado actual.';end if;
 select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires'),coalesce(nullif(settings->'preferences'->>'checkin_dirty_room_policy',''),'allow') into v_timezone,v_policy from public.property_settings where property_id=v.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');v_policy:=lower(coalesce(v_policy,'allow'));begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;if v.fecha_entrada>v_local_date then raise exception using errcode='P0001',message='El check-in no puede realizarse antes de la fecha de llegada.';end if;if v.fecha_salida<v_local_date then raise exception using errcode='P0001',message='La estadía ya quedó fuera de fecha. Revisá las fechas antes del check-in.';end if;
 v_room_ids:=case when v.habitaciones_ids is not null and cardinality(v.habitaciones_ids)>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;if cardinality(v_room_ids)=0 then raise exception using errcode='P0001',message='Asigná una habitación antes de hacer el check-in.';end if;if (select count(*) from public.habitaciones h where h.property_id=v.property_id and h.id=any(v_room_ids))<>cardinality(v_room_ids) then raise exception using errcode='P0001',message='Hay una habitación asignada que no pertenece a la propiedad o ya no existe.';end if;
 select string_agg(coalesce(h.nombre,h.id::text)||' ('||coalesce(h.estado,'sin estado')||')',', ' order by h.nombre) into v_bad_rooms from public.habitaciones h where h.property_id=v.property_id and h.id=any(v_room_ids) and (h.activa is false or lower(coalesce(h.estado,'')) not in('libre','limpia','inspeccionada','sucia'));if v_bad_rooms is not null then raise exception using errcode='P0001',message='No se puede hacer check-in: revisá el estado de '||v_bad_rooms||'.';end if;
 select string_agg(coalesce(h.nombre,h.id::text),', ' order by h.nombre) into v_dirty_rooms from public.habitaciones h where h.property_id=v.property_id and h.id=any(v_room_ids) and lower(coalesce(h.estado,''))='sucia';v_is_manager:=private.user_has_property_role(v.property_id,array['owner','admin','manager']::text[]);if v_dirty_rooms is not null and (v_policy='block' or (v_policy='manager_only' and not v_is_manager)) then raise exception using errcode='P0001',message=case when v_policy='manager_only' then 'La habitación está sucia. Se requiere autorización de supervisor para continuar: '||v_dirty_rooms else 'No se puede hacer check-in con habitaciones sucias: '||v_dirty_rooms end;end if;
 update public.reservas set estado='alojado' where id=v.id returning * into v;update public.hotel_reservation_guests set stay_from=coalesce(stay_from,v.fecha_entrada),stay_to=coalesce(stay_to,v.fecha_salida),updated_at=now() where reservation_id=v.id and property_id=v.property_id;return v;
end $$;

create or replace function public.hl_checkout_reservation_guest_atomic(p_guest_id uuid)
returns jsonb
language plpgsql
set search_path='public','private','pg_temp'
as $$
declare g public.hotel_reservation_guests%rowtype;r public.reservas%rowtype;v_empty boolean:=false;v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;v_active_room integer:=0;v_active_total integer:=0;v_details jsonb;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;select * into g from public.hotel_reservation_guests where id=p_guest_id for update;if not found then raise exception using errcode='P0002',message='Pasajero inexistente.';end if;select * into r from public.reservas where id=g.reservation_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;if not private.user_has_property_role(r.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.';end if;if r.estado='cancelada' or coalesce(r.no_show,false) or r.estado='finalizada' then raise exception using errcode='P0001',message='La reserva no admite check-out de pasajeros.';end if;if r.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in de la reserva.';end if;
 select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=r.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;
 if g.checked_out_at is null then update public.hotel_reservation_guests set checked_out_at=now(),checked_out_by=auth.uid(),stay_to=greatest(coalesce(stay_from,r.fecha_entrada),v_local_date),updated_at=now() where id=g.id returning * into g;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(r.property_id,r.id,'guest_checkout','Check-out de pasajero',coalesce(g.full_name,'Pasajero')||' realizó check-out.',jsonb_build_object('guest_id',g.id,'room_id',g.room_id,'checked_out_at',g.checked_out_at,'stay_to',g.stay_to),auth.uid());end if;
 if g.room_id is not null then select count(*) into v_active_room from public.hotel_reservation_guests x where x.reservation_id=r.id and x.room_id=g.room_id and x.checked_out_at is null;v_empty:=v_active_room=0;end if;select count(*) into v_active_total from public.hotel_reservation_guests x where x.reservation_id=r.id and x.checked_out_at is null;select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=g.room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' then e||jsonb_build_object('huespedes',v_active_room) else e end order by ord),'[]'::jsonb) into v_details from jsonb_array_elements(coalesce(r.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);update public.reservas set cantidad_huespedes=v_active_total,habitaciones_detalle=v_details where id=r.id;return jsonb_build_object('guest_id',g.id,'room_id',g.room_id,'checked_out_at',g.checked_out_at,'room_empty',v_empty,'active_guests',v_active_total);
end $$;

create or replace function public.hl_checkout_reservation_room_atomic(p_reserva_id bigint,p_room_id bigint)
returns jsonb
language plpgsql
set search_path='public','private','pg_temp'
as $$
declare v public.reservas%rowtype;v_room_ids bigint[];v_remaining bigint[];v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;v_room_name text;v_final public.reservas%rowtype;v_active_total integer:=0;v_details jsonb;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;select * into v from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.';end if;if v.estado='cancelada' or coalesce(v.no_show,false) or v.estado='finalizada' then raise exception using errcode='P0001',message='La reserva no admite check-out de habitación.';end if;if v.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in de la reserva.';end if;
 v_room_ids:=case when cardinality(coalesce(v.habitaciones_ids,array[]::bigint[]))>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;if not(p_room_id=any(v_room_ids)) then raise exception using errcode='22023',message='La habitación no pertenece a esta reserva.';end if;select nombre into v_room_name from public.habitaciones where id=p_room_id and property_id=v.property_id;select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=v.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;
 update public.hotel_reservation_guests set checked_out_at=coalesce(checked_out_at,now()),checked_out_by=coalesce(checked_out_by,auth.uid()),stay_to=greatest(coalesce(stay_from,v.fecha_entrada),v_local_date),updated_at=now() where reservation_id=v.id and property_id=v.property_id and room_id=p_room_id and checked_out_at is null;v.room_checkout_dates:=jsonb_set(coalesce(v.room_checkout_dates,'{}'::jsonb),array[p_room_id::text],to_jsonb(v_local_date::text),true);select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' then e||jsonb_build_object('huespedes',0) else e end order by ord),'[]'::jsonb) into v_details from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);select count(*) into v_active_total from public.hotel_reservation_guests x where x.reservation_id=v.id and x.checked_out_at is null;update public.reservas set room_checkout_dates=v.room_checkout_dates,habitaciones_detalle=v_details,cantidad_huespedes=v_active_total where id=v.id returning * into v;update public.habitaciones set estado='sucia' where property_id=v.property_id and id=p_room_id;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'room_checkout','Check-out de habitación','Se liberó la habitación '||coalesce(v_room_name,p_room_id::text)||' sin modificar la tarifa contratada.',jsonb_build_object('room_id',p_room_id,'room_name',v_room_name,'checkout_date',v_local_date),auth.uid());select coalesce(array_agg(x order by x),array[]::bigint[]) into v_remaining from unnest(v_room_ids) x where public.hl_reservation_room_effective_end_date(v.habitaciones_detalle,v.room_checkout_dates,x,v.fecha_salida)>v_local_date;if cardinality(v_remaining)=0 then v_final:=public.hl_checkout_reservation_atomic(v.id);return jsonb_build_object('reservation_id',v_final.id,'room_id',p_room_id,'checkout_date',v_local_date,'remaining_room_ids',v_remaining,'finalized',true,'estado',v_final.estado);end if;return jsonb_build_object('reservation_id',v.id,'room_id',p_room_id,'checkout_date',v_local_date,'remaining_room_ids',v_remaining,'finalized',false,'estado',v.estado);
end $$;

create or replace function public.hl_checkout_reservation_atomic(p_reserva_id bigint)
returns public.reservas
language plpgsql
set search_path='public','private','pg_temp'
as $$
declare v public.reservas%rowtype;v_paid numeric:=0;v_balance numeric:=0;v_room_ids bigint[];v_dirty_room_ids bigint[];v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;rid bigint;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;select * into v from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para realizar el check-out.';end if;if v.estado='cancelada' or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva no admite check-out.';end if;if v.estado='finalizada' then return v;end if;if v.estado<>'alojado' then raise exception using errcode='P0001',message='Primero realizá el check-in antes del check-out.';end if;
 select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.reserva_id=v.id and p.property_id=v.property_id and lower(coalesce(p.estado,'')) not in('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');v_balance:=greatest(0,coalesce(v.precio_total,0)-v_paid);if v_balance>0.01 then raise exception using errcode='P0001',message='La reserva tiene saldo pendiente de '||round(v_balance,2)::text||' '||coalesce(v.moneda,'ARS')||'. Registrá o conciliá el pago antes del check-out.';end if;
 select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=v.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;v_room_ids:=case when v.habitaciones_ids is not null and cardinality(v.habitaciones_ids)>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;select coalesce(array_agg(x order by x),array[]::bigint[]) into v_dirty_room_ids from unnest(v_room_ids) x where public.hl_reservation_room_effective_end_date(v.habitaciones_detalle,v.room_checkout_dates,x,v.fecha_salida)>v_local_date;foreach rid in array v_room_ids loop v.room_checkout_dates:=jsonb_set(coalesce(v.room_checkout_dates,'{}'::jsonb),array[rid::text],to_jsonb(v_local_date::text),true);end loop;update public.reservas set estado='finalizada',checkout_real_at=now(),room_checkout_dates=v.room_checkout_dates,cantidad_huespedes=0 where id=v.id returning * into v;update public.hotel_reservation_guests set checked_out_at=coalesce(checked_out_at,now()),checked_out_by=coalesce(checked_out_by,auth.uid()),stay_to=greatest(coalesce(stay_from,v.fecha_entrada),v_local_date),updated_at=now() where reservation_id=v.id and property_id=v.property_id and checked_out_at is null;if cardinality(v_dirty_room_ids)>0 then update public.habitaciones set estado='sucia' where property_id=v.property_id and id=any(v_dirty_room_ids);end if;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'checkout','Check-out de reserva','Se finalizó la estadía y se liberaron todas las habitaciones.',jsonb_build_object('room_ids',v_room_ids,'checkout_date',v_local_date),auth.uid());return v;
end $$;

create or replace function public.hl_cancel_group_room_atomic(p_reserva_id bigint,p_room_id bigint,p_effective_date date default null,p_penalty_amount numeric default 0,p_recalculate boolean default true,p_note text default null)
returns public.reservas
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare v public.reservas%rowtype;h public.habitaciones%rowtype;v_detail jsonb;v_details jsonb:='[]'::jsonb;v_ids bigint[];v_other bigint[];v_start date;v_end date;v_effective date;v_rate numeric:=0;v_cancel_nights integer:=0;v_penalty numeric:=greatest(0,coalesce(p_penalty_amount,0));v_subtotal numeric;v_discount numeric;v_net numeric;v_vat_rate numeric;v_vat numeric;v_total numeric;v_total_rate numeric:=0;v_new_start date;v_new_end date;v_timezone text:='America/Argentina/Buenos_Aires';v_local_date date;v_services jsonb;v_active integer:=0;out_res public.reservas%rowtype;
begin
 if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.';end if;select * into v from public.reservas where id=p_reserva_id for update;if not found then raise exception using errcode='P0002',message='Reserva inexistente.';end if;if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para cancelar una habitación del grupo.';end if;if v.estado in('cancelada','finalizada') or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='La reserva ya no admite cambios.';end if;
 v_ids:=case when cardinality(coalesce(v.habitaciones_ids,array[]::bigint[]))>0 then v.habitaciones_ids when v.habitacion_id is not null then array[v.habitacion_id] else array[]::bigint[] end;if cardinality(v_ids)<=1 or not(p_room_id=any(v_ids)) then raise exception using errcode='22023',message='Esta operación se usa para quitar una habitación de una reserva grupal.';end if;select * into h from public.habitaciones where id=p_room_id and property_id=v.property_id;if not found then raise exception using errcode='P0002',message='Habitación inexistente.';end if;if exists(select 1 from public.hotel_finance_documents d where d.property_id=v.property_id and d.reservation_id=v.id and coalesce(d.total,0)>0 and d.status not in('draft','void')) then raise exception using errcode='P0001',message='La reserva tiene comprobantes emitidos. Rectificá la facturación antes de cancelar una habitación.';end if;
 select e into v_detail from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) e where coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' order by coalesce(e->>'fecha_entrada',v.fecha_entrada::text) desc limit 1;if v_detail is null then raise exception using errcode='P0002',message='No encontramos el tramo activo de esa habitación.';end if;v_start:=coalesce(nullif(v_detail->>'fecha_entrada','')::date,v.fecha_entrada);v_end:=coalesce(nullif(v_detail->>'fecha_salida','')::date,v.fecha_salida);v_rate:=greatest(0,coalesce(nullif(v_detail->>'tarifa_noche','')::numeric,h.precio,0));select coalesce(nullif(settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires') into v_timezone from public.property_settings where property_id=v.property_id;v_timezone:=coalesce(v_timezone,'America/Argentina/Buenos_Aires');begin v_local_date:=(now() at time zone v_timezone)::date;exception when others then v_local_date:=(now() at time zone 'America/Argentina/Buenos_Aires')::date;end;v_effective:=coalesce(p_effective_date,case when v.estado='alojado' then v_local_date else v_start end);if v_effective<v_start then v_effective:=v_start;end if;if v_effective>v_end then raise exception using errcode='22007',message='La fecha de cancelación no puede ser posterior a la salida de esa habitación.';end if;v_cancel_nights:=greatest(0,v_end-v_effective);select array_agg(x order by ord) into v_other from unnest(v_ids) with ordinality t(x,ord) where x<>p_room_id;if cardinality(coalesce(v_other,array[]::bigint[]))=0 then raise exception using errcode='P0001',message='Es la última habitación. Usá la cancelación de la reserva completa.';end if;
 if v.estado<>'alojado' and v_effective<=v_start then perform set_config('app.hl_group_room_operation','on',true);select coalesce(jsonb_agg(e order by ord),'[]'::jsonb) into v_details from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord) where not(coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id);select min(public.hl_reservation_room_start_date(v_details,x,v.fecha_entrada)),max(public.hl_reservation_room_planned_end_date(v_details,x,v.fecha_salida)) into v_new_start,v_new_end from unnest(v_other) x;else select coalesce(jsonb_agg(case when coalesce(e->>'habitacion_id','')~'^\d+$' and (e->>'habitacion_id')::bigint=p_room_id and coalesce(e->>'segment_role','active_room')<>'previous_room' then e||jsonb_build_object('fecha_salida',v_effective,'noches',greatest(0,v_effective-v_start),'huespedes',0,'segment_role','cancelled_room','cancellation_note',nullif(trim(coalesce(p_note,'')),'')) else e end order by ord),'[]'::jsonb) into v_details from jsonb_array_elements(coalesce(v.habitaciones_detalle,'[]'::jsonb)) with ordinality t(e,ord);v_other:=v_ids;v_new_start:=v.fecha_entrada;v_new_end:=v.fecha_salida;v.room_checkout_dates:=jsonb_set(coalesce(v.room_checkout_dates,'{}'::jsonb),array[p_room_id::text],to_jsonb(v_effective::text),true);end if;
 select coalesce(sum(case when coalesce(e->>'segment_role','') in('previous_room','cancelled_room') then 0 else coalesce(nullif(e->>'tarifa_noche','')::numeric,0) end),0) into v_total_rate from jsonb_array_elements(v_details) e;v_subtotal:=greatest(0,coalesce(v.subtotal,0)-case when p_recalculate then v_rate*v_cancel_nights else 0 end+v_penalty);if lower(coalesce(v.descuento_tipo,'')) in('percent','porcentaje','percentage') then v_discount:=round(v_subtotal*least(100,greatest(0,coalesce(v.descuento_valor,0)))/100,2);elsif lower(coalesce(v.descuento_tipo,'')) in('amount','importe','fixed','fijo') then v_discount:=least(v_subtotal,greatest(0,coalesce(v.descuento_importe,v.descuento_valor,0)));else v_discount:=least(v_subtotal,greatest(0,coalesce(v.descuento_importe,0)));end if;v_net:=round(greatest(0,v_subtotal-v_discount),2);v_vat_rate:=case when coalesce(v.impuestos_desglosados,false) then greatest(0,coalesce(v.iva_porcentaje,0)) else 0 end;v_vat:=case when coalesce(v.impuestos_desglosados,false) then round(v_net*v_vat_rate/100,2) else 0 end;v_total:=round(v_net+v_vat,2);v_services:=coalesce(v.servicios,'[]'::jsonb);if v_penalty>0 then v_services:=v_services||jsonb_build_array(jsonb_build_object('id','room-cancel-'||p_room_id::text||'-'||extract(epoch from clock_timestamp())::bigint,'categoria','fee','nombre','Penalidad por cancelación de habitación','detalle',coalesce(nullif(trim(coalesce(p_note,'')),''),'Penalidad aplicada al cancelar una habitación del grupo.'),'cantidad',1,'precio',v_penalty,'total',v_penalty,'created_at',now()));end if;update public.hotel_reservation_guests set checked_out_at=case when v.estado='alojado' then coalesce(checked_out_at,now()) else checked_out_at end,checked_out_by=case when v.estado='alojado' then coalesce(checked_out_by,auth.uid()) else checked_out_by end,stay_to=least(coalesce(stay_to,v_end),v_effective),updated_at=now() where reservation_id=v.id and property_id=v.property_id and room_id=p_room_id and checked_out_at is null;select count(*) into v_active from public.hotel_reservation_guests x where x.reservation_id=v.id and x.checked_out_at is null;update public.reservas set habitaciones_ids=v_other,habitacion_id=case when habitacion_id=p_room_id then v_other[1] else habitacion_id end,habitaciones_detalle=v_details,room_checkout_dates=case when v.estado='alojado' then v.room_checkout_dates else coalesce(v.room_checkout_dates,'{}'::jsonb)-p_room_id::text end,fecha_entrada=coalesce(v_new_start,fecha_entrada),fecha_salida=coalesce(v_new_end,fecha_salida),cantidad_huespedes=v_active,tarifa_noche=v_total_rate,subtotal=v_subtotal,descuento_importe=v_discount,precio_sin_impuestos_nacionales=v_net,iva_importe=v_vat,precio_total=v_total,precio_total_usd=case when coalesce(tipo_cambio,0)>0 then round(v_total/tipo_cambio,2) else precio_total_usd end,servicios=v_services where id=v.id returning * into out_res;if v.estado='alojado' then update public.habitaciones set estado='sucia' where id=p_room_id and property_id=v.property_id and lower(coalesce(estado,'')) not in('mantenimiento','fuera_servicio');end if;perform private.hl_sync_reservation_folios_internal(out_res.id);insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'group_room_cancelled','Habitación cancelada dentro del grupo','Hab. '||coalesce(h.nombre,p_room_id::text)||' · desde '||v_effective::text||case when p_recalculate then ' · se recalcularon las noches no utilizadas' else ' · se mantuvo el importe contratado' end||case when v_penalty>0 then ' · penalidad '||v_penalty::text||' '||coalesce(v.moneda,'ARS') else '' end,jsonb_build_object('room_id',p_room_id,'effective_date',v_effective,'cancelled_nights',v_cancel_nights,'recalculate',p_recalculate,'penalty_amount',v_penalty,'note',p_note),auth.uid());return out_res;
end $$;

create or replace function public.hl_create_reservation_folio(p_reservation_id bigint,p_label text,p_payer_type text default 'guest',p_payer_name text default null)
returns public.hotel_folios
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare r public.reservas%rowtype;f public.hotel_folios%rowtype;t text;
begin select * into r from public.reservas where id=p_reservation_id;if not found or not private.user_has_property_role(r.property_id,array['owner','manager','reception','admin','night_audit']) then raise exception 'No autorizado';end if;t:=case when p_payer_type='company' then 'company' when p_payer_type='agency' then 'agency' else 'custom' end;insert into public.hotel_folios(property_id,reservation_id,folio_type,label,payer_type,payer_name,currency,status,is_primary,sort_order,created_by) values(r.property_id,r.id,t,coalesce(nullif(trim(p_label),''),'Nuevo folio'),case when p_payer_type in('guest','company','agency','group','other') then p_payer_type else 'other' end,nullif(trim(p_payer_name),''),r.moneda,'open',false,100,auth.uid()) returning * into f;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(r.property_id,r.id,'folio_created','Folio creado',f.label||case when f.payer_name is not null then ' · Pagador: '||f.payer_name else '' end,jsonb_build_object('folio_id',f.id,'payer_type',f.payer_type,'payer_name',f.payer_name),auth.uid());return f;end $$;

create or replace function public.hl_move_folio_item(p_item_id uuid,p_target_folio_id uuid)
returns public.hotel_folio_items
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare i public.hotel_folio_items%rowtype;f public.hotel_folios%rowtype;oldf public.hotel_folios%rowtype;
begin select * into i from public.hotel_folio_items where id=p_item_id;select * into f from public.hotel_folios where id=p_target_folio_id;select * into oldf from public.hotel_folios where id=i.folio_id;if i.id is null or f.id is null or i.property_id<>f.property_id or i.reservation_id<>f.reservation_id then raise exception 'Folio de destino inválido';end if;if not private.user_has_property_role(i.property_id,array['owner','manager','reception','admin','night_audit']) then raise exception 'No autorizado';end if;if i.invoice_document_id is not null then raise exception 'No se puede mover un consumo ya facturado';end if;update public.hotel_folio_items set folio_id=f.id,room_id=coalesce(f.room_id,room_id),updated_at=now() where id=i.id returning * into i;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(i.property_id,i.reservation_id,'folio_item_moved','Consumo redistribuido',coalesce(i.description,'Consumo')||' · '||coalesce(oldf.label,'Folio anterior')||' → '||f.label,jsonb_build_object('item_id',i.id,'from_folio_id',oldf.id,'to_folio_id',f.id,'amount',i.total,'currency',i.currency),auth.uid());return i;end $$;

create or replace function private.hl_log_folio_payer_change()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp' as $$begin if new.payer_type is not distinct from old.payer_type and new.payer_name is not distinct from old.payer_name then return new;end if;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(new.property_id,new.reservation_id,'folio_payer_changed','Pagador de folio modificado',new.label||' · '||coalesce(old.payer_name,old.payer_type)||' → '||coalesce(new.payer_name,new.payer_type),jsonb_build_object('folio_id',new.id,'before_type',old.payer_type,'after_type',new.payer_type,'before_name',old.payer_name,'after_name',new.payer_name),auth.uid());return new;end $$;
drop trigger if exists trg_hl_folio_payer_history on public.hotel_folios;
create trigger trg_hl_folio_payer_history after update of payer_type,payer_name on public.hotel_folios for each row execute function private.hl_log_folio_payer_change();

create or replace function private.hl_log_finance_document_history()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp' as $$declare v_title text;v_detail text;begin if new.reservation_id is null then return new;end if;if tg_op='INSERT' then v_title:=case new.document_type when 'invoice' then 'Factura preparada' when 'credit_note' then 'Nota de crédito preparada' when 'debit_note' then 'Nota de débito preparada' when 'receipt' then 'Recibo preparado' else 'Documento financiero preparado' end;v_detail:=coalesce(new.number,'Sin número')||' · '||upper(coalesce(new.currency,'ARS'))||' '||round(coalesce(new.total,0),2)::text||' · '||coalesce(new.status,'draft');elsif new.status is distinct from old.status then v_title:='Estado de documento actualizado';v_detail:=coalesce(new.number,new.document_type)||' · '||coalesce(old.status,'—')||' → '||coalesce(new.status,'—');else return new;end if;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(new.property_id,new.reservation_id,'finance_document',v_title,v_detail,jsonb_build_object('document_id',new.id,'document_type',new.document_type,'status',new.status,'total',new.total,'currency',new.currency,'folio_id',new.folio_id),coalesce(new.created_by,auth.uid()));return new;end $$;
drop trigger if exists trg_hl_finance_document_history on public.hotel_finance_documents;
create trigger trg_hl_finance_document_history after insert or update of status on public.hotel_finance_documents for each row execute function private.hl_log_finance_document_history();

create or replace function private.hl_log_payment_allocation_history()
returns trigger language plpgsql security definer set search_path='public','private','pg_temp' as $$declare x public.hotel_folio_payment_allocations%rowtype;v_label text;v_action text;begin x:=case when tg_op='DELETE' then old else new end;select label into v_label from public.hotel_folios where id=x.folio_id;v_action:=case when tg_op='DELETE' then 'Asignación de pago retirada' when tg_op='UPDATE' then 'Asignación de pago modificada' else 'Pago asignado a folio' end;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(x.property_id,x.reservation_id,'payment_allocation',v_action,coalesce(v_label,'Folio')||' · '||upper(coalesce(x.currency,'ARS'))||' '||round(coalesce(x.amount,0),2)::text,jsonb_build_object('allocation_id',x.id,'payment_id',x.payment_id,'folio_id',x.folio_id,'amount',x.amount,'currency',x.currency,'source',x.source,'operation',tg_op),coalesce(x.created_by,auth.uid()));return coalesce(new,old);end $$;
drop trigger if exists trg_hl_payment_allocation_history on public.hotel_folio_payment_allocations;
create trigger trg_hl_payment_allocation_history after insert or update of folio_id,amount or delete on public.hotel_folio_payment_allocations for each row execute function private.hl_log_payment_allocation_history();

create or replace function public.hl_run_auto_no_show()
returns integer
language plpgsql
security definer
set search_path='public','private','pg_temp'
as $$
declare s record;r public.reservas%rowtype;v_timezone text;v_local timestamp;v_target time;v_count integer:=0;
begin
 for s in select ps.property_id,ps.settings from public.property_settings ps where coalesce((ps.settings->'preferences'->>'auto_no_show_enabled')::boolean,false)=true loop
  v_timezone:=coalesce(nullif(s.settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires');begin v_local:=now() at time zone v_timezone;exception when others then v_local:=now() at time zone 'America/Argentina/Buenos_Aires';end;begin v_target:=coalesce(nullif(s.settings->'preferences'->>'auto_no_show_time',''),'02:05')::time;exception when others then v_target:='02:05'::time;end;if v_local<v_local::date+v_target then continue;end if;
  for r in select * from public.reservas x where x.property_id=s.property_id and x.fecha_entrada=v_local::date-1 and x.estado not in('cancelada','finalizada','alojado') and coalesce(x.no_show,false)=false loop insert into public.hotel_no_show_history(property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,original_noches,original_tarifa_noche,original_precio_total,currency,release_date,penalty_amount,penalty_status,had_guarantee,guarantee_id,note,snapshot,created_by) values(r.property_id,r.id,'marked',r.fecha_entrada,r.fecha_salida,coalesce(r.noches,greatest(1,r.fecha_salida-r.fecha_entrada)),r.tarifa_noche,r.precio_total,coalesce(r.moneda,'ARS'),r.fecha_entrada,0,'none',false,null,'No Show automático según configuración de la propiedad.',jsonb_build_object('automatic',true,'scheduled_time',v_target,'numero_reserva',r.numero_reserva,'nombre_huesped',r.nombre_huesped,'canal_reserva',r.canal_reserva),null);update public.reservas set no_show=true,no_show_at=now(),no_show_release_date=r.fecha_entrada,no_show_penalty_amount=0,no_show_penalty_status='none',no_show_note='No Show automático según configuración de la propiedad.' where id=r.id;insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload) values(r.property_id,r.id,'no_show','No Show automático','La llegada pendiente superó el horario configurado y la disponibilidad fue liberada.',jsonb_build_object('automatic',true,'scheduled_time',v_target,'release_date',r.fecha_entrada));v_count:=v_count+1;end loop;
 end loop;return v_count;
end $$;

do $$ begin if not exists(select 1 from cron.job where jobname='hl-auto-no-show') then perform cron.schedule('hl-auto-no-show','*/15 * * * *','select public.hl_run_auto_no_show();');end if;end $$;

update public.hotel_reservation_guests set updated_at=updated_at where guest_profile_id is null;

revoke all on function public.hl_merge_guest_profiles_atomic(uuid,uuid) from public,anon;
revoke all on function public.hl_update_reservation_guest_stay_atomic(uuid,bigint,date,date) from public,anon;
revoke all on function public.hl_cancel_group_room_atomic(bigint,bigint,date,numeric,boolean,text) from public,anon;
revoke all on function public.hl_run_auto_no_show() from public,anon,authenticated;
grant execute on function public.hl_merge_guest_profiles_atomic(uuid,uuid) to authenticated;
grant execute on function public.hl_update_reservation_guest_stay_atomic(uuid,bigint,date,date) to authenticated;
grant execute on function public.hl_cancel_group_room_atomic(bigint,bigint,date,numeric,boolean,text) to authenticated;
