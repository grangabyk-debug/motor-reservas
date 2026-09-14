create or replace function public.hl_api_keys_snapshot(p_property_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_keys jsonb;
  v_logs jsonb;
  v_requests bigint:=0;
  v_errors bigint:=0;
begin
  if auth.uid() is null or not private.user_has_property_role(p_property_id,array['owner','manager','admin']::text[]) then
    raise exception using errcode='42501',message='No tenés permiso para administrar la API de esta propiedad.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(k)-'key_hash' order by k.created_at desc),'[]'::jsonb) into v_keys from public.hotel_api_keys k where k.property_id=p_property_id;
  select coalesce(jsonb_agg(to_jsonb(l) order by l.created_at desc),'[]'::jsonb) into v_logs from (select id,api_key_id,method,path,status_code,duration_ms,created_at from public.hotel_api_request_logs where property_id=p_property_id order by created_at desc limit 50) l;
  select count(*) into v_requests from public.hotel_api_request_logs where property_id=p_property_id and created_at>=now()-interval '24 hours';
  select count(*) into v_errors from public.hotel_api_request_logs where property_id=p_property_id and created_at>=now()-interval '24 hours' and status_code>=400;
  return jsonb_build_object('keys',v_keys,'logs',v_logs,'metrics',jsonb_build_object('requests_24h',v_requests,'errors_24h',v_errors),'available_scopes',jsonb_build_array(jsonb_build_object('id','reservations:read','label','Reservas · lectura','description','Consultar reservas de esta propiedad sin modificar datos.')));
end $$;

create or replace function public.hl_api_key_create(p_property_id uuid,p_name text,p_prefix text,p_hash text,p_scopes text[],p_rate_limit integer,p_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.hotel_api_keys%rowtype;
begin
  if auth.uid() is null or not private.user_has_property_role(p_property_id,array['owner','manager','admin']::text[]) then raise exception using errcode='42501',message='No tenés permiso para administrar la API de esta propiedad.'; end if;
  if nullif(btrim(p_name),'') is null or char_length(btrim(p_name))>80 then raise exception using errcode='22023',message='Nombre de clave inválido.'; end if;
  if p_hash is null or char_length(p_hash)<>64 or p_prefix is null or char_length(p_prefix)<6 then raise exception using errcode='22023',message='Credencial inválida.'; end if;
  if p_scopes is null or cardinality(p_scopes)=0 or exists(select 1 from unnest(p_scopes) s where s not in ('reservations:read')) then raise exception using errcode='22023',message='Scope no permitido.'; end if;
  if coalesce(p_rate_limit,0)<1 or p_rate_limit>600 then raise exception using errcode='22023',message='Rate limit inválido.'; end if;
  insert into public.hotel_api_keys(property_id,name,key_prefix,key_hash,scopes,status,rate_limit_per_min,expires_at,created_by) values(p_property_id,btrim(p_name),p_prefix,p_hash,p_scopes,'active',p_rate_limit,p_expires_at,auth.uid()) returning * into v_row;
  return to_jsonb(v_row)-'key_hash';
end $$;

create or replace function public.hl_api_key_revoke(p_property_id uuid,p_key_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_row public.hotel_api_keys%rowtype;
begin
  if auth.uid() is null or not private.user_has_property_role(p_property_id,array['owner','manager','admin']::text[]) then raise exception using errcode='42501',message='No tenés permiso para administrar la API de esta propiedad.'; end if;
  update public.hotel_api_keys set status='revoked',revoked_at=now() where id=p_key_id and property_id=p_property_id and status='active' returning * into v_row;
  if not found then raise exception using errcode='P0002',message='La clave no existe o ya estaba revocada.'; end if;
  return to_jsonb(v_row)-'key_hash';
end $$;

create or replace function public.hl_api_v1_reservations(p_key_hash text,p_from date,p_to date,p_status text,p_limit integer,p_after_id bigint,p_method text,p_path text,p_ip text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_key public.hotel_api_keys%rowtype;
  v_started timestamptz:=clock_timestamp();
  v_used bigint:=0;
  v_limit integer:=least(100,greatest(1,coalesce(p_limit,50)));
  v_rows jsonb:='[]'::jsonb;
  v_count integer:=0;
  v_next bigint:=null;
  v_duration integer:=0;
begin
  select * into v_key from public.hotel_api_keys where key_hash=p_key_hash limit 1;
  if not found then return jsonb_build_object('ok',false,'status',401,'error','API key inválida o ausente.'); end if;
  if v_key.status<>'active' then insert into public.hotel_api_request_logs(property_id,api_key_id,method,path,status_code,duration_ms,ip) values(v_key.property_id,v_key.id,coalesce(p_method,'GET'),coalesce(p_path,'/api/v1/reservations'),401,0,left(p_ip,120)); return jsonb_build_object('ok',false,'status',401,'error','API key inválida o revocada.'); end if;
  if v_key.expires_at is not null and v_key.expires_at<=now() then insert into public.hotel_api_request_logs(property_id,api_key_id,method,path,status_code,duration_ms,ip) values(v_key.property_id,v_key.id,coalesce(p_method,'GET'),coalesce(p_path,'/api/v1/reservations'),401,0,left(p_ip,120)); return jsonb_build_object('ok',false,'status',401,'error','La API key venció.'); end if;
  if not ('reservations:read'=any(v_key.scopes)) then insert into public.hotel_api_request_logs(property_id,api_key_id,method,path,status_code,duration_ms,ip) values(v_key.property_id,v_key.id,coalesce(p_method,'GET'),coalesce(p_path,'/api/v1/reservations'),403,0,left(p_ip,120)); return jsonb_build_object('ok',false,'status',403,'error','La clave no tiene el permiso reservations:read.'); end if;
  select count(*) into v_used from public.hotel_api_request_logs where api_key_id=v_key.id and created_at>=now()-interval '1 minute';
  if v_used>=v_key.rate_limit_per_min then insert into public.hotel_api_request_logs(property_id,api_key_id,method,path,status_code,duration_ms,ip) values(v_key.property_id,v_key.id,coalesce(p_method,'GET'),coalesce(p_path,'/api/v1/reservations'),429,0,left(p_ip,120)); return jsonb_build_object('ok',false,'status',429,'error','Rate limit excedido. Reintentá en un minuto.','rate_limit',v_key.rate_limit_per_min,'remaining',0); end if;
  select coalesce(jsonb_agg(to_jsonb(r) order by r.id),'[]'::jsonb) into v_rows from (select id,numero_reserva,nombre_huesped,email_huesped,telefono_huesped,fecha_entrada,fecha_salida,estado,no_show,precio_total,moneda,canal_reserva,habitacion_id,habitaciones_ids,cantidad_huespedes,hora_llegada_estimada,hora_salida_estimada,created_at,updated_at from public.reservas where property_id=v_key.property_id and (p_from is null or fecha_entrada>=p_from) and (p_to is null or fecha_entrada<=p_to) and (nullif(btrim(p_status),'') is null or estado=lower(btrim(p_status))) and id>coalesce(p_after_id,0) order by id asc limit v_limit) r;
  v_count:=jsonb_array_length(v_rows); if v_count=v_limit and v_count>0 then v_next:=(v_rows->(v_count-1)->>'id')::bigint; end if;
  v_duration:=greatest(0,floor(extract(epoch from(clock_timestamp()-v_started))*1000)::integer);
  insert into public.hotel_api_request_logs(property_id,api_key_id,method,path,status_code,duration_ms,ip) values(v_key.property_id,v_key.id,coalesce(p_method,'GET'),coalesce(p_path,'/api/v1/reservations'),200,v_duration,left(p_ip,120));
  update public.hotel_api_keys set last_used_at=now() where id=v_key.id;
  return jsonb_build_object('ok',true,'status',200,'data',v_rows,'meta',jsonb_build_object('count',v_count,'limit',v_limit,'next_after_id',v_next,'filters',jsonb_build_object('from',p_from,'to',p_to,'status',nullif(btrim(p_status),''))),'rate_limit',v_key.rate_limit_per_min,'remaining',greatest(0,v_key.rate_limit_per_min-v_used-1));
end $$;

revoke all on function public.hl_api_keys_snapshot(uuid) from public;
revoke all on function public.hl_api_key_create(uuid,text,text,text,text[],integer,timestamptz) from public;
revoke all on function public.hl_api_key_revoke(uuid,uuid) from public;
revoke all on function public.hl_api_v1_reservations(text,date,date,text,integer,bigint,text,text,text) from public;
grant execute on function public.hl_api_keys_snapshot(uuid) to authenticated;
grant execute on function public.hl_api_key_create(uuid,text,text,text,text[],integer,timestamptz) to authenticated;
grant execute on function public.hl_api_key_revoke(uuid,uuid) to authenticated;
grant execute on function public.hl_api_v1_reservations(text,date,date,text,integer,bigint,text,text,text) to anon,authenticated;
