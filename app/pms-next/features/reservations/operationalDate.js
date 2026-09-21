const pad=value=>String(value).padStart(2,"0")

export function operationalDateKey(settings,now=new Date()){
  const timezone=String(settings?.preferences?.timezone||"America/Argentina/Buenos_Aires")
  const cutoff=Math.min(23,Math.max(0,Number(settings?.preferences?.hotel_day_cutoff_hour??12)||12))
  let parts
  const format=timeZone=>Object.fromEntries(new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(now).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]))
  try{parts=format(timezone)}catch{parts=format("America/Argentina/Buenos_Aires")}
  const base=new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)))
  if(Number(parts.hour)<cutoff)base.setUTCDate(base.getUTCDate()-1)
  return`${base.getUTCFullYear()}-${pad(base.getUTCMonth()+1)}-${pad(base.getUTCDate())}`
}
