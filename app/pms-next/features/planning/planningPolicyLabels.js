const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)

export function chargeLabel(rule,currency="ARS"){
  const type=rule?.charge_type||"none",value=Math.max(0,Number(rule?.value)||0)
  if(type==="fixed")return money(value,currency)
  if(type==="percent")return`${value}% del total`
  if(type==="nights")return`${value} noche${value===1?"":"s"}`
  return"Sin cargo"
}

export function cancelRulesLabel(policy){
  const rules=Array.isArray(policy?.cancellation_rules)?policy.cancellation_rules:[]
  if(!rules.length)return"Sin reglas de cancelación cargadas"
  return[...rules].sort((a,b)=>Number(b.min_days_before||0)-Number(a.min_days_before||0)).map(rule=>Number(rule.min_days_before||0)>0?`Hasta ${rule.min_days_before} día${Number(rule.min_days_before)===1?"":"s"} antes: ${chargeLabel(rule,policy.currency)}`:`Fuera de plazo: ${chargeLabel(rule,policy.currency)}`).join(" · ")
}
