create table if not exists public.hotel_night_audit_closures (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  business_date date not null,
  cutoff_time time not null default '05:00',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  status text not null default 'closed' check (status='closed'),
  closed_by uuid not null references auth.users(id),
  closed_at timestamptz not null default now(),
  note text,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(property_id,business_date)
);

create index if not exists hotel_night_audit_closures_property_date_idx
  on public.hotel_night_audit_closures(property_id,business_date desc);

alter table public.hotel_night_audit_closures enable row level security;

drop policy if exists "night audit read by property role" on public.hotel_night_audit_closures;
create policy "night audit read by property role"
on public.hotel_night_audit_closures
for select
to authenticated
using (
  private.user_has_property_role(
    property_id,
    array['owner','admin','manager','reception','night_audit']::text[]
  )
);

revoke insert,update,delete on public.hotel_night_audit_closures from authenticated;
grant select on public.hotel_night_audit_closures to authenticated;

create or replace function public.hl_business_date(
  p_property_id uuid,
  p_at timestamptz default now()
)
returns date
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_settings jsonb := '{}'::jsonb;
  v_timezone text := 'America/Argentina/Buenos_Aires';
  v_cutoff time := '05:00';
  v_local timestamp;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Tenés que iniciar sesión.';
  end if;

  if not private.user_has_property_role(
    p_property_id,
    array['owner','admin','manager','reception','night_audit']::text[]
  ) then
    raise exception using errcode='42501', message='No tenés acceso a esta propiedad.';
  end if;

  select coalesce(ps.settings,'{}'::jsonb)
  into v_settings
  from public.property_settings ps
  where ps.property_id=p_property_id;

  v_timezone := coalesce(nullif(v_settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires');
  begin
    v_cutoff := coalesce(nullif(v_settings->'preferences'->>'business_day_cutoff','')::time,'05:00'::time);
  exception when others then
    v_cutoff := '05:00'::time;
  end;

  begin
    v_local := p_at at time zone v_timezone;
  exception when others then
    v_timezone := 'America/Argentina/Buenos_Aires';
    v_local := p_at at time zone v_timezone;
  end;

  return case
    when v_local::time < v_cutoff then (v_local::date-1)
    else v_local::date
  end;
end;
$function$;

revoke all on function public.hl_business_date(uuid,timestamptz) from public,anon;
grant execute on function public.hl_business_date(uuid,timestamptz) to authenticated;

create or replace function public.hl_night_audit_status(
  p_property_id uuid,
  p_business_date date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_date date;
  v_settings jsonb := '{}'::jsonb;
  v_timezone text := 'America/Argentina/Buenos_Aires';
  v_cutoff text := '05:00';
  v_pending_arrivals jsonb := '[]'::jsonb;
  v_pending_departures jsonb := '[]'::jsonb;
  v_debt_warnings jsonb := '[]'::jsonb;
  v_open_cash jsonb := '[]'::jsonb;
  v_arrivals_count integer := 0;
  v_departures_count integer := 0;
  v_cash_count integer := 0;
  v_debt_count integer := 0;
  v_closed public.hotel_night_audit_closures%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Tenés que iniciar sesión.';
  end if;

  if not private.user_has_property_role(
    p_property_id,
    array['owner','admin','manager','reception','night_audit']::text[]
  ) then
    raise exception using errcode='42501', message='No tenés permisos para ejecutar el cierre diario.';
  end if;

  v_date := coalesce(p_business_date,public.hl_business_date(p_property_id,now()));

  select coalesce(ps.settings,'{}'::jsonb)
  into v_settings
  from public.property_settings ps
  where ps.property_id=p_property_id;
  v_timezone := coalesce(nullif(v_settings->'preferences'->>'timezone',''),'America/Argentina/Buenos_Aires');
  v_cutoff := coalesce(nullif(v_settings->'preferences'->>'business_day_cutoff',''),'05:00');

  select c.* into v_closed
  from public.hotel_night_audit_closures c
  where c.property_id=p_property_id and c.business_date=v_date;

  select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'id',r.id,
      'code',coalesce(r.numero_reserva,r.id::text),
      'guest',r.nombre_huesped,
      'state',coalesce(r.estado,'pendiente'),
      'arrival_date',r.fecha_entrada,
      'operational_date',coalesce(r.fecha_operativa,r.fecha_entrada)
    ) order by r.id),'[]'::jsonb)
  into v_arrivals_count,v_pending_arrivals
  from public.reservas r
  where r.property_id=p_property_id
    and coalesce(r.fecha_operativa,r.fecha_entrada)=v_date
    and coalesce(r.no_show,false)=false
    and lower(coalesce(r.estado,'pendiente')) not in ('alojado','finalizada','cancelada','cancelled','anulada','anulado')
    and r.merged_into_id is null;

  select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'id',r.id,
      'code',coalesce(r.numero_reserva,r.id::text),
      'guest',r.nombre_huesped,
      'state',coalesce(r.estado,'alojado'),
      'departure_date',r.fecha_salida
    ) order by r.fecha_salida,r.id),'[]'::jsonb)
  into v_departures_count,v_pending_departures
  from public.reservas r
  where r.property_id=p_property_id
    and r.fecha_salida<=v_date
    and coalesce(r.no_show,false)=false
    and lower(coalesce(r.estado,''))='alojado'
    and r.merged_into_id is null;

  select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'id',s.id,
      'opened_at',s.opened_at,
      'opened_by',s.opened_by
    ) order by s.opened_at),'[]'::jsonb)
  into v_cash_count,v_open_cash
  from public.hotel_cash_sessions s
  where s.property_id=p_property_id and lower(s.status)='open';

  with payment_totals as (
    select p.reserva_id,
      sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))) as paid
    from public.pagos p
    where p.property_id=p_property_id
      and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled')
    group by p.reserva_id
  ), debt as (
    select r.id,r.numero_reserva,r.nombre_huesped,r.moneda,r.fecha_salida,
      greatest(0,coalesce(r.precio_total,0)-coalesce(pt.paid,0)) as balance
    from public.reservas r
    left join payment_totals pt on pt.reserva_id=r.id
    where r.property_id=p_property_id
      and r.fecha_salida<=v_date
      and coalesce(r.no_show,false)=false
      and lower(coalesce(r.estado,''))='finalizada'
      and r.merged_into_id is null
      and greatest(0,coalesce(r.precio_total,0)-coalesce(pt.paid,0))>0.009
  )
  select count(*),coalesce(jsonb_agg(jsonb_build_object(
      'id',d.id,
      'code',coalesce(d.numero_reserva,d.id::text),
      'guest',d.nombre_huesped,
      'currency',coalesce(d.moneda,'ARS'),
      'balance',d.balance,
      'departure_date',d.fecha_salida
    ) order by d.fecha_salida,d.id),'[]'::jsonb)
  into v_debt_count,v_debt_warnings
  from debt d;

  return jsonb_build_object(
    'business_date',v_date,
    'timezone',v_timezone,
    'cutoff_time',v_cutoff,
    'already_closed',v_closed.id is not null,
    'closure',case when v_closed.id is null then null else jsonb_build_object(
      'id',v_closed.id,
      'closed_at',v_closed.closed_at,
      'closed_by',v_closed.closed_by,
      'note',v_closed.note,
      'snapshot',v_closed.snapshot
    ) end,
    'ready',(v_arrivals_count+v_departures_count+v_cash_count)=0,
    'blocker_count',v_arrivals_count+v_departures_count+v_cash_count,
    'warning_count',v_debt_count,
    'counts',jsonb_build_object(
      'pending_arrivals',v_arrivals_count,
      'pending_departures',v_departures_count,
      'open_cash_sessions',v_cash_count,
      'closed_with_balance',v_debt_count
    ),
    'blockers',jsonb_build_object(
      'pending_arrivals',v_pending_arrivals,
      'pending_departures',v_pending_departures,
      'open_cash_sessions',v_open_cash
    ),
    'warnings',jsonb_build_object(
      'closed_with_balance',v_debt_warnings
    )
  );
end;
$function$;

revoke all on function public.hl_night_audit_status(uuid,date) from public,anon;
grant execute on function public.hl_night_audit_status(uuid,date) to authenticated;

create or replace function public.hl_close_business_day(
  p_property_id uuid,
  p_business_date date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_status jsonb;
  v_date date;
  v_existing public.hotel_night_audit_closures%rowtype;
  v_row public.hotel_night_audit_closures%rowtype;
  v_cutoff time := '05:00';
  v_timezone text := 'America/Argentina/Buenos_Aires';
  v_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode='42501', message='Tenés que iniciar sesión.';
  end if;

  if not private.user_has_property_role(
    p_property_id,
    array['owner','admin','manager','reception','night_audit']::text[]
  ) then
    raise exception using errcode='42501', message='No tenés permisos para cerrar el día operativo.';
  end if;

  v_date := coalesce(p_business_date,public.hl_business_date(p_property_id,now()));

  select * into v_existing
  from public.hotel_night_audit_closures
  where property_id=p_property_id and business_date=v_date;
  if found then
    return jsonb_build_object('ok',true,'already_closed',true,'closure',to_jsonb(v_existing));
  end if;

  v_status := public.hl_night_audit_status(p_property_id,v_date);
  if coalesce((v_status->>'blocker_count')::integer,0)>0 then
    raise exception using errcode='P0001', message='El día operativo tiene pendientes obligatorios. Resolvelos antes de cerrar.';
  end if;

  begin
    v_cutoff := coalesce(nullif(v_status->>'cutoff_time','')::time,'05:00'::time);
  exception when others then
    v_cutoff := '05:00'::time;
  end;
  v_timezone := coalesce(nullif(v_status->>'timezone',''),'America/Argentina/Buenos_Aires');
  v_snapshot := jsonb_build_object(
    'business_date',v_date,
    'closed_at',now(),
    'counts',v_status->'counts',
    'warnings',v_status->'warnings',
    'cutoff_time',v_status->'cutoff_time',
    'timezone',v_timezone
  );

  insert into public.hotel_night_audit_closures(
    property_id,business_date,cutoff_time,timezone,closed_by,note,snapshot
  ) values(
    p_property_id,v_date,v_cutoff,v_timezone,auth.uid(),nullif(trim(coalesce(p_note,'')),''),v_snapshot
  )
  returning * into v_row;

  insert into public.hotel_operation_events(
    property_id,item_type,item_id,action,actor_id,note,metadata
  ) values(
    p_property_id,'night_audit',v_row.id,'closed',auth.uid(),v_row.note,
    jsonb_build_object('business_date',v_date,'cutoff_time',v_status->'cutoff_time','counts',v_status->'counts')
  );

  return jsonb_build_object('ok',true,'already_closed',false,'closure',to_jsonb(v_row));
end;
$function$;

revoke all on function public.hl_close_business_day(uuid,date,text) from public,anon;
grant execute on function public.hl_close_business_day(uuid,date,text) to authenticated;
