export const RATE_PLAN_PRESETS=[
  {code:"BB",name:"Alojamiento + desayuno",meal_plan:"breakfast",legacy_regimen:"Desayuno incluido",description:"Alojamiento con desayuno incluido en la tarifa."},
  {code:"RO",name:"Solo alojamiento",meal_plan:"room_only",legacy_regimen:"Solo alojamiento",description:"Alojamiento sin comidas incluidas."},
  {code:"HB",name:"Media pensión",meal_plan:"half_board",legacy_regimen:"Media pensión",description:"Alojamiento con desayuno y una comida principal."},
  {code:"FB",name:"Pensión completa",meal_plan:"full_board",legacy_regimen:"Pensión completa",description:"Alojamiento con desayuno, almuerzo y cena."},
  {code:"AI",name:"Todo incluido",meal_plan:"all_inclusive",legacy_regimen:"Todo incluido",description:"Alojamiento con el régimen todo incluido."},
]

const number=value=>Number.isFinite(Number(value))?Number(value):0
const rawConfig=input=>input&&typeof input==="object"&&input.rate_plans&&typeof input.rate_plans==="object"?input.rate_plans:input&&typeof input==="object"?input:{}

export function normalizeRatePlans(input={}){
  const raw=rawConfig(input),saved=new Map((Array.isArray(raw.plans)?raw.plans:[]).map(plan=>[String(plan?.code||"").toUpperCase(),plan]))
  let plans=RATE_PLAN_PRESETS.map((preset,index)=>{
    const current=saved.get(preset.code)||{}
    const defaultActive=preset.code==="BB"
    return{...preset,active:current.active==null?defaultActive:Boolean(current.active),public:current.public==null?Boolean(current.active??defaultActive):Boolean(current.public),adjustment_per_person:number(current.adjustment_per_person),description:String(current.description??preset.description),sort_order:index}
  })
  let defaultCode=String(raw.default_code||"BB").toUpperCase()
  if(!plans.some(plan=>plan.code===defaultCode))defaultCode="BB"
  plans=plans.map(plan=>plan.code===defaultCode?{...plan,active:true,adjustment_per_person:0}:plan)
  if(!plans.some(plan=>plan.active)){defaultCode="BB";plans=plans.map(plan=>plan.code==="BB"?{...plan,active:true,adjustment_per_person:0}:plan)}
  return{version:1,default_code:defaultCode,plans}
}

export const activeRatePlans=input=>normalizeRatePlans(input).plans.filter(plan=>plan.active)
export function ratePlanByCode(input,code){const config=normalizeRatePlans(input),key=String(code||config.default_code).toUpperCase();return config.plans.find(plan=>plan.code===key)||config.plans.find(plan=>plan.code===config.default_code)||config.plans[0]}
export const defaultRatePlan=input=>ratePlanByCode(input,normalizeRatePlans(input).default_code)
export const legacyRegimenForPlan=plan=>String(plan?.legacy_regimen||plan?.name||"Desayuno incluido")

export function configuredAmountToNet(amount,taxes={}){
  const value=number(amount),enabled=taxes?.enabled!==false,rate=Math.max(0,number(taxes?.vat_rate)),mode=taxes?.price_tax_mode==="tax_excluded"?"tax_excluded":"tax_included"
  return enabled&&mode==="tax_included"&&rate>0?value/(1+rate/100):value
}
export function netAmountToFinal(amount,taxes={}){
  const value=number(amount),enabled=taxes?.enabled!==false,rate=Math.max(0,number(taxes?.vat_rate))
  return enabled&&rate>0?value*(1+rate/100):value
}
export function configuredAmountToFinal(amount,taxes={}){
  const value=number(amount),enabled=taxes?.enabled!==false,rate=Math.max(0,number(taxes?.vat_rate)),mode=taxes?.price_tax_mode==="tax_excluded"?"tax_excluded":"tax_included"
  return enabled&&mode==="tax_excluded"&&rate>0?value*(1+rate/100):value
}
export function ratePlanAmounts(plan,guests,taxes={}){
  const pax=Math.max(0,number(guests)),configuredPerPerson=number(plan?.adjustment_per_person),netPerPerson=configuredAmountToNet(configuredPerPerson,taxes),finalPerPerson=configuredAmountToFinal(configuredPerPerson,taxes)
  return{configuredPerPerson,netPerPerson,finalPerPerson,configuredPerNight:configuredPerPerson*pax,netPerNight:netPerPerson*pax,finalPerNight:finalPerPerson*pax}
}
export function convertRatePlans(input,factor){
  const config=normalizeRatePlans(input),multiplier=number(factor)||1
  return{...config,plans:config.plans.map(plan=>({...plan,adjustment_per_person:plan.code===config.default_code?0:Math.round(number(plan.adjustment_per_person)*multiplier*1000000)/1000000}))}
}
