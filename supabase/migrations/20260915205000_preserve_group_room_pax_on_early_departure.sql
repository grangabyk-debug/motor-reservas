do $$
declare
  v_def text;
  v_old text := '''huespedes'',0';
  v_new text := '''huespedes'',greatest(0,coalesce(nullif(nullif(e->>''huespedes'','''')::integer,0),(select count(*)::integer from public.hotel_reservation_guests g where g.reservation_id=v.id and g.property_id=v.property_id and g.room_id=p_room_id),0))';
begin
  select pg_get_functiondef('public.hl_cancel_group_room_atomic(bigint,bigint,date,numeric,boolean,text)'::regprocedure) into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'No se encontró el fragmento esperado de hl_cancel_group_room_atomic';
  end if;
  v_def := replace(v_def,v_old,v_new);
  execute v_def;
end $$;
