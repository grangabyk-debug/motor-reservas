export const PRIMARY_NAV=[
  {id:"dashboard",label:"Dashboard",icon:"grid"},
  {id:"portfolio",label:"Cartera",icon:"grid"},
  {id:"planning",label:"Planning",icon:"calendar"},
  {id:"reservations",label:"Reservas",icon:"booking"},
  {id:"quotes",label:"Presupuestos",icon:"quote"},
  {id:"guests",label:"Huéspedes",icon:"guest"},
  {id:"messages",label:"Mensajes",icon:"message"},
]

export const RECEPTION_NAV=[
  {id:"finance",label:"Caja y finanzas",icon:"cash"},
  {id:"dailycontrol",label:"Control diario",icon:"activity"},
  {id:"audit",label:"Cierre diario",icon:"activity"},
  {id:"receptionreports",label:"Informes de recepción",icon:"report"},
]

export const HOUSEKEEPING_NAV=[
  {id:"housekeeping",label:"Housekeeping",icon:"clean"},
]

export const OPERATIONS_NAV=[
  {id:"maintenance",label:"Mantenimiento",icon:"wrench"},
  {id:"inventory",label:"Inventario",icon:"inventory"},
  {id:"services",label:"Servicios y extras",icon:"services"},
  {id:"rates",label:"Tarifas y disponibilidad",icon:"rates"},
]

export const MANAGEMENT_NAV=[
  {id:"revenue",label:"Revenue",icon:"rates"},
  {id:"growth",label:"Ventas y crecimiento",icon:"growth"},
  {id:"intelligence",label:"Inteligencia",icon:"report"},
  {id:"reports",label:"Informes",icon:"report"},
  {id:"onboarding",label:"Puesta en marcha",icon:"activity"},
  {id:"website",label:"Sitio web",icon:"link"},
  {id:"channelmanager",label:"Channel Manager",icon:"link"},
  {id:"staff",label:"Equipo",icon:"team"},
  {id:"settings",label:"Configuración",icon:"settings"},
  {id:"help",label:"Centro de ayuda",icon:"help"},
  {id:"support",label:"Feedback y soporte",icon:"help"},
]

export const INTEGRATIONS_NAV=[
  {id:"integrations",label:"Apps externas",icon:"link"},
  {id:"integrationapi",label:"REST API",icon:"link"},
  {id:"integrationmessages",label:"Mensajería",icon:"message"},
  {id:"integrationpayments",label:"Pagos",icon:"cash"},
]

export const HIDDEN_NAV=[
  {id:"dailycash",label:"Caja diaria",icon:"cash"},
  {id:"tasks",label:"Control de Operación",icon:"activity"},
  {id:"requests",label:"Solicitudes",icon:"request"},
  {id:"subscription",label:"Mi suscripción",icon:"settings"},
]

export const NAV_LABELS=[...PRIMARY_NAV,...RECEPTION_NAV,...HOUSEKEEPING_NAV,...OPERATIONS_NAV,...MANAGEMENT_NAV,...INTEGRATIONS_NAV,...HIDDEN_NAV].reduce((acc,item)=>{acc[item.id]=item.label;return acc},{})

export const VIEW_MODULES={
  dashboard:"core_pms",portfolio:"core_pms",tasks:"core_pms",planning:"core_pms",reservations:"core_pms",quotes:"core_pms",guests:"core_pms",messages:"core_pms",
  dailycash:"core_pms",dailycontrol:"core_pms",finance:"finance",receptionreports:"core_pms",
  housekeeping:"housekeeping",maintenance:"maintenance",inventory:"purchasing",services:"upselling",rates:"core_pms",
  onboarding:"core_pms",website:"website_booking",growth:"guest_crm",revenue:"revenue",intelligence:"intelligence",channelmanager:"channel_manager",
  reports:"core_pms",audit:"core_pms",staff:"core_pms",settings:"core_pms",help:"core_pms",support:"core_pms",
  integrations:"automations",integrationapi:"automations",integrationmessages:"automations",integrationpayments:"finance",
  requests:"core_pms",subscription:"core_pms"
}

export const VIEW_DESCRIPTIONS={
  dashboard:"Resumen operativo del hotel: llegadas, huéspedes alojados, salidas, ocupación, habitaciones y alertas que requieren atención.",portfolio:"Vista central de todas las propiedades autorizadas: ocupación, llegadas, salidas, mantenimiento y acceso directo a cada operación sin mezclar inventarios.",tasks:"Detalle operativo para investigar excepciones, próximas horas, integraciones y recomendaciones explicables desde una sola vista.",planning:"Calendario operativo para crear, mover, extender y revisar reservas y disponibilidad por habitación.",reservations:"Listado y ficha completa de cada reserva, con huéspedes, estadía, pagos, documentos, historial y acciones de recepción.",quotes:"Creá y seguí presupuestos antes de convertirlos en reservas, con fechas, habitaciones, tarifas y condiciones.",guests:"Historial y perfil de huéspedes para reconocer repetidores, preferencias, idioma, etiquetas y datos de contacto.",messages:"Centraliza comunicaciones vinculadas a huéspedes y reservas para que el seguimiento quede asociado a la operación.",dailycash:"Acceso compatible a la caja operativa diaria.",dailycontrol:"Registro diario de visitantes, vehículos y guarda equipajes, con entradas, salidas, entregas y trazabilidad vinculada a reservas.",finance:"Caja diaria, cobros, facturación, gastos y control financiero de la propiedad desde un solo lugar.",receptionreports:"Informes operativos de recepción para llegadas, salidas, desayunos y housekeeping, editables antes de imprimir o exportar a Excel.",housekeeping:"Panel operativo de Housekeeping: habitaciones, prioridades, limpieza, inspección, peticiones asignadas al área y cola de trabajo en tiempo real.",requests:"Vista interna de peticiones; cada petición se enruta al área responsable.",maintenance:"Órdenes de trabajo, preventivos, activos, proveedores y habitaciones fuera de venta.",inventory:"Stock operativo, movimientos y niveles de reposición de insumos utilizados por el hotel.",services:"Catálogo y cargos de servicios y extras que pueden agregarse a reservas y cuentas de huéspedes.",rates:"Tarifas, disponibilidad y restricciones comerciales por fecha para controlar lo que se vende.",onboarding:"Checklist de implementación para saber qué falta antes de operar y vender con una propiedad.",website:"Construí y publicá la web del hotel y su motor de reservas desde un único estudio visual conectado al inventario real.",growth:"Indicadores y herramientas comerciales para entender origen de reservas, producción y oportunidades de venta.",revenue:"Forecast, pickup, ADR, RevPAR y recomendaciones de revenue construidas con reservas reales, sin cambios automáticos de tarifa.",intelligence:"KPIs, canales, finanzas, pickup, booking window y rendimiento por tipo de habitación.",channelmanager:"Conectá OTAs y sincronizá disponibilidad, tarifas, restricciones y reservas desde un solo inventario.",reports:"Informes operativos, comerciales y financieros construidos con los datos reales de la propiedad.",audit:"Cierre del día operativo con control de llegadas, salidas, caja y saldos, más historial de actividad y trazabilidad.",staff:"Usuarios, roles, permisos y procedimientos operativos de la propiedad.",integrations:"Conectores externos útiles para ampliar el PMS sin mezclar la operación diaria.",integrationapi:"Acceso programático seguro a Habitación Llena para integraciones propias.",integrationmessages:"Canales de mensajería conectados a la operación y a los huéspedes.",integrationpayments:"Pasarelas de pago y estado de las conexiones de cobro online.",subscription:"Plan contratado, habitaciones incluidas, módulos habilitados y solicitudes de cambio.",settings:"Configuración de la propiedad, preferencias operativas, branding, reglas y funciones habilitadas.",help:"Guía navegable por área y procedimiento para aprender el PMS y resolver tareas habituales sin salir del sistema.",support:"Asistente, soporte humano e ideas de producto para reportar problemas, hacer preguntas y enviar sugerencias."
}
export const ALL_VIEWS=Object.keys(NAV_LABELS)

function commercialViewAllowed(view,featureFlags={}){const modules=featureFlags?.__modules;if(!modules||typeof modules!=="object"||Array.isArray(modules))return true;const moduleCode=VIEW_MODULES[view]||"core_pms";return modules[moduleCode]!==false}

export const ROLE_VIEWS={
  owner:ALL_VIEWS,manager:ALL_VIEWS,admin:ALL_VIEWS,
  reception:["dashboard","tasks","planning","reservations","quotes","guests","messages","dailycash","dailycontrol","finance","receptionreports","inventory","services","rates","audit","help","support"],
  night_audit:["dashboard","tasks","planning","reservations","quotes","guests","messages","dailycash","dailycontrol","finance","receptionreports","inventory","services","rates","reports","audit","help","support"],
  housekeeping:["dashboard","tasks","housekeeping","inventory","help","support"],
  maintenance:["dashboard","tasks","maintenance","inventory","help","support"],
  revenue:["dashboard","portfolio","tasks","planning","reservations","quotes","guests","services","dailycash","rates","finance","website","growth","revenue","intelligence","channelmanager","reports","help","support"],
  member:["dashboard","help","support"]
}
export function getAllowedViews(role,featureFlags={},rolePermissions={}){const normalized=role||"member";let allowed;if(normalized==="owner"||normalized==="manager"||normalized==="admin")allowed=ALL_VIEWS;else if(Array.isArray(rolePermissions?.[normalized]))allowed=["dashboard",...rolePermissions[normalized],"help","support"];else allowed=ROLE_VIEWS[normalized]||ROLE_VIEWS.member;const unique=[...new Set(allowed.filter(view=>Object.prototype.hasOwnProperty.call(NAV_LABELS,view)))];return unique.filter(view=>(view!=="requests"||featureFlags.guest_requests===true)&&commercialViewAllowed(view,featureFlags))}
export function canOpenView(role,view,featureFlags={},rolePermissions={}){if(!Object.prototype.hasOwnProperty.call(NAV_LABELS,view))return false;return getAllowedViews(role,featureFlags,rolePermissions).includes(view)}
export function filterNavForRole(items,role,featureFlags={},rolePermissions={}){const allowed=new Set(getAllowedViews(role,featureFlags,rolePermissions));return items.filter(item=>allowed.has(item.id))}