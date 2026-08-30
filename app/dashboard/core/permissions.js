export const ROLE_LABELS = {
  owner:"Propietario", manager:"Gerencia", reception:"Recepción", housekeeping:"Housekeeping",
  admin:"Administración", revenue:"Revenue", maintenance:"Mantenimiento", night_audit:"Auditor nocturno",
}

export const PERMISSION_DEFAULTS = {
  owner:["*"],
  manager:["frontdesk.*","operations.*","commercial.*","finance.*","hotel.read","hotel.team","hotel.automations"],
  reception:["frontdesk.*","operations.rooms.read","operations.housekeeping.read","commercial.upsell","finance.payments","finance.folios","finance.reports"],
  housekeeping:["operations.rooms.read","operations.housekeeping.*","operations.maintenance.create"],
  admin:["finance.*","frontdesk.reservations.read","commercial.partners.read","commercial.groups.read"],
  revenue:["commercial.*","frontdesk.reservations.read","finance.reports"],
  maintenance:["operations.rooms.read","operations.maintenance.*","operations.resources.read"],
  night_audit:["frontdesk.*","operations.rooms.read","operations.housekeeping.read","finance.payments","finance.folios","finance.reports"],
}

function matches(granted, requested){
  if(granted==="*"||granted===requested)return true
  if(granted.endsWith(".*"))return requested.startsWith(granted.slice(0,-1))
  return false
}

export function can(role,permission,overrides=[]){
  const override=overrides.find(item=>item.role===role&&item.permission===permission)
  if(override)return !!override.allowed
  return (PERMISSION_DEFAULTS[role]||[]).some(granted=>matches(granted,permission))
}
