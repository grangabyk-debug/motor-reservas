export const PRIMARY_NAV=[
  {id:"dashboard",label:"Dashboard",icon:"grid"},
  {id:"planning",label:"Planning",icon:"calendar"},
  {id:"reservations",label:"Reservas",icon:"booking"},
  {id:"guests",label:"Huéspedes",icon:"guest"},
  {id:"messages",label:"Mensajes",icon:"message"},
]

export const OPERATIONS_NAV=[
  {id:"tasks",label:"Tareas & check-lists",icon:"tasks"},
  {id:"housekeeping",label:"Housekeeping",icon:"clean"},
  {id:"maintenance",label:"Mantenimiento",icon:"wrench"},
  {id:"rates",label:"Tarifas y disponibilidad",icon:"rates"},
  {id:"cash",label:"Caja y pagos",icon:"cash"},
]

export const MANAGEMENT_NAV=[
  {id:"reports",label:"Informes",icon:"report"},
  {id:"staff",label:"Equipo",icon:"team"},
  {id:"integrations",label:"Integraciones",icon:"link"},
  {id:"settings",label:"Configuración",icon:"settings"},
]

export const NAV_LABELS=[...PRIMARY_NAV,...OPERATIONS_NAV,...MANAGEMENT_NAV].reduce((acc,item)=>{
  acc[item.id]=item.label
  return acc
},{})
