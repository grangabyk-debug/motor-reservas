export const PRIMARY_NAV=[
  {id:"dashboard",label:"Dashboard",icon:"grid"},
  {id:"planning",label:"Planning",icon:"calendar"},
  {id:"reservations",label:"Reservas",icon:"booking"},
  {id:"quotes",label:"Presupuestos",icon:"quote"},
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
]

export const RECEPTION_NAV=[
  {id:"dailycash",label:"Caja diaria",icon:"cash"},
  {id:"finance",label:"Finanzas",icon:"cash"},
  {id:"receptionreports",label:"Reportes",icon:"report"},
]

export const MANAGEMENT_NAV=[
  {id:"onboarding",label:"Puesta en marcha",icon:"activity"},
  {id:"website",label:"Sitio web",icon:"link"},
  {id:"growth",label:"Ventas y crecimiento",icon:"growth"},
  {id:"reports",label:"Informes",icon:"report"},
  {id:"audit",label:"Actividad",icon:"activity"},
  {id:"staff",label:"Equipo",icon:"team"},
  {id:"integrations",label:"Integraciones",icon:"link"},
  {id:"settings",label:"Configuración",icon:"settings"},
  {id:"support",label:"Ayuda & feedback",icon:"help"},
]

export const NAV_LABELS=[...PRIMARY_NAV,...OPERATIONS_NAV,...RECEPTION_NAV,...MANAGEMENT_NAV].reduce((acc,item)=>{acc[item.id]=item.label;return acc},{})
export const VIEW_DESCRIPTIONS={
  dashboard:"Resumen operativo del hotel: llegadas, huéspedes alojados, salidas, ocupación, habitaciones y alertas que requieren atención.",planning:"Calendario operativo para crear, mover, extender y revisar reservas y disponibilidad por habitación.",reservations:"Listado y ficha completa de cada reserva, con huéspedes, estadía, pagos, documentos, historial y acciones de recepción.",quotes:"Creá y seguí presupuestos antes de convertirlos en reservas, con fechas, habitaciones, tarifas y condiciones.",guests:"Historial y perfil de huéspedes para reconocer repetidores, preferencias, idioma, etiquetas y datos de contacto.",messages:"Centraliza comunicaciones vinculadas a huéspedes y reservas para que el seguimiento quede asociado a la operación.",tasks:"Tareas internas y check-lists para coordinar rutinas del hotel y controlar su cumplimiento.",requests:"Solicitudes de huéspedes vinculadas a reserva, habitación, prioridad, responsable, vencimiento y estado.",housekeeping:"Estado de limpieza e inspección de habitaciones, asignación de tareas y preparación para próximas llegadas.",maintenance:"Incidencias técnicas del hotel con prioridad, habitación, responsable, vencimiento y seguimiento hasta resolución.",inventory:"Stock operativo, movimientos y niveles de reposición de insumos utilizados por el hotel.",services:"Catálogo y cargos de servicios y extras que pueden agregarse a reservas y cuentas de huéspedes.",dailycash:"Caja operativa de recepción por día: cobros de reservas, efectivo, transferencias, tarjetas, movimientos, comprobantes y arqueo.",finance:"Cobros, saldos, documentos, solicitudes de pago y movimientos financieros vinculados a las reservas.",receptionreports:"Planillas operativas de recepción para llegadas, salidas, desayuno y housekeeping, listas para descargar o imprimir.",rates:"Tarifas, disponibilidad y restricciones comerciales por fecha para controlar lo que se vende.",onboarding:"Checklist de implementación para saber qué falta antes de operar y vender con una propiedad.",website:"Editor simple de la web del hotel: plantilla, portada, galería, presentación, contacto y SEO, siempre conectado al mismo motor de reservas.",growth:"Indicadores y herramientas comerciales para entender origen de reservas, producción y oportunidades de venta.",reports:"Informes operativos, comerciales y financieros construidos con los datos reales de la propiedad.",audit:"Trazabilidad de cambios y acciones realizadas en el PMS para saber qué pasó, cuándo y sobre qué registro.",staff:"Usuarios, roles y permisos de la propiedad para separar correctamente responsabilidades y accesos.",integrations:"Canales de venta, motor web y conexiones externas de la propiedad, con estado y herramientas de implementación.",settings:"Configuración de la propiedad, preferencias operativas, branding, reglas y funciones habilitadas.",support:"Primero te ayuda el asistente de Habitación Llena; si no alcanza, podés escalar la conversación completa al equipo de soporte."
}
export const ALL_VIEWS=Object.keys(NAV_LABELS)
export const ROLE_VIEWS={owner:ALL_VIEWS,manager:ALL_VIEWS,admin:ALL_VIEWS,reception:["dashboard","planning","reservations","quotes","guests","messages","tasks","requests","housekeeping","maintenance","inventory","services","dailycash","finance","receptionreports","rates","audit","support"],night_audit:["dashboard","planning","reservations","quotes","guests","messages","tasks","requests","housekeeping","maintenance","inventory","services","dailycash","finance","receptionreports","rates","reports","audit","support"],housekeeping:["dashboard","planning","tasks","requests","housekeeping","maintenance","inventory","support"],maintenance:["dashboard","planning","tasks","requests","housekeeping","maintenance","inventory","support"],revenue:["dashboard","planning","reservations","quotes","guests","services","dailycash","rates","finance","website","growth","reports","support"],member:["dashboard","support"]}
export function getAllowedViews(role,featureFlags={},rolePermissions={}){const normalized=role||"member";let allowed;if(normalized==="owner"||normalized==="manager"||normalized==="admin")allowed=ALL_VIEWS;else if(Array.isArray(rolePermissions?.[normalized]))allowed=["dashboard",...rolePermissions[normalized]];else allowed=ROLE_VIEWS[normalized]||ROLE_VIEWS.member;const unique=[...new Set(allowed.filter(view=>Object.prototype.hasOwnProperty.call(NAV_LABELS,view)))];return unique.filter(view=>view!=="requests"||featureFlags.guest_requests===true)}
export function canOpenView(role,view,featureFlags={},rolePermissions={}){if(!Object.prototype.hasOwnProperty.call(NAV_LABELS,view))return false;return getAllowedViews(role,featureFlags,rolePermissions).includes(view)}
export function filterNavForRole(items,role,featureFlags={},rolePermissions={}){const allowed=new Set(getAllowedViews(role,featureFlags,rolePermissions));return items.filter(item=>allowed.has(item.id))}
