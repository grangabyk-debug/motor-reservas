alter table public.reservas add column if not exists no_show_at timestamptz;
alter table public.reservas add column if not exists no_show_release_date date;
alter table public.reservas add column if not exists no_show_penalty_amount numeric(14,2) not null default 0;
alter table public.reservas add column if not exists no_show_penalty_status text not null default 'none';
alter table public.reservas add column if not exists no_show_note text;

do $$ begin
  if not exists(select 1 from pg_constraint where conname='reservas_no_show_penalty_amount_check' and conrelid='public.reservas'::regclass) then
    alter table public.reservas add constraint reservas_no_show_penalty_amount_check check(no_show_penalty_amount>=0);
  end if;
  if not exists(select 1 from pg_constraint where conname='reservas_no_show_penalty_status_check' and conrelid='public.reservas'::regclass) then
    alter table public.reservas add constraint reservas_no_show_penalty_status_check check(no_show_penalty_status in ('none','charged','waived'));
  end if;
end $$;

create table if not exists public.hotel_no_show_history(
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  reservation_id bigint not null references public.reservas(id) on delete cascade,
  action text not null check(action in ('marked','restored')),
  original_fecha_entrada date not null,
  original_fecha_salida date not null,
  original_noches integer,
  original_tarifa_noche numeric(14,2),
  original_precio_total numeric(14,2),
  currency text not null default 'ARS',
  release_date date,
  penalty_amount numeric(14,2) not null default 0 check(penalty_amount>=0),
  penalty_status text not null default 'none' check(penalty_status in ('none','charged','waived')),
  had_guarantee boolean not null default false,
  guarantee_id uuid references public.hotel_guarantees(id) on delete set null,
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hotel_no_show_history_property_created_idx on public.hotel_no_show_history(property_id,created_at desc);
create index if not exists hotel_no_show_history_reservation_idx on public.hotel_no_show_history(property_id,reservation_id,created_at desc);
alter table public.hotel_no_show_history enable row level security;
revoke all on public.hotel_no_show_history from anon;
grant select,insert on public.hotel_no_show_history to authenticated;
drop policy if exists hotel_no_show_history_select_access on public.hotel_no_show_history;
create policy hotel_no_show_history_select_access on public.hotel_no_show_history for select to authenticated using(private.user_has_property_access(property_id));
drop policy if exists hotel_no_show_history_insert_frontdesk on public.hotel_no_show_history;
create policy hotel_no_show_history_insert_frontdesk on public.hotel_no_show_history for insert to authenticated with check(private.user_has_property_role(property_id,array['owner','admin','manager','reception','night_audit']::text[]));

create or replace function public.hl_mark_no_show_atomic(
  p_reserva_id bigint,
  p_release_date date default null,
  p_penalty_amount numeric default 0,
  p_penalty_status text default 'none',
  p_note text default null
)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
  v_release date;
  v_penalty numeric:=greatest(0,coalesce(p_penalty_amount,0));
  v_status text:=lower(coalesce(p_penalty_status,'none'));
  v_paid numeric:=0;
  v_guarantee public.hotel_guarantees%rowtype;
  v_has_guarantee boolean:=false;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para marcar No Show.'; end if;
  if v.estado in ('cancelada','finalizada') or v.estado='alojado' then raise exception using errcode='P0001',message='La reserva no admite No Show en su estado actual.'; end if;
  if coalesce(v.no_show,false) then return v; end if;

  v_release:=coalesce(p_release_date,current_date);
  if v_release<v.fecha_entrada then raise exception using errcode='P0001',message='No se puede marcar No Show antes de la fecha de llegada.'; end if;
  if v_release>v.fecha_salida then raise exception using errcode='P0001',message='La fecha de liberación no puede ser posterior a la salida original.'; end if;
  if v_status not in ('none','charged','waived') then raise exception using errcode='22023',message='Estado de penalidad inválido.'; end if;
  if v_penalty<=0 then v_status:='none'; end if;

  select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid
  from public.pagos p
  where p.property_id=v.property_id and p.reserva_id=v.id
    and lower(coalesce(p.estado,'')) not in ('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');

  if v_penalty>0 and v_status='charged' and v_paid+0.01<v_penalty then
    raise exception using errcode='P0001',message='Primero registrá el cobro de la penalidad antes de marcar No Show.';
  end if;
  if v_penalty>0 and v_status='none' then
    raise exception using errcode='P0001',message='Indicá si la penalidad fue cobrada o eximida.';
  end if;

  select * into v_guarantee from public.hotel_guarantees g
  where g.property_id=v.property_id and g.reserva_id=v.id
  order by g.updated_at desc limit 1;
  v_has_guarantee:=found or nullif(v.garantia_tipo,'') is not null or nullif(v.garantia_ultimos4,'') is not null;

  insert into public.hotel_no_show_history(
    property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,original_noches,original_tarifa_noche,original_precio_total,currency,release_date,penalty_amount,penalty_status,had_guarantee,guarantee_id,note,snapshot,created_by
  ) values(
    v.property_id,v.id,'marked',v.fecha_entrada,v.fecha_salida,coalesce(v.noches,greatest(1,v.fecha_salida-v.fecha_entrada)),v.tarifa_noche,v.precio_total,coalesce(v.moneda,'ARS'),v_release,v_penalty,v_status,v_has_guarantee,v_guarantee.id,nullif(trim(coalesce(p_note,'')),''),
    jsonb_build_object('numero_reserva',v.numero_reserva,'nombre_huesped',v.nombre_huesped,'habitacion_id',v.habitacion_id,'habitaciones_ids',v.habitaciones_ids,'canal_reserva',v.canal_reserva,'estado',v.estado,'paid_at_mark',v_paid),auth.uid()
  );

  update public.reservas set
    no_show=true,
    no_show_at=now(),
    no_show_release_date=v_release,
    no_show_penalty_amount=v_penalty,
    no_show_penalty_status=v_status,
    no_show_note=nullif(trim(coalesce(p_note,'')),'')
  where id=v.id returning * into v;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(v.property_id,v.id,'no_show','Reserva marcada No Show','El huésped no se presentó. La disponibilidad quedó liberada sin perder la estadía ni la tarifa original.',jsonb_build_object('original_start',v.fecha_entrada,'original_end',v.fecha_salida,'original_total',v.precio_total,'original_rate',v.tarifa_noche,'release_date',v_release,'penalty_amount',v_penalty,'penalty_status',v_status,'had_guarantee',v_has_guarantee),auth.uid());

  return v;
end;
$function$;

create or replace function public.hl_restore_no_show_atomic(p_reserva_id bigint,p_note text default null)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception','night_audit']::text[]) then raise exception using errcode='42501',message='No tenés permisos para reabrir un No Show.'; end if;
  if not coalesce(v.no_show,false) then return v; end if;

  insert into public.hotel_no_show_history(property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,original_noches,original_tarifa_noche,original_precio_total,currency,release_date,penalty_amount,penalty_status,had_guarantee,note,snapshot,created_by)
  values(v.property_id,v.id,'restored',v.fecha_entrada,v.fecha_salida,coalesce(v.noches,greatest(1,v.fecha_salida-v.fecha_entrada)),v.tarifa_noche,v.precio_total,coalesce(v.moneda,'ARS'),v.no_show_release_date,coalesce(v.no_show_penalty_amount,0),coalesce(v.no_show_penalty_status,'none'),false,null,nullif(trim(coalesce(p_note,'')),''),jsonb_build_object('previous_no_show_at',v.no_show_at),auth.uid());

  update public.reservas set no_show=false,no_show_at=null,no_show_release_date=null,no_show_penalty_amount=0,no_show_penalty_status='none',no_show_note=null where id=v.id returning * into v;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(v.property_id,v.id,'no_show_restored','No Show reabierto','La reserva volvió a estado operativo. Revisá disponibilidad antes de asignar o confirmar nuevamente.',jsonb_build_object('restored',true),auth.uid());
  return v;
end;
$function$;

revoke all on function public.hl_mark_no_show_atomic(bigint,date,numeric,text,text) from public;
revoke all on function public.hl_mark_no_show_atomic(bigint,date,numeric,text,text) from anon;
grant execute on function public.hl_mark_no_show_atomic(bigint,date,numeric,text,text) to authenticated;
grant execute on function public.hl_mark_no_show_atomic(bigint,date,numeric,text,text) to service_role;
revoke all on function public.hl_restore_no_show_atomic(bigint,text) from public;
revoke all on function public.hl_restore_no_show_atomic(bigint,text) from anon;
grant execute on function public.hl_restore_no_show_atomic(bigint,text) to authenticated;
grant execute on function public.hl_restore_no_show_atomic(bigint,text) to service_role;

update public.reservas set no_show_at=coalesce(no_show_at,created_at,now()),no_show_release_date=coalesce(no_show_release_date,fecha_entrada),no_show_penalty_amount=coalesce(no_show_penalty_amount,0),no_show_penalty_status=coalesce(no_show_penalty_status,'none') where coalesce(no_show,false)=true;

insert into public.hotel_no_show_history(property_id,reservation_id,action,original_fecha_entrada,original_fecha_salida,original_noches,original_tarifa_noche,original_precio_total,currency,release_date,penalty_amount,penalty_status,had_guarantee,note,snapshot,created_by,created_at)
select r.property_id,r.id,'marked',r.fecha_entrada,r.fecha_salida,coalesce(r.noches,greatest(1,r.fecha_salida-r.fecha_entrada)),r.tarifa_noche,r.precio_total,coalesce(r.moneda,'ARS'),coalesce(r.no_show_release_date,r.fecha_entrada),coalesce(r.no_show_penalty_amount,0),coalesce(r.no_show_penalty_status,'none'),(nullif(r.garantia_tipo,'') is not null or nullif(r.garantia_ultimos4,'') is not null),r.no_show_note,jsonb_build_object('backfilled',true,'numero_reserva',r.numero_reserva,'nombre_huesped',r.nombre_huesped),r.user_id,coalesce(r.no_show_at,r.created_at,now())
from public.reservas r where coalesce(r.no_show,false)=true and not exists(select 1 from public.hotel_no_show_history h where h.reservation_id=r.id and h.property_id=r.property_id and h.action='marked');