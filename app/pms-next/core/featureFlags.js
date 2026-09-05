export const FEATURE_DEFAULTS=Object.freeze({
  guest_requests:true,
  outbound_inbox:false,
  suppliers:false,
  smart_access:false,
  smart_devices:false,
  utility_meters:false,
  telephony:false,
  restaging:false,
})

export function resolveFeatureFlags(settings){
  const raw=settings?.feature_flags
  if(!raw||typeof raw!=="object"||Array.isArray(raw))return{...FEATURE_DEFAULTS}
  return Object.fromEntries(Object.entries(FEATURE_DEFAULTS).map(([key,defaultValue])=>[key,typeof raw[key]==="boolean"?raw[key]:defaultValue]))
}

export function isFeatureEnabled(settings,key){
  return Boolean(resolveFeatureFlags(settings)[key])
}
