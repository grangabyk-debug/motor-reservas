alter table public.reservas add column if not exists cancelled_at timestamptz;
alter table public.reservas add column if not exists cancellation_penalty_amount numeric(14,2) not null default 0 check (cancellation_penalty_amount>=0);
alter table public.reservas add column if not exists cancellation_penalty_status text not null default 'none' check (cancellation_penalty_status in ('none','charged','waived'));
alter table public.reservas add column if not exists cancellation_note text;

create or replace function public.hl_cancel_reservation_policy_atomic(p_reserva_id bigint,p_penalty_status text default 'none',p_note text default null)
returns public.reservas
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
  v public.reservas%rowtype; v_policy jsonb; v_rule jsonb:='{}'::jsonb; v_days integer:=0; v_type text:='none'; v_value numeric:=0; v_penalty numeric:=0; v_paid numeric:=0; v_status text:=lower(coalesce(p_penalty_status,'none'));
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Tenés que iniciar sesión.'; end if;
  select * into v from public.reservas where id=p_reserva_id for update;
  if not found then raise exception using errcode='P0002',message='Reserva inexistente.'; end if;
  if not private.user_has_property_role(v.property_id,array['owner','admin','manager','reception']::text[]) then raise exception using errcode='42501',message='No tenés permisos para cancelar reservas.'; end if;
  if v.estado='cancelada' then return v; end if;
  if v.estado in ('alojado','finalizada') or coalesce(v.no_show,false) then raise exception using errcode='P0001',message='Este estado no admite cancelación. Para un huésped alojado usá check-out; si no se presentó usá No Show.'; end if;
  if current_date>=v.fecha_entrada then raise exception using errcode='P0001',message='La fecha de llegada ya comenzó. Si el huésped no se presentó, registralo como No Show.'; end if;
  v_policy:=coalesce(v.cancellation_policy_snapshot,'{}'::jsonb); v_days:=greatest(0,v.fecha_entrada-current_date);
  select x into v_rule from jsonb_array_elements(coalesce(v_policy->'cancellation_rules','[]'::jsonb)) x where v_days>=coalesce(nullif(x->>'min_days_before','')::integer,0) order by coalesce(nullif(x->>'min_days_before','')::integer,0) desc limit 1;
  v_rule:=coalesce(v_rule,'{"charge_type":"none","value":0}'::jsonb); v_type:=coalesce(v_rule->>'charge_type','none'); v_value:=greatest(0,coalesce(nullif(v_rule->>'value','')::numeric,0));
  v_penalty:=round(case v_type when 'fixed' then v_value when 'percent' then coalesce(v.precio_total,0)*v_value/100 when 'nights' then coalesce(v.tarifa_noche,0)*v_value else 0 end,2);
  if v_status not in ('none','charged','waived') then raise exception using errcode='22023',message='Estado de penalidad inválido.'; end if;
  if v_penalty<=0.01 then v_status:='none'; elsif v_status='none' then raise exception using errcode='P0001',message='La política de cancelación prevé una penalidad de '||v_penalty::text||' '||coalesce(v.moneda,'ARS')||'. Indicá si fue cobrada o eximida.'; end if;
  if v_penalty>0.01 and v_status='charged' then
    select coalesce(sum(greatest(0,coalesce(p.monto,0)-coalesce(p.refunded_amount,0))),0) into v_paid from public.pagos p where p.property_id=v.property_id and p.reserva_id=v.id and lower(coalesce(p.estado,'')) not in ('void','anulado','anulada','cancelado','cancelada','cancelled','rejected','rechazado','rechazada');
    if v_paid+0.01<v_penalty then raise exception using errcode='P0001',message='Primero registrá el cobro de la penalidad antes de cancelar la reserva.'; end if;
  end if;
  update public.reservas set estado='cancelada',cancelled_at=now(),cancellation_penalty_amount=v_penalty,cancellation_penalty_status=v_status,cancellation_note=nullif(trim(coalesce(p_note,'')),'') where id=v.id returning * into v;
  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id) values(v.property_id,v.id,'cancellation','Reserva cancelada',case when v_penalty>0 then 'Cancelación procesada con penalidad según la política asignada.' else 'Cancelación procesada sin cargo según la política asignada.' end,jsonb_build_object('cancellation_policy',v_policy,'days_before',v_days,'rule',v_rule,'penalty_amount',v_penalty,'penalty_status',v_status,'note',p_note),auth.uid());
  return v;
end;$function$;
revoke all on function public.hl_cancel_reservation_policy_atomic(bigint,text,text) from public;
revoke all on function public.hl_cancel_reservation_policy_atomic(bigint,text,text) from anon;
grant execute on function public.hl_cancel_reservation_policy_atomic(bigint,text,text) to authenticated;
