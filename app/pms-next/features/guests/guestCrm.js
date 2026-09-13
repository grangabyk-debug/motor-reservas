const ONE_DAY=86400000
const localToday=()=>{const d=new Date();d.setHours(12,0,0,0);return d}
const asDate=value=>{if(!value)return null;const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?null:d}

export function birthdayInDays(birthDate,now=localToday()){
  const birth=asDate(birthDate);if(!birth)return null
  let next=new Date(now.getFullYear(),birth.getMonth(),birth.getDate(),12)
  if(next<now)next=new Date(now.getFullYear()+1,birth.getMonth(),birth.getDate(),12)
  return Math.max(0,Math.round((next-now)/ONE_DAY))
}

export function daysSince(dateValue,now=localToday()){
  const date=asDate(dateValue);if(!date)return null
  return Math.max(0,Math.floor((now-date)/ONE_DAY))
}

export const CRM_SEGMENTS=[
  {id:"repeat",label:"Recurrentes",description:"2 o más estadías",match:g=>(g.stays||0)>=2},
  {id:"loyal",label:"Muy frecuentes",description:"3 o más estadías",match:g=>(g.stays||0)>=3},
  {id:"vip",label:"VIP / Signature",description:"Atención prioritaria",match:g=>["vip","signature"].includes(g.vip_level)},
  {id:"birthday",label:"Cumpleaños próximos",description:"Dentro de 30 días",match:g=>{const days=birthdayInDays(g.birth_date);return days!=null&&days<=30}},
  {id:"upcoming",label:"Con próxima estadía",description:"Reserva futura registrada",match:g=>Boolean(g.nextStay)},
  {id:"dormant",label:"Para reactivar",description:"180+ días sin volver",match:g=>{const days=daysSince(g.lastStay||g.last_stay_at);return(g.stays||0)>0&&!g.nextStay&&days!=null&&days>=180}},
  {id:"ota_repeat",label:"OTA recurrentes",description:"Volvieron y reservan por OTA",match:g=>(g.stays||0)>=2&&Boolean(g.dominantChannel)&&!/^directa$/i.test(g.dominantChannel)},
  {id:"new",label:"Nuevos",description:"0–1 estadía",match:g=>(g.stays||0)<=1},
]

export function segmentCounts(guests=[]){return Object.fromEntries(CRM_SEGMENTS.map(segment=>[segment.id,guests.filter(segment.match).length]))}
export function segmentById(id){return CRM_SEGMENTS.find(item=>item.id===id)||null}

export function spendLabel(spentByCurrency={}){
  const entries=Object.entries(spentByCurrency).filter(([,value])=>Number(value)>0)
  if(!entries.length)return"—"
  return entries.slice(0,2).map(([currency,value])=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)).join(" · ")+(entries.length>2?" +":"")
}
