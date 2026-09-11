export const MODULES={
  core_pms:{label:"PMS Core"},
  housekeeping:{label:"Housekeeping"},
  maintenance:{label:"Mantenimiento"},
  channel_manager:{label:"Channel Manager"},
  revenue:{label:"Revenue"},
  intelligence:{label:"Inteligencia"},
  guest_crm:{label:"Guest CRM"},
  automations:{label:"Automatizaciones"},
  ai:{label:"Llena Intelligence"},
  finance:{label:"Administración & Finanzas"},
  groups:{label:"Grupos & Empresas"},
  upselling:{label:"Upselling"},
  keys_access:{label:"Llaves & Accesos"},
  website_booking:{label:"Web & Motor"},
  purchasing:{label:"Compras & Stock"},
}

export const VIEW_MODULE={
  lobby:"core_pms",calendar:"core_pms",reservations:"core_pms",rooms:"core_pms",quote:"core_pms",support:"core_pms",settings:"core_pms",team:"core_pms",
  guests:"guest_crm",messages:"guest_crm",
  housekeeping:"housekeeping",
  maintenance:"maintenance",
  resources:"upselling",packages:"upselling",upselling:"upselling",
  rates:"revenue",
  distribution:"channel_manager",integrations:"channel_manager",
  analytics:"intelligence",reports:"intelligence",
  cash:"finance",billing:"finance",
  partners:"groups",groups:"groups",
  automations:"automations",
  intelligence:"ai",
  keys:"keys_access",
  twin:"maintenance",
}

export function moduleForView(view){return VIEW_MODULE[view]||"core_pms"}

export function buildModuleAccess({subscription=null,entitlements=[],planModules=[],catalog=[]}={}){
  const now=Date.now(),hasCommercialState=!!subscription||entitlements.length>0
  const trialing=subscription?.status==="trialing"&&(!subscription.trial_ends_at||new Date(subscription.trial_ends_at).getTime()>now)
  const grace=subscription?.status==="grace"&&(!subscription.grace_ends_at||new Date(subscription.grace_ends_at).getTime()>now)
  const active=subscription?.status==="active"||trialing||grace
  const enabled=new Set()
  catalog.filter(x=>x.base_required).forEach(x=>enabled.add(x.module_code))
  if(!hasCommercialState){Object.keys(MODULES).forEach(code=>enabled.add(code));return{enabled,legacy:true,trialing:false,subscription:null}}
  if(trialing){catalog.forEach(x=>{if(x.active!==false)enabled.add(x.module_code)})}
  else if(active){planModules.filter(x=>x.enabled!==false&&x.plan_code===subscription?.plan_code).forEach(x=>enabled.add(x.module_code))}
  entitlements.forEach(x=>x.enabled?enabled.add(x.feature_code):enabled.delete(x.feature_code))
  return{enabled,legacy:false,trialing,subscription}
}

export const hasModule=(access,moduleCode)=>access?.enabled?.has(moduleCode)===true
export const canViewModule=(access,view)=>hasModule(access,moduleForView(view))
