const ONE_DAY=86400000
const localToday=()=>{const d=new Date();d.setHours(12,0,0,0);return d}
const asDate=value=>{if(!value)return null;const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?null:d}
const normalizedChannel=value=>String(value||"").trim()

export function birthdayInDays(birthDate,now=localToday()){
  const birth=asDate(birthDate);if(!birth)return null
  let next=new Date(now.getFullYear(),birth.getMonth(),birth.getDate(),12)
  if(next<now)next=new Date(now.getFullYear()+1,birth.getMonth(),birth.getDate(),12)
  return Math.max(0,Math.round((next-now)/ONE_DAY))
}
export function daysSince(dateValue,now=localToday()){const date=asDate(dateValue);if(!date)return null;return Math.max(0,Math.floor((now-date)/ONE_DAY))}
export function daysUntil(dateValue,now=localToday()){const date=asDate(dateValue);if(!date)return null;return Math.round((date-now)/ONE_DAY)}
export function isBookingChannel(value){return /booking(?:\.com)?/i.test(normalizedChannel(value))}
export function isOtaChannel(value){return /(booking(?:\.com)?|airbnb|expedia|despegar|agoda|hotels\.com|hostelworld|vrbo|trivago|almundo)/i.test(normalizedChannel(value))}

export function marketingState(guest={}){
  const marketing=guest.preferences?.marketing||{}
  const status=String(guest.status||"").toLowerCase()
  const globalBlock=marketing.do_not_contact===true||marketing.suppressed===true||["blocked","deleted"].includes(status)
  const email=marketing.email===true,whatsapp=marketing.whatsapp===true
  const emailBlocked=globalBlock||marketing.email_unsubscribed===true||marketing.email_suppressed===true
  const whatsappBlocked=globalBlock||marketing.whatsapp_unsubscribed===true||marketing.whatsapp_suppressed===true
  return{email,whatsapp,canEmail:email&&Boolean(guest.email)&&!emailBlocked,canWhatsapp:whatsapp&&Boolean(guest.phone)&&!whatsappBlocked,emailBlocked,whatsappBlocked,globalBlock,updated_at:marketing.updated_at||null,source:marketing.source||null}
}

const countChannel=(guest,test)=>Object.entries(guest.channelCounts||{}).reduce((total,[channel,count])=>total+(test(channel)?Number(count)||0:0),0)
const bookingStays=guest=>Number.isFinite(Number(guest.bookingStays))?Number(guest.bookingStays):countChannel(guest,isBookingChannel)
const otaStays=guest=>Number.isFinite(Number(guest.otaStays))?Number(guest.otaStays):countChannel(guest,isOtaChannel)

export const CRM_SEGMENTS=[
  {id:"repeat",label:"Recurrentes",description:"2+ estadías",quick:true,group:"Fidelización",match:g=>(g.stays||0)>=2,reason:g=>`${g.stays||0} estadías registradas`},
  {id:"loyal",label:"Muy frecuentes",description:"3+ estadías",quick:true,group:"Fidelización",match:g=>(g.stays||0)>=3,reason:g=>`${g.stays||0} estadías registradas`},
  {id:"vip",label:"VIP / Signature",description:"Prioritarios",quick:true,group:"Fidelización",match:g=>["vip","signature"].includes(g.vip_level),reason:g=>`Nivel ${g.vip_level==="signature"?"Signature":"VIP"}`},
  {id:"birthday",label:"Cumpleaños",description:"Próximos 30 días",quick:true,group:"Ocasiones",match:g=>{const days=birthdayInDays(g.birth_date);return days!=null&&days<=30},reason:g=>{const days=birthdayInDays(g.birth_date);return days===0?"Cumpleaños hoy":`Cumpleaños en ${days} días`}},
  {id:"upcoming",label:"Próxima estadía",description:"Reserva futura",quick:true,group:"Estadía",match:g=>Boolean(g.nextStay),reason:g=>{const days=daysUntil(g.nextStay);return days===0?"Llega hoy":days===1?"Llega mañana":`Llega en ${days} días`}},
  {id:"dormant",label:"Para reactivar",description:"180+ días",quick:true,group:"Reactivación",match:g=>{const days=daysSince(g.lastStay||g.last_stay_at);return(g.stays||0)>0&&!g.currentStay&&!g.nextStay&&days!=null&&days>=180},reason:g=>`${daysSince(g.lastStay||g.last_stay_at)} días desde la última estadía`},
  {id:"ota_repeat",label:"OTA recurrentes",description:"2+ estadías OTA",quick:true,group:"Canal",match:g=>otaStays(g)>=2,reason:g=>`${otaStays(g)} estadías por OTA`},
  {id:"contactable",label:"Contacto autorizado",description:"Canal habilitado",quick:true,group:"Consentimiento",match:g=>{const m=marketingState(g);return m.canEmail||m.canWhatsapp},reason:g=>{const m=marketingState(g);return[m.canEmail?"Email":null,m.canWhatsapp?"WhatsApp":null].filter(Boolean).join(" + ")+" autorizado"}},
  {id:"new",label:"Nuevos",description:"0–1 estadía",quick:true,group:"Fidelización",match:g=>(g.stays||0)<=1,reason:g=>(g.stays||0)===0?"Sin estadías iniciadas":"Primera estadía"},
  {id:"birthday_in_house",label:"Cumpleaños alojado",description:"Hoy + en estadía",signal:true,group:"Ocasiones",match:g=>birthdayInDays(g.birth_date)===0&&Boolean(g.currentStay),reason:()=>"Cumpleaños hoy y huésped alojado"},
  {id:"frequent_5",label:"5+ estadías",description:"Frecuente consolidado",signal:true,group:"Fidelización",match:g=>(g.stays||0)>=5,reason:g=>`${g.stays||0} estadías: puede aplicar beneficio frecuente`},
  {id:"booking_3_email",label:"Booking 3× + email",description:"Oportunidad directa",signal:true,group:"Canal",match:g=>bookingStays(g)>=3&&marketingState(g).canEmail,reason:g=>`${bookingStays(g)} estadías por Booking · email autorizado`},
  {id:"inactive_12",label:"Inactivo 12 meses",description:"365+ días",signal:true,group:"Reactivación",match:g=>{const days=daysSince(g.lastStay||g.last_stay_at);return(g.stays||0)>0&&!g.currentStay&&!g.nextStay&&days!=null&&days>=365},reason:g=>`${daysSince(g.lastStay||g.last_stay_at)} días sin volver`},
  {id:"pre_arrival_5",label:"Llega en 5 días",description:"Pre-estadía",signal:true,group:"Estadía",match:g=>daysUntil(g.nextStay)===5,reason:()=>"Reserva con llegada dentro de 5 días"},
  {id:"checkout_yesterday",label:"Checkout ayer",description:"Post-estadía",signal:true,group:"Estadía",match:g=>!g.currentStay&&daysSince(g.lastStay||g.last_stay_at)===1,reason:()=>"Checkout realizado ayer"},
]

export function segmentCounts(guests=[]){return Object.fromEntries(CRM_SEGMENTS.map(segment=>[segment.id,guests.filter(segment.match).length]))}
export function segmentById(id){return CRM_SEGMENTS.find(item=>item.id===id)||null}
export function segmentReason(segmentOrId,guest={}){const segment=typeof segmentOrId==="string"?segmentById(segmentOrId):segmentOrId;return segment?.reason?.(guest)||segment?.description||""}
export function crmSignals(guest={}){return CRM_SEGMENTS.filter(item=>item.signal&&item.match(guest))}

export function loyaltySuggestion(guest={}){
  const signal=crmSignals(guest)[0]
  if(signal)return{label:signal.label,detail:segmentReason(signal,guest)}
  const birthday=birthdayInDays(guest.birth_date)
  if(birthday===0)return{label:"Cumpleaños hoy",detail:"Sugerir atención o beneficio de cortesía."}
  if(birthday!=null&&birthday<=7)return{label:"Cumpleaños próximo",detail:"Preparar una atención para la estadía."}
  if((guest.stays||0)>=3)return{label:"Huésped muy frecuente",detail:"Priorizar reserva directa y beneficio recurrente."}
  if(otaStays(guest)>=2)return{label:"Oportunidad de reserva directa",detail:"Ya volvió por OTA; ofrecer canal directo sólo con consentimiento válido."}
  return null
}

export function spendLabel(spentByCurrency={}){const entries=Object.entries(spentByCurrency).filter(([,value])=>Number(value)>0);if(!entries.length)return"—";return entries.slice(0,2).map(([currency,value])=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:0}).format(Number(value)||0)).join(" · ")+(entries.length>2?" +":"")}
