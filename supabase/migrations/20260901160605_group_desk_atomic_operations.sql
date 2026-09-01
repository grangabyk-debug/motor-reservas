create or replace function public.hl_group_create_quote_atomic(
  p_property_id uuid,
  p_group_id uuid,
  p_version integer,
  p_quote_number text,
  p_status text,
  p_currency text,
  p_valid_until date,
  p_deposit_percent numeric,
  p_deposit_due_date date,
  p_terms text,
  p_internal_notes text,
  p_lines jsonb
)
returns public.hotel_group_quotes
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_quote public.hotel_group_quotes%rowtype;
  v_line jsonb;
  v_category text;
  v_description text;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_metadata jsonb;
  v_accommodation numeric := 0;
  v_food numeric := 0;
  v_extras numeric := 0;
  v_taxes numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
begin
  if auth.uid() is null or not private.user_has_property_role(
    p_property_id,
    array['owner','manager','reception','admin','revenue','night_audit']
  ) then
    raise exception 'No tenés permisos para crear presupuestos de grupos.' using errcode = '42501';
  end if;

  if p_version is null or p_version < 1 then
    raise exception 'La versión del presupuesto no es válida.' using errcode = '22023';
  end if;
  if coalesce(trim(p_quote_number),'') = '' then
    raise exception 'El presupuesto necesita un número.' using errcode = '22023';
  end if;
  if p_status not in ('draft','sent','accepted','rejected','expired') then
    raise exception 'Estado de presupuesto no válido.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.hotel_groups
    where id = p_group_id and property_id = p_property_id
  ) then
    raise exception 'El grupo no pertenece a este hotel.' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_lines,'[]'::jsonb)) <> 'array' then
    raise exception 'Las líneas del presupuesto no son válidas.' using errcode = '22023';
  end if;

  for v_line in select value from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb))
  loop
    v_category := coalesce(nullif(v_line->>'category',''),'extra');
    v_description := trim(coalesce(v_line->>'description',''));
    v_quantity := greatest(0,coalesce(nullif(v_line->>'quantity','')::numeric,0));
    v_unit_price := greatest(0,coalesce(nullif(v_line->>'unit_price','')::numeric,0));
    v_line_total := v_quantity * v_unit_price;
    v_metadata := coalesce(v_line->'metadata','{}'::jsonb);

    if v_category not in ('room','food','extra','tax','discount','other') then
      raise exception 'Categoría de línea no válida.' using errcode = '22023';
    end if;
    if v_description = '' then
      continue;
    end if;

    case v_category
      when 'room' then v_accommodation := v_accommodation + v_line_total;
      when 'food' then v_food := v_food + v_line_total;
      when 'tax' then v_taxes := v_taxes + v_line_total;
      when 'discount' then v_discount := v_discount + v_line_total;
      else v_extras := v_extras + v_line_total;
    end case;
  end loop;

  v_total := greatest(0,v_accommodation+v_food+v_extras+v_taxes-v_discount);

  insert into public.hotel_group_quotes(
    property_id,group_id,version,quote_number,status,valid_until,currency,
    accommodation_total,food_total,extras_total,taxes_total,discount_total,total,
    deposit_percent,deposit_due_date,terms,internal_notes,created_by,updated_at
  ) values (
    p_property_id,p_group_id,p_version,p_quote_number,p_status,p_valid_until,coalesce(nullif(p_currency,''),'ARS'),
    v_accommodation,v_food,v_extras,v_taxes,v_discount,v_total,
    greatest(0,least(100,coalesce(p_deposit_percent,0))),p_deposit_due_date,p_terms,p_internal_notes,auth.uid(),now()
  ) returning * into v_quote;

  for v_line in select value from jsonb_array_elements(coalesce(p_lines,'[]'::jsonb))
  loop
    v_category := coalesce(nullif(v_line->>'category',''),'extra');
    v_description := trim(coalesce(v_line->>'description',''));
    if v_description = '' then continue; end if;
    v_quantity := greatest(0,coalesce(nullif(v_line->>'quantity','')::numeric,0));
    v_unit_price := greatest(0,coalesce(nullif(v_line->>'unit_price','')::numeric,0));
    v_line_total := v_quantity * v_unit_price;
    v_metadata := coalesce(v_line->'metadata','{}'::jsonb);

    insert into public.hotel_group_quote_lines(
      property_id,quote_id,category,description,quantity,unit_price,total,sort_order,metadata
    ) values (
      p_property_id,v_quote.id,v_category,v_description,v_quantity,v_unit_price,v_line_total,
      coalesce(nullif(v_line->>'sort_order','')::integer,0),v_metadata
    );
  end loop;

  update public.hotel_groups
  set sales_stage='quoted',status='tentative',budget_total=v_total,
      budget_currency=coalesce(nullif(p_currency,''),'ARS'),updated_at=now()
  where id=p_group_id and property_id=p_property_id;

  return v_quote;
end;
$$;

create or replace function public.hl_group_mark_quote_atomic(
  p_property_id uuid,
  p_quote_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, private, pg_temp
as $$
declare
  v_quote public.hotel_group_quotes%rowtype;
  v_group public.hotel_groups%rowtype;
  v_blocks integer := 0;
begin
  if auth.uid() is null or not private.user_has_property_role(
    p_property_id,
    array['owner','manager','reception','admin','revenue','night_audit']
  ) then
    raise exception 'No tenés permisos para actualizar presupuestos de grupos.' using errcode = '42501';
  end if;
  if p_status not in ('sent','accepted','rejected') then
    raise exception 'Transición de presupuesto no válida.' using errcode = '22023';
  end if;

  select * into v_quote
  from public.hotel_group_quotes
  where id=p_quote_id and property_id=p_property_id
  for update;
  if not found then
    raise exception 'El presupuesto no pertenece a este hotel.' using errcode = '42501';
  end if;

  select * into v_group
  from public.hotel_groups
  where id=v_quote.group_id and property_id=p_property_id
  for update;
  if not found then
    raise exception 'El grupo no pertenece a este hotel.' using errcode = '42501';
  end if;

  update public.hotel_group_quotes
  set status=p_status,
      sent_at=case when p_status='sent' then now() else sent_at end,
      accepted_at=case when p_status='accepted' then now() else accepted_at end,
      updated_at=now()
  where id=p_quote_id and property_id=p_property_id;

  if p_status='accepted' then
    update public.hotel_groups
    set sales_stage='confirmed',status='confirmed',budget_total=v_quote.total,
        budget_currency=v_quote.currency,updated_at=now()
    where id=v_group.id and property_id=p_property_id;

    update public.hotel_group_inventory_blocks
    set status='released',updated_at=now()
    where group_id=v_group.id and property_id=p_property_id and status<>'released';

    if v_group.arrival_date is not null
      and v_group.departure_date is not null
      and v_group.departure_date>v_group.arrival_date then
      insert into public.hotel_group_inventory_blocks(
        property_id,group_id,room_type,quantity,arrival_date,departure_date,status,release_date,notes
      )
      select
        p_property_id,v_group.id,
        coalesce(nullif(l.metadata->>'room_type',''),l.description),
        greatest(1,round(l.quantity)::integer),
        v_group.arrival_date,v_group.departure_date,'firm',v_group.release_date,
        'Creado desde '||coalesce(v_quote.quote_number,'presupuesto aceptado')
      from public.hotel_group_quote_lines l
      where l.property_id=p_property_id and l.quote_id=v_quote.id
        and l.category='room' and l.quantity>0;
      get diagnostics v_blocks = row_count;
    end if;
  end if;

  return jsonb_build_object(
    'quote_id',v_quote.id,
    'group_id',v_group.id,
    'status',p_status,
    'blocks_created',v_blocks
  );
end;
$$;

revoke all on function public.hl_group_create_quote_atomic(uuid,uuid,integer,text,text,text,date,numeric,date,text,text,jsonb) from public, anon;
grant execute on function public.hl_group_create_quote_atomic(uuid,uuid,integer,text,text,text,date,numeric,date,text,text,jsonb) to authenticated;
revoke all on function public.hl_group_mark_quote_atomic(uuid,uuid,text) from public, anon;
grant execute on function public.hl_group_mark_quote_atomic(uuid,uuid,text) to authenticated;
