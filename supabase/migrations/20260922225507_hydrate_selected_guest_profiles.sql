CREATE OR REPLACE FUNCTION public.hl_create_reservation_atomic(p_reservation jsonb, p_payments jsonb DEFAULT '[]'::jsonb)
 RETURNS reservas
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v public.reservas%rowtype;
  p jsonb;
  v_property uuid;
  v_user uuid;
  v_discount_type text;
  v_discount_value numeric;
  v_discount_amount numeric;
  v_discount_reason text;
  v_discount_origin text;
  v_vat_rate numeric;
  v_vat_amount numeric;
  v_net_amount numeric;
  v_tax_breakdown boolean;
  v_iva_condition text;
  v_contract_total numeric;
  v_tax_cfg jsonb;
begin
  if p_reservation is null or jsonb_typeof(p_reservation)<>'object' then
    raise exception using errcode='22023',message='Datos de reserva inválidos.';
  end if;
  if p_payments is null then p_payments:='[]'::jsonb; end if;
  if jsonb_typeof(p_payments)<>'array' then
    raise exception using errcode='22023',message='Los pagos iniciales deben ser una lista.';
  end if;

  v_property:=nullif(p_reservation->>'property_id','')::uuid;
  v_user:=nullif(p_reservation->>'user_id','')::uuid;
  if v_property is null then
    raise exception using errcode='23502',message='Falta la propiedad de la reserva.';
  end if;

  select coalesce(settings->'taxes','{}'::jsonb) into v_tax_cfg
  from public.property_settings
  where property_id=v_property;
  v_tax_cfg:=coalesce(v_tax_cfg,'{}'::jsonb);

  v_discount_type:=coalesce(nullif(trim(coalesce(p_reservation->>'descuento_tipo','')),''),'none');
  v_discount_value:=greatest(0,coalesce(nullif(p_reservation->>'descuento_valor','')::numeric,0));
  v_discount_amount:=greatest(0,coalesce(nullif(p_reservation->>'descuento_importe','')::numeric,0));
  v_discount_reason:=nullif(trim(coalesce(p_reservation->>'descuento_motivo','')),'');
  v_discount_origin:=nullif(trim(coalesce(p_reservation->>'descuento_origen','')),'');

  if v_discount_amount>0 then
    if v_discount_type not in ('percent','amount','porcentaje','monto') then
      raise exception using errcode='22023',message='Elegí un tipo de descuento válido.';
    end if;
    if v_discount_reason is null then
      raise exception using errcode='22023',message='Indicá el motivo del descuento.';
    end if;
    if v_discount_origin is null then v_discount_origin:='manual'; end if;
  else
    v_discount_type:='none';
    v_discount_value:=0;
    v_discount_amount:=0;
    v_discount_reason:=null;
    v_discount_origin:=null;
  end if;

  v_tax_breakdown:=coalesce(nullif(v_tax_cfg->>'enabled','')::boolean,true);
  v_vat_rate:=case when v_tax_breakdown then greatest(0,coalesce(
    nullif(v_tax_cfg->>'vat_rate','')::numeric,
    21
  )) else 0 end;
  v_net_amount:=greatest(0,coalesce(
    nullif(p_reservation->>'precio_sin_impuestos_nacionales','')::numeric,
    case when nullif(p_reservation->>'subtotal','') is not null
      then greatest(0,(p_reservation->>'subtotal')::numeric-v_discount_amount)
      else null end,
    case when nullif(p_reservation->>'precio_total','') is not null and v_tax_breakdown and v_vat_rate>0
      then (p_reservation->>'precio_total')::numeric/(1+v_vat_rate/100)
      when nullif(p_reservation->>'precio_total','') is not null
      then (p_reservation->>'precio_total')::numeric
      else null end,
    0
  ));
  v_vat_amount:=case when v_tax_breakdown then round(v_net_amount*v_vat_rate/100,2) else 0 end;
  v_contract_total:=round(v_net_amount+v_vat_amount,2);
  v_iva_condition:=nullif(trim(coalesce(p_reservation->>'condicion_iva_huesped','')),'');
  if v_iva_condition is not null and v_iva_condition not in ('consumidor_final','responsable_inscripto','monotributo','exento','cliente_exterior','no_categorizado') then
    raise exception using errcode='22023',message='Condición de IVA inválida.';
  end if;

  insert into public.reservas(
    property_id,user_id,guest_profile_id,alojamiento_id,habitacion_id,habitaciones_ids,habitaciones_detalle,
    fecha_entrada,fecha_salida,tipo_estadia,nombre_huesped,email_huesped,telefono_huesped,dni_huesped,
    direccion_huesped,provincia_estado_huesped,pais_huesped,cantidad_huespedes,canal_reserva,codigo_canal,
    tarifa_noche,noches,subtotal,descuento_tipo,descuento_valor,descuento_importe,descuento_motivo,descuento_origen,
    precio_sin_impuestos_nacionales,iva_porcentaje,iva_importe,impuestos_desglosados,condicion_iva_huesped,
    precio_total,moneda,notas,partner_id,group_id,garantia_tipo,garantia_marca,garantia_ultimos4,garantia_vencimiento,
    medio_pago_preferido,vehiculos,tipo_vehiculo,dominio_vehiculo,cochera_total,mascotas,mascotas_total,servicios,pasajeros,
    hora_llegada_estimada,hora_salida_estimada,estado,no_show,cancellation_policy_id,cancellation_policy_snapshot
  ) values(
    v_property,v_user,nullif(p_reservation->>'guest_profile_id','')::uuid,nullif(p_reservation->>'alojamiento_id','')::bigint,nullif(p_reservation->>'habitacion_id','')::bigint,
    array(select value::bigint from jsonb_array_elements_text(coalesce(p_reservation->'habitaciones_ids','[]'::jsonb))),
    coalesce(p_reservation->'habitaciones_detalle','[]'::jsonb),nullif(p_reservation->>'fecha_entrada','')::date,
    nullif(p_reservation->>'fecha_salida','')::date,coalesce(nullif(p_reservation->>'tipo_estadia',''),'overnight'),
    coalesce(p_reservation->>'nombre_huesped',''),nullif(p_reservation->>'email_huesped',''),nullif(p_reservation->>'telefono_huesped',''),
    nullif(p_reservation->>'dni_huesped',''),nullif(p_reservation->>'direccion_huesped',''),nullif(p_reservation->>'provincia_estado_huesped',''),
    nullif(p_reservation->>'pais_huesped',''),greatest(1,coalesce(nullif(p_reservation->>'cantidad_huespedes','')::integer,1)),
    coalesce(nullif(p_reservation->>'canal_reserva',''),'Directa'),nullif(p_reservation->>'codigo_canal',''),
    coalesce(nullif(p_reservation->>'tarifa_noche','')::numeric,0),coalesce(nullif(p_reservation->>'noches','')::integer,0),
    coalesce(nullif(p_reservation->>'subtotal','')::numeric,0),v_discount_type,v_discount_value,v_discount_amount,v_discount_reason,v_discount_origin,
    v_net_amount,v_vat_rate,v_vat_amount,v_tax_breakdown,v_iva_condition,
    v_contract_total,coalesce(nullif(p_reservation->>'moneda',''),'ARS'),nullif(p_reservation->>'notas',''),
    nullif(p_reservation->>'partner_id','')::uuid,nullif(p_reservation->>'group_id','')::uuid,nullif(p_reservation->>'garantia_tipo',''),
    nullif(p_reservation->>'garantia_marca',''),nullif(p_reservation->>'garantia_ultimos4',''),nullif(p_reservation->>'garantia_vencimiento',''),
    nullif(p_reservation->>'medio_pago_preferido',''),greatest(0,coalesce(nullif(p_reservation->>'vehiculos','')::integer,0)),
    nullif(p_reservation->>'tipo_vehiculo',''),nullif(p_reservation->>'dominio_vehiculo',''),coalesce(nullif(p_reservation->>'cochera_total','')::numeric,0),
    coalesce(p_reservation->'mascotas','[]'::jsonb),coalesce(nullif(p_reservation->>'mascotas_total','')::numeric,0),
    coalesce(p_reservation->'servicios','[]'::jsonb),coalesce(p_reservation->'pasajeros','[]'::jsonb),
    nullif(p_reservation->>'hora_llegada_estimada',''),nullif(p_reservation->>'hora_salida_estimada',''),
    coalesce(nullif(p_reservation->>'estado',''),'confirmada'),coalesce(nullif(p_reservation->>'no_show','')::boolean,false),
    nullif(p_reservation->>'cancellation_policy_id','')::uuid,coalesce(p_reservation->'cancellation_policy_snapshot','{}'::jsonb)
  ) returning * into v;

  for p in select value from jsonb_array_elements(p_payments) loop
    if coalesce(nullif(p->>'monto','')::numeric,0)<=0 then
      raise exception using errcode='22023',message='Hay un pago inicial con monto inválido.';
    end if;
    if nullif(trim(coalesce(p->>'metodo','')),'') is null then
      raise exception using errcode='22023',message='Hay un pago inicial sin medio de pago.';
    end if;
    insert into public.pagos(property_id,user_id,reserva_id,monto,metodo,moneda,nota)
    values(v.property_id,coalesce(nullif(p->>'user_id','')::uuid,v_user),v.id,(p->>'monto')::numeric,trim(p->>'metodo'),coalesce(nullif(p->>'moneda',''),'ARS'),nullif(p->>'nota',''));
  end loop;
  return v;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hl_sync_guest_profile_from_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  v_key text;
  v_profile public.hotel_guest_profiles%rowtype;
begin
  if new.guest_profile_id is not null then
    new.guest_profile_id:=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id);
    select * into v_profile from public.hotel_guest_profiles p
    where p.id=new.guest_profile_id and p.property_id=new.property_id and p.merged_into_id is null;
    if found then
      new.nombre_huesped:=coalesce(nullif(trim(new.nombre_huesped),''),v_profile.full_name);
      new.email_huesped:=coalesce(nullif(trim(new.email_huesped),''),v_profile.email);
      new.telefono_huesped:=coalesce(nullif(trim(new.telefono_huesped),''),v_profile.phone);
      new.tipo_documento_huesped:=coalesce(nullif(trim(new.tipo_documento_huesped),''),v_profile.document_type);
      new.dni_huesped:=coalesce(nullif(trim(new.dni_huesped),''),v_profile.document_number);
      new.fecha_nacimiento_huesped:=coalesce(new.fecha_nacimiento_huesped,v_profile.birth_date);
      new.nacionalidad_huesped:=coalesce(nullif(trim(new.nacionalidad_huesped),''),v_profile.nationality);
      new.idioma_huesped:=coalesce(nullif(trim(new.idioma_huesped),''),v_profile.language);
      new.direccion_huesped:=coalesce(nullif(trim(new.direccion_huesped),''),v_profile.address);
      new.ciudad_huesped:=coalesce(nullif(trim(new.ciudad_huesped),''),v_profile.city);
      new.provincia_estado_huesped:=coalesce(nullif(trim(new.provincia_estado_huesped),''),v_profile.province);
      new.pais_huesped:=coalesce(nullif(trim(new.pais_huesped),''),v_profile.country);
      new.documento_path:=coalesce(new.documento_path,v_profile.document_front_path);
      update public.hotel_guest_profiles p set
        full_name=coalesce(nullif(trim(new.nombre_huesped),''),p.full_name),
        email=coalesce(nullif(trim(new.email_huesped),''),p.email),
        phone=coalesce(nullif(trim(new.telefono_huesped),''),p.phone),
        document_type=coalesce(nullif(trim(new.tipo_documento_huesped),''),p.document_type),
        document_number=coalesce(nullif(trim(new.dni_huesped),''),p.document_number),
        birth_date=coalesce(new.fecha_nacimiento_huesped,p.birth_date),
        nationality=coalesce(nullif(trim(new.nacionalidad_huesped),''),p.nationality),
        language=coalesce(nullif(trim(new.idioma_huesped),''),p.language),
        address=coalesce(nullif(trim(new.direccion_huesped),''),p.address),
        city=coalesce(nullif(trim(new.ciudad_huesped),''),p.city),
        province=coalesce(nullif(trim(new.provincia_estado_huesped),''),p.province),
        country=coalesce(nullif(trim(new.pais_huesped),''),p.country),
        document_front_path=coalesce(new.documento_path,p.document_front_path),
        last_stay_at=greatest(coalesce(p.last_stay_at,new.fecha_salida),coalesce(new.fecha_salida,p.last_stay_at)),
        updated_at=now()
      where p.id=new.guest_profile_id and p.property_id=new.property_id;
      return new;
    end if;
    new.guest_profile_id:=null;
  end if;

  v_key:=case
    when nullif(lower(trim(new.email_huesped)),'') is not null then 'email:'||lower(trim(new.email_huesped))
    when nullif(trim(new.dni_huesped),'') is not null then 'doc:'||lower(trim(new.dni_huesped))
    when nullif(regexp_replace(coalesce(new.telefono_huesped,''),'\D','','g'),'') is not null then 'phone:'||regexp_replace(new.telefono_huesped,'\D','','g')
    else 'name:'||lower(trim(coalesce(new.nombre_huesped,'sin nombre')))
  end;

  insert into public.hotel_guest_profiles(
    property_id,canonical_key,full_name,email,phone,document_type,document_number,birth_date,nationality,language,
    address,city,province,country,last_stay_at,updated_at
  ) values(
    new.property_id,v_key,coalesce(new.nombre_huesped,''),new.email_huesped,new.telefono_huesped,
    new.tipo_documento_huesped,new.dni_huesped,new.fecha_nacimiento_huesped,new.nacionalidad_huesped,new.idioma_huesped,
    new.direccion_huesped,new.ciudad_huesped,new.provincia_estado_huesped,new.pais_huesped,new.fecha_salida,now()
  )
  on conflict(property_id,canonical_key) do update set
    full_name=excluded.full_name,
    email=coalesce(excluded.email,hotel_guest_profiles.email),
    phone=coalesce(excluded.phone,hotel_guest_profiles.phone),
    document_type=coalesce(excluded.document_type,hotel_guest_profiles.document_type),
    document_number=coalesce(excluded.document_number,hotel_guest_profiles.document_number),
    birth_date=coalesce(excluded.birth_date,hotel_guest_profiles.birth_date),
    nationality=coalesce(excluded.nationality,hotel_guest_profiles.nationality),
    language=coalesce(excluded.language,hotel_guest_profiles.language),
    address=coalesce(excluded.address,hotel_guest_profiles.address),
    city=coalesce(excluded.city,hotel_guest_profiles.city),
    province=coalesce(excluded.province,hotel_guest_profiles.province),
    country=coalesce(excluded.country,hotel_guest_profiles.country),
    last_stay_at=greatest(coalesce(hotel_guest_profiles.last_stay_at,excluded.last_stay_at),excluded.last_stay_at),
    updated_at=now()
  returning * into v_profile;

  new.guest_profile_id:=v_profile.id;
  new.tipo_documento_huesped:=coalesce(nullif(trim(new.tipo_documento_huesped),''),v_profile.document_type);
  new.dni_huesped:=coalesce(nullif(trim(new.dni_huesped),''),v_profile.document_number);
  new.fecha_nacimiento_huesped:=coalesce(new.fecha_nacimiento_huesped,v_profile.birth_date);
  new.nacionalidad_huesped:=coalesce(nullif(trim(new.nacionalidad_huesped),''),v_profile.nationality);
  new.idioma_huesped:=coalesce(nullif(trim(new.idioma_huesped),''),v_profile.language);
  new.direccion_huesped:=coalesce(nullif(trim(new.direccion_huesped),''),v_profile.address);
  new.ciudad_huesped:=coalesce(nullif(trim(new.ciudad_huesped),''),v_profile.city);
  new.provincia_estado_huesped:=coalesce(nullif(trim(new.provincia_estado_huesped),''),v_profile.province);
  new.pais_huesped:=coalesce(nullif(trim(new.pais_huesped),''),v_profile.country);
  new.documento_path:=coalesce(new.documento_path,v_profile.document_front_path);
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION public.hl_create_primary_guest_for_reservation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
declare
  p public.hotel_guest_profiles%rowtype;
begin
  if new.guest_profile_id is not null then
    select * into p from public.hotel_guest_profiles gp
    where gp.id=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id)
      and gp.property_id=new.property_id limit 1;
  end if;
  insert into public.hotel_reservation_guests(
    property_id,reservation_id,room_id,role,guest_profile_id,full_name,email,phone,document_type,document_number,
    birth_date,nationality,address,city,province,country,sex,marital_status,cuil,postal_code,occupation,travel_reason,
    relationship,document_front_path,document_back_path,notes,sort_order,created_by
  ) values(
    new.property_id,new.id,new.habitacion_id,'primary',coalesce(p.id,new.guest_profile_id),
    coalesce(nullif(new.nombre_huesped,''),p.full_name,'Huésped'),
    coalesce(new.email_huesped,p.email),coalesce(new.telefono_huesped,p.phone),
    coalesce(new.tipo_documento_huesped,p.document_type,'DNI'),coalesce(new.dni_huesped,p.document_number),
    coalesce(new.fecha_nacimiento_huesped,p.birth_date),coalesce(new.nacionalidad_huesped,p.nationality),
    coalesce(new.direccion_huesped,p.address),coalesce(new.ciudad_huesped,p.city),
    coalesce(new.provincia_estado_huesped,p.province),coalesce(new.pais_huesped,p.country,'Argentina'),
    p.sex,p.marital_status,p.cuil,p.postal_code,p.occupation,p.travel_reason,
    'Titular',coalesce(new.documento_path,p.document_front_path),p.document_back_path,p.notes,0,new.user_id
  ) on conflict do nothing;
  return new;
end
$function$;

CREATE OR REPLACE FUNCTION private.hl_sync_guest_profile_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
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
    new.guest_profile_id:=private.hl_canonical_guest_profile_id(new.property_id,new.guest_profile_id);
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
    where p.property_id=new.property_id and p.merged_into_id is null
      and (p.canonical_key=v_key
        or (v_email is not null and lower(coalesce(p.email,''))=v_email)
        or (v_doc is not null and lower(coalesce(p.document_number,''))=v_doc)
        or (v_phone is not null and regexp_replace(coalesce(p.phone,''),'\D','','g')=v_phone))
    order by case when p.canonical_key=v_key then 0 else 1 end,p.created_at
    limit 1;
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
        document_front_path=coalesce(excluded.document_front_path,public.hotel_guest_profiles.document_front_path),document_back_path=coalesce(excluded.document_back_path,public.hotel_guest_profiles.document_back_path),last_stay_at=greatest(coalesce(public.hotel_guest_profiles.last_stay_at,excluded.last_stay_at),coalesce(excluded.last_stay_at,public.hotel_guest_profiles.last_stay_at)),updated_at=now()
      returning * into v_profile;
      new.guest_profile_id:=v_profile.id;
    end if;
  end if;

  if new.guest_profile_id is not null then
    if v_profile.id is null then select * into v_profile from public.hotel_guest_profiles p where p.id=new.guest_profile_id and p.property_id=new.property_id; end if;
    new.full_name:=coalesce(nullif(trim(new.full_name),''),v_profile.full_name);
    new.email:=coalesce(nullif(trim(new.email),''),v_profile.email);
    new.phone:=coalesce(nullif(trim(new.phone),''),v_profile.phone);
    new.document_type:=coalesce(nullif(trim(new.document_type),''),v_profile.document_type);
    new.document_number:=coalesce(nullif(trim(new.document_number),''),v_profile.document_number);
    new.birth_date:=coalesce(new.birth_date,v_profile.birth_date);
    new.nationality:=coalesce(nullif(trim(new.nationality),''),v_profile.nationality);
    new.address:=coalesce(nullif(trim(new.address),''),v_profile.address);
    new.city:=coalesce(nullif(trim(new.city),''),v_profile.city);
    new.province:=coalesce(nullif(trim(new.province),''),v_profile.province);
    new.country:=coalesce(nullif(trim(new.country),''),v_profile.country);
    new.sex:=coalesce(nullif(trim(new.sex),''),v_profile.sex);
    new.marital_status:=coalesce(nullif(trim(new.marital_status),''),v_profile.marital_status);
    new.cuil:=coalesce(nullif(trim(new.cuil),''),v_profile.cuil);
    new.postal_code:=coalesce(nullif(trim(new.postal_code),''),v_profile.postal_code);
    new.occupation:=coalesce(nullif(trim(new.occupation),''),v_profile.occupation);
    new.travel_reason:=coalesce(nullif(trim(new.travel_reason),''),v_profile.travel_reason);
    new.document_front_path:=coalesce(new.document_front_path,v_profile.document_front_path);
    new.document_back_path:=coalesce(new.document_back_path,v_profile.document_back_path);

    update public.hotel_guest_profiles p set
      full_name=coalesce(nullif(trim(new.full_name),''),p.full_name),email=coalesce(nullif(trim(new.email),''),p.email),phone=coalesce(nullif(trim(new.phone),''),p.phone),
      document_type=coalesce(nullif(trim(new.document_type),''),p.document_type),document_number=coalesce(nullif(trim(new.document_number),''),p.document_number),birth_date=coalesce(new.birth_date,p.birth_date),
      nationality=coalesce(nullif(trim(new.nationality),''),p.nationality),address=coalesce(nullif(trim(new.address),''),p.address),city=coalesce(nullif(trim(new.city),''),p.city),province=coalesce(nullif(trim(new.province),''),p.province),country=coalesce(nullif(trim(new.country),''),p.country),
      sex=coalesce(nullif(trim(new.sex),''),p.sex),marital_status=coalesce(nullif(trim(new.marital_status),''),p.marital_status),cuil=coalesce(nullif(trim(new.cuil),''),p.cuil),postal_code=coalesce(nullif(trim(new.postal_code),''),p.postal_code),occupation=coalesce(nullif(trim(new.occupation),''),p.occupation),travel_reason=coalesce(nullif(trim(new.travel_reason),''),p.travel_reason),
      document_front_path=coalesce(new.document_front_path,p.document_front_path),document_back_path=coalesce(new.document_back_path,p.document_back_path),last_stay_at=greatest(coalesce(p.last_stay_at,v_last),coalesce(v_last,p.last_stay_at)),updated_at=now()
    where p.id=new.guest_profile_id and p.property_id=new.property_id;
  end if;
  return new;
end
$function$;
