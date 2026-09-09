with cfg as (
  select ps.property_id,
         coalesce((ps.settings->'taxes'->>'enabled')::boolean,true) as enabled,
         greatest(0,coalesce(nullif(ps.settings->'taxes'->>'vat_rate','')::numeric,21)) as vat_rate,
         coalesce(ps.settings->'taxes'->>'price_tax_mode','tax_included') as price_tax_mode
  from public.property_settings ps
)
update public.hotel_charge_catalog c
set amount=round(
  round(c.amount*(1+cfg.vat_rate/100),0)/(1+cfg.vat_rate/100),
  6
),
updated_at=now()
from cfg
where cfg.property_id=c.property_id
  and cfg.enabled
  and cfg.price_tax_mode='tax_included'
  and abs(round(c.amount*(1+cfg.vat_rate/100),2)-round(c.amount*(1+cfg.vat_rate/100),0))<=0.01;
