begin;

alter table public.reservas
  add column if not exists descuento_scope jsonb not null default '{}'::jsonb;

alter table public.reservas drop constraint if exists reservas_descuento_scope_object_check;
alter table public.reservas add constraint reservas_descuento_scope_object_check
  check (jsonb_typeof(descuento_scope)='object');

create or replace function private.hl_default_discount_scope(
  p_start date,p_end date,p_room_id bigint,p_room_ids bigint[],p_details jsonb
)
returns jsonb
language plpgsql
stable
set search_path to 'public','private','pg_temp'
as $$
declare coverage jsonb:='[]'::jsonb;ids bigint[];rid bigint;d jsonb;d_start date;d_end date;dates jsonb;
begin
  select coalesce(array_agg(distinct x order by x),array[]::bigint[]) into ids
  from unnest(coalesce(p_room_ids,array[]::bigint[])||case when p_room_id is null then array[]::bigint[] else array[p_room_id] end) x
  where x is not null;
  foreach rid in array ids loop
    select e into d from jsonb_array_elements(case when jsonb_typeof(p_details)='array' then p_details else '[]'::jsonb end) e
    where coalesce(e->>'habitacion_id','')~'^[0-9]+$' and (e->>'habitacion_id')::bigint=rid
      and lower(coalesce(e->>'segment_role','active_room')) not in('previous_room','transient_room','cancelled_room','no_show_room')
    order by coalesce(nullif(e->>'fecha_salida','')::date,p_end) desc limit 1;
    d_start:=coalesce(nullif(d->>'fecha_entrada','')::date,p_start);
    d_end:=coalesce(nullif(d->>'fecha_salida','')::date,p_end);
    select coalesce(jsonb_agg(to_char(day,'YYYY-MM-DD') order by day),'[]'::jsonb) into dates
    from generate_series(d_start,d_end-1,interval '1 day') day;
    coverage:=coverage||jsonb_build_array(jsonb_build_object('room_id',rid,'dates',dates));
  end loop;
  return jsonb_build_object('version',1,'mode','snapshot','coverage',coverage,'include_extensions',false,'include_special_stays',false,'captured_at',now());
end;
$$;

create or replace function private.hl_capture_discount_scope()
returns trigger
language plpgsql
set search_path to 'public','private','pg_temp'
as $$
begin
  if coalesce(new.descuento_importe,0)>0 and (new.descuento_scope is null or jsonb_typeof(new.descuento_scope)<>'object' or new.descuento_scope='{}'::jsonb) then
    new.descuento_scope:=private.hl_default_discount_scope(new.fecha_entrada,new.fecha_salida,new.habitacion_id,new.habitaciones_ids,new.habitaciones_detalle);
  elsif coalesce(new.descuento_importe,0)<=0 then
    new.descuento_scope:='{}'::jsonb;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_capture_discount_scope on public.reservas;
create trigger trg_capture_discount_scope
before insert or update of descuento_tipo,descuento_valor,descuento_importe
on public.reservas for each row execute function private.hl_capture_discount_scope();

create or replace function public.hl_set_reservation_discount_scope_atomic(
  p_reserva_id bigint,p_coverage jsonb,p_mode text default 'custom'
)
returns public.reservas
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $$
declare r public.reservas%rowtype;scope jsonb;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into r from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(r.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para configurar el alcance del descuento.'; end if;
  if coalesce(r.descuento_importe,0)<=0 then raise exception using errcode='22023',message='La reserva no tiene un descuento activo.'; end if;
  if jsonb_typeof(p_coverage)<>'array' then raise exception using errcode='22023',message='El alcance del descuento es inválido.'; end if;
  scope:=jsonb_build_object('version',1,'mode',coalesce(nullif(trim(p_mode),''),'custom'),'coverage',p_coverage,'include_extensions',false,'include_special_stays',false,'captured_at',now());
  update public.reservas set descuento_scope=scope where id=r.id returning * into r;
  update public.hotel_folio_items set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('discount_scope',scope),updated_at=now()
  where reservation_id=r.id and source_key='legacy:discount' and invoice_document_id is null;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(r.property_id,r.id,'discount_scope','Alcance del descuento actualizado','Se definieron las noches y habitaciones alcanzadas por el descuento.',jsonb_build_object('discount_scope',scope,'discount_value',r.descuento_valor,'discount_type',r.descuento_tipo),auth.uid());
  return r;
end;
$$;

revoke all on function public.hl_set_reservation_discount_scope_atomic(bigint,jsonb,text) from public,anon;
grant execute on function public.hl_set_reservation_discount_scope_atomic(bigint,jsonb,text) to authenticated;

commit;
