import{supabase}from"../../../lib/supabase"

const CENTRAL_URL="https://pejkycdttogpmmdntzuq.supabase.co/functions/v1/hotel-support-chat"
const CENTRAL_KEY="sb_publishable_JmqxkVG1qNuCwWfqMeVgBg_-Nn32N2I"

async function token(){const{data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error("La sesión expiró.");return session.access_token}
async function call(body){const accessToken=await token(),response=await fetch(CENTRAL_URL,{method:"POST",headers:{"Content-Type":"application/json",apikey:CENTRAL_KEY,Authorization:`Bearer ${accessToken}`},body:JSON.stringify(body)}),data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data?.error||"No se pudo conectar con Central Gen.");return data}

export function loadHumanSupport({propertyId,section="Ayuda & Soporte"}){return call({action:"state",tenantId:String(propertyId),section})}
export function sendHumanSupport({propertyId,message,section="Ayuda & Soporte"}){return call({action:"send",tenantId:String(propertyId),section,message:String(message||"").trim(),clientMessageId:crypto.randomUUID()})}
export function closeHumanSupport({propertyId,section="Ayuda & Soporte"}){return call({action:"close",tenantId:String(propertyId),section})}
