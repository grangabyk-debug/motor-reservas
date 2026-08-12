create or replace function public.comanda_bootstrap_account(p_name text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $function$
declare
  v_uid uuid := auth.uid();
  v_account uuid;
  v_branch uuid;
  v_sector uuid;
  v_category uuid;
  v_slug text;
begin
  if v_uid is null then
    raise exception 'authentication_required';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 then
    raise exception 'business_name_required';
  end if;

  select id into v_account
  from public.comanda_accounts
  where owner_id = v_uid
  order by created_at
  limit 1;

  if v_account is not null then
    return v_account;
  end if;

  v_slug := lower(regexp_replace(unaccent(trim(p_name)), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,6);

  insert into public.comanda_accounts(name, slug, owner_id)
  values (trim(p_name), v_slug, v_uid)
  returning id into v_account;

  insert into public.comanda_members(account_id,user_id,role)
  values (v_account,v_uid,'owner');

  insert into public.comanda_branches(account_id,name)
  values (v_account,'Central')
  returning id into v_branch;

  insert into public.comanda_cash_registers(account_id,branch_id,name)
  values (v_account,v_branch,'Caja principal');

  insert into public.comanda_staff(account_id,branch_id,name,staff_type,permissions) values
    (v_account,v_branch,'Administrador','admin','{"all":true}'::jsonb),
    (v_account,v_branch,'Mozo eventual','waiter','{"sell":true,"open_table":true}'::jsonb),
    (v_account,v_branch,'Cajero','cashier','{"sell":true,"take_payment":true,"cash":true}'::jsonb),
    (v_account,v_branch,'Cocina','cook','{"kitchen":true}'::jsonb);

  insert into public.comanda_sectors(account_id,branch_id,name,sort_order)
  values (v_account,v_branch,'Salón',1)
  returning id into v_sector;

  insert into public.comanda_tables(account_id,branch_id,sector_id,number,seats,pos_x,pos_y)
  select v_account,v_branch,v_sector,n::text,4,((n-1)%4),floor((n-1)/4.0)::int
  from generate_series(1,12) n;

  insert into public.comanda_categories(account_id,branch_id,name,color,sort_order) values
    (v_account,v_branch,'Cafetería','#d8b07a',1),
    (v_account,v_branch,'Entradas','#8bd4b1',2),
    (v_account,v_branch,'Principales','#f0a8a8',3),
    (v_account,v_branch,'Bebidas','#91c9ef',4),
    (v_account,v_branch,'Postres','#e4c7a8',5);

  select id into v_category from public.comanda_categories where account_id=v_account and name='Cafetería' limit 1;
  insert into public.comanda_products(account_id,category_id,name,price,destination,sort_order) values
    (v_account,v_category,'Café espresso',3000,'bar',1),
    (v_account,v_category,'Café americano',4000,'bar',2),
    (v_account,v_category,'Café con leche',5000,'bar',3),
    (v_account,v_category,'Medialuna',2000,'kitchen',4);

  select id into v_category from public.comanda_categories where account_id=v_account and name='Principales' limit 1;
  insert into public.comanda_products(account_id,category_id,name,price,destination,sort_order) values
    (v_account,v_category,'Milanesa con papas',12500,'kitchen',1),
    (v_account,v_category,'Hamburguesa completa',11500,'kitchen',2),
    (v_account,v_category,'Pasta del día',10500,'kitchen',3),
    (v_account,v_category,'Ensalada completa',8500,'kitchen',4);

  select id into v_category from public.comanda_categories where account_id=v_account and name='Bebidas' limit 1;
  insert into public.comanda_products(account_id,category_id,name,price,destination,sort_order) values
    (v_account,v_category,'Agua mineral',3000,'bar',1),
    (v_account,v_category,'Gaseosa',3500,'bar',2);

  insert into public.comanda_onboarding(account_id,business_done,team_done,tables_done,menu_done,cash_done)
  values(v_account,true,true,true,true,true);

  return v_account;
end;
$function$;

revoke all on function public.comanda_bootstrap_account(text) from public, anon;
grant execute on function public.comanda_bootstrap_account(text) to authenticated;
