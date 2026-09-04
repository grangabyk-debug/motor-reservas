export const PRIMARY_NAV=[
  {id:"dashboard",label:"Dashboard",icon:"grid"},
  {id:"planning",label:"Planning",icon:"calendar"},
  {id:"reservations",label:"Reservas",icon:"booking"},
  {id:"guests",label:"Huéspedes",icon:"guest"},
  {id:"messages",label:"Mensajes",icon:"message"},
]

export const OPERATIONS_NAV=[
  {id:"tasks",label:"Tareas & check-lists",icon:"tasks"},
  {id:"requests",label:"Solicitudes",icon:"request"},
  {id:"housekeeping",label:"Housekeeping",icon:"clean"},
  {id:"maintenance",label:"Mantenimiento",icon:"wrench"},
  {id:"inventory",label:"Inventario",icon:"inventory"},
  {id:"services",label:"Servicios y extras",icon:"services"},
  {id:"rates",label:"Tarifas y disponibilidad",icon:"rates"},
  {id:"finance",label:"Finanzas",icon:"cash"},
]

export const MANAGEMENT_NAV=[
  {id:"reports",label:"Informes",icon:"report"},
  {id:"audit",label:"Actividad",icon:"activity"},
  {id:"staff",label:"Equipo",icon:"team"},
  {id:"integrations",label:"Integraciones",icon:"link"},
  {id:"settings",label:"Configuración",icon:"settings"},
]

export const NAV_LABELS=[...PRIMARY_NAV,...OPERATIONS_NAV,...MANAGEMENT_NAV].reduce((acc,item)=>{acc[item.id]=item.label;return acc},{})

const ALL_VIEWS=Object.keys(NAV_LABELS)
const ROLE_VIEWS={
  owner:ALL_VIEWS,
  admin:ALL_VIEWS,
  manager:ALL_VIEWS,
  reception:["dashboard","planning","reservations","guests","messages","tasks","requests","housekeeping","maintenance","inventory","services","rates","finance","audit"],
  night_audit:["dashboard","planning","reservations","guests","messages","tasks","requests","housekeeping","maintenance","inventory","services","rates","finance","reports","audit"],
  housekeeping:["dashboard","planning","tasks","requests","housekeeping","maintenance","inventory"],
  maintenance:["dashboard","planning","tasks","requests","housekeeping","maintenance","inventory"],
  revenue:["dashboard","planning","reservations","guests","services","rates","finance","reports"],
  member:["dashboard"],
}

export function canOpenView(role,view,featureFlags={}){
  if(!Object.prototype.hasOwnProperty.call(NAV_LABELS,view))return false
  if(view==="requests"&&featureFlags.guest_requests!==true)return false
  const allowed=ROLE_VIEWS[role]||ROLE_VIEWS.member
  return allowed.includes(view)
}

export function filterNavForRole(items,role,featureFlags={}){
  return items.filter(item=>canOpenView(role,item.id,featureFlags))
}
