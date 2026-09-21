create or replace function public.hl_charge_to_partner_account_atomic(
  p_reservation_id bigint,
  p_partner_id uuid,
  p_charge_allocations jsonb,
  p_due_at date default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
  v_reservation public.reservas%rowtype;
  v_partner public.hotel_partners%rowtype;
  v_folio public.hotel_folios%rowtype;
  v_payment public.pagos%rowtype;
  v_document_id uuid;
  v_total numeric := 0;
  v_due date;
  v_days integer := 30;
  v_item_ids uuid[] := '{}'::uuid[];
  v_entry jsonb;
  v_item public.hotel_folio_items%rowtype;
  v_amount numeric;
  v_prior_paid numeric;
  v_items jsonb := '[]'::jsonb;
  v_payer_type text;
  v_number text;
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Sesión requerida'; end if;
  if jsonb_typeof(coalesce(p_charge_allocations,'[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_charge_allocations,'[]'::jsonb)) = 0 then
    raise exception 'Seleccioná al menos un cargo para pasar a cuenta corriente';
  end if;

  select * into v_reservation from public.reservas where id=p_reservation_id for update;
  if v_reservation.id is null then raise exception 'Reserva inexistente'; end if;
  if not private.user_has_property_role(v_reservation.property_id,array['owner','manager','reception','admin','night_audit']) then
    raise exception 'No autorizado';
  end if;

  select * into v_partner
  from public.hotel_partners
  where id=coalesce(p_partner_id,v_reservation.partner_id)
    and property_id=v_reservation.property_id
    and active=true
  for update;

  if v_partner.id is null then raise exception 'Elegí una empresa o agencia activa para usar cuenta corriente'; end if;

  update public.reservas set partner_id=v_partner.id
  where id=v_reservation.id and partner_id is distinct from v_partner.id;

  for v_entry in select value from jsonb_array_elements(p_charge_allocations)
  loop
    begin
      select * into v_item
      from public.hotel_folio_items
      where id=(v_entry->>'folio_item_id')::uuid
        and reservation_id=v_reservation.id
        and property_id=v_reservation.property_id
        and status='active'
      for update;
    exception when others then
      raise exception 'Uno de los cargos seleccionados no es válido';
    end;

    if v_item.id is null then raise exception 'Uno de los cargos seleccionados no pertenece a esta reserva'; end if;
    v_amount:=greatest(0,coalesce((v_entry->>'amount')::numeric,0));
    if v_amount<=.009 then raise exception 'Cada cargo debe tener un importe pendiente mayor a cero'; end if;

    select coalesce(sum(a.amount),0) into v_prior_paid
    from public.hotel_folio_item_payment_allocations a
    join public.pagos p on p.id=a.payment_id
    where a.folio_item_id=v_item.id
      and lower(coalesce(p.estado,'')) not in ('anulado','cancelado','void','rechazado','cancelled');

    if v_prior_paid+v_amount > greatest(0,v_item.total)+.011 then
      raise exception 'La cuenta corriente supera el saldo pendiente de %',coalesce(v_item.description,'un cargo');
    end if;

    v_total:=v_total+v_amount;
    v_item_ids:=array_append(v_item_ids,v_item.id);
    v_items:=v_items||jsonb_build_array(jsonb_build_object(
      'folio_item_id',v_item.id,'description',v_item.description,'amount',round(v_amount,2),
      'currency',coalesce(v_item.currency,v_reservation.moneda,'ARS')
    ));
  end loop;

  if v_total<=.009 then raise exception 'El importe a cuenta corriente debe ser mayor a cero'; end if;

  perform public.hl_ensure_reservation_folios(v_reservation.id);
  v_payer_type:=case when v_partner.kind in('agency','wholesaler') then 'agency' else 'company' end;

  select * into v_folio
  from public.hotel_folios
  where reservation_id=v_reservation.id
    and property_id=v_reservation.property_id
    and status<>'void'
    and payer_type=v_payer_type
    and lower(trim(coalesce(payer_name,'')))=lower(trim(v_partner.name))
  order by created_at limit 1;

  if v_folio.id is null then
    select * into v_folio
    from public.hl_create_reservation_folio(
      v_reservation.id,
      (case when v_payer_type='agency' then 'Agencia' else 'Empresa' end)||' · '||v_partner.name,
      v_payer_type,
      v_partner.name
    );
  end if;

  if coalesce(v_partner.billing_terms,'') ~ '[0-9]+' then
    v_days:=greatest(0,(regexp_match(v_partner.billing_terms,'([0-9]+)'))[1]::integer);
  end if;
  v_due:=coalesce(p_due_at,current_date+v_days);
  v_number:='CC-'||coalesce(nullif(v_reservation.numero_reserva,''),v_reservation.id::text)||'-'||to_char(clock_timestamp(),'YYMMDDHH24MISS');

  insert into public.pagos(
    property_id,user_id,reserva_id,monto,metodo,moneda,estado,source,provider,
    referencia,refunded_amount,created_by,folio_id,charge_allocations,
    payment_currency,payment_amount,fx_rate,fx_source,fx_as_of,nota
  )
  values(
    v_reservation.property_id,v_user,v_reservation.id,round(v_total,2),'Cuenta corriente',
    coalesce(v_reservation.moneda,'ARS'),'confirmado','accounts_receivable',null,
    v_number,0,v_user,v_folio.id,p_charge_allocations,
    coalesce(v_reservation.moneda,'ARS'),round(v_total,2),1,'Cuenta corriente',null,
    trim(both ' · ' from concat_ws(' · ','Transferido a cuenta corriente de '||v_partner.name,nullif(trim(coalesce(p_note,'')),'') ))
  )
  returning * into v_payment;

  insert into public.hotel_finance_documents(
    property_id,reservation_id,folio_id,partner_id,document_type,number,status,currency,
    subtotal,tax,total,balance,billing_to,items,issued_at,due_at,notes,created_by,
    payment_id,folio_item_ids,billing_mode
  )
  values(
    v_reservation.property_id,v_reservation.id,v_folio.id,v_partner.id,'folio',v_number,'issued',
    coalesce(v_reservation.moneda,'ARS'),round(v_total,2),0,round(v_total,2),round(v_total,2),
    jsonb_build_object('name',v_partner.name,'tax_id',v_partner.tax_id,'email',v_partner.email,'phone',v_partner.phone,'contact_name',v_partner.contact_name),
    v_items,now(),v_due,nullif(trim(coalesce(p_note,'')),''),v_user,
    v_payment.id,v_item_ids,'account_receivable'
  )
  returning id into v_document_id;

  insert into public.hotel_reservation_events(property_id,reservation_id,event_type,title,detail,payload,actor_user_id)
  values(
    v_reservation.property_id,v_reservation.id,'account_receivable','Cargo pasado a cuenta corriente',
    v_partner.name||' · '||round(v_total,2)||' '||coalesce(v_reservation.moneda,'ARS')||' · vence '||v_due,
    jsonb_build_object('partner_id',v_partner.id,'partner_name',v_partner.name,'payment_id',v_payment.id,'document_id',v_document_id,'amount',round(v_total,2),'currency',coalesce(v_reservation.moneda,'ARS'),'due_at',v_due,'folio_item_ids',to_jsonb(v_item_ids)),
    v_user
  );

  return jsonb_build_object(
    'reservation_id',v_reservation.id,'partner_id',v_partner.id,'partner_name',v_partner.name,
    'payment_id',v_payment.id,'document_id',v_document_id,'amount',round(v_total,2),
    'currency',coalesce(v_reservation.moneda,'ARS'),'due_at',v_due,'folio_id',v_folio.id
  );
end;
$function$;

revoke all on function public.hl_charge_to_partner_account_atomic(bigint,uuid,jsonb,date,text) from public,anon;
grant execute on function public.hl_charge_to_partner_account_atomic(bigint,uuid,jsonb,date,text) to authenticated,service_role;
