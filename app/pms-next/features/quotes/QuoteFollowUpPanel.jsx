"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"

export const FOLLOW_CHANNEL={email:"Email",whatsapp:"WhatsApp",phone:"Teléfono",other:"Otro"}
export const followWhen=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):""
const toLocalInput=value=>{if(!value)return"";const d=new Date(value),pad=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
const emit=detail=>{if(typeof window!=="undefined")window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))}

export async function recordQuoteContact({propertyId,quote,channel}){
  const now=new Date().toISOString(),patch={last_contacted_at:now,...(quote.status==="draft"?{status:"sent",sent_at:now}:{})}
  const{error}=await supabase.from("hotel_group_quotes").update(patch).eq("id",quote.id).eq("property_id",propertyId)
  if(error)throw error
  return patch
}

export default function QuoteFollowUpPanel({quote,propertyId,onUpdated}){
  const[draft,setDraft]=useState({at:"",channel:"whatsapp",note:""}),[saving,setSaving]=useState(false),[error,setError]=useState("")
  useEffect(()=>{setDraft({at:toLocalInput(quote?.follow_up_at),channel:quote?.follow_up_channel||"whatsapp",note:quote?.follow_up_note||""});setError("")},[quote?.id,quote?.follow_up_at,quote?.follow_up_channel,quote?.follow_up_note])

  async function save(){
    if(!draft.at)return setError("Elegí fecha y hora para el próximo seguimiento.")
    setSaving(true);setError("")
    try{
      const patch={follow_up_at:new Date(draft.at).toISOString(),follow_up_channel:draft.channel,follow_up_status:"pending",follow_up_note:draft.note.trim()||null}
      const{error:updateError}=await supabase.from("hotel_group_quotes").update(patch).eq("id",quote.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      const{data:crmRows}=await supabase.from("hotel_crm_opportunities").update({stage:"follow_up",next_follow_up_at:patch.follow_up_at,follow_up_channel:patch.follow_up_channel}).eq("property_id",propertyId).eq("quote_id",quote.id).not("stage","in","(won,lost)").select("id")
      for(const row of crmRows||[])await supabase.rpc("hl_crm_log_activity_atomic",{p_opportunity_id:row.id,p_activity_type:"stage",p_summary:"Seguimiento programado desde Presupuestos.",p_channel:patch.follow_up_channel,p_metadata:{quote_id:quote.id,follow_up_at:patch.follow_up_at}})
      onUpdated?.(patch)
      emit({title:"Seguimiento programado",message:`${quote.quote_number} · ${followWhen(patch.follow_up_at)} por ${FOLLOW_CHANNEL[patch.follow_up_channel]||patch.follow_up_channel}.`})
    }catch(err){setError(err?.message||"No se pudo programar el seguimiento.")}
    finally{setSaving(false)}
  }

  async function finish(){
    setSaving(true);setError("")
    try{
      const patch={follow_up_status:"done",last_contacted_at:new Date().toISOString()}
      const{error:updateError}=await supabase.from("hotel_group_quotes").update(patch).eq("id",quote.id).eq("property_id",propertyId)
      if(updateError)throw updateError
      await supabase.from("hotel_crm_opportunities").update({next_follow_up_at:null}).eq("property_id",propertyId).eq("quote_id",quote.id).not("stage","in","(won,lost)")
      onUpdated?.(patch)
      emit({title:"Seguimiento completado",message:quote.quote_number})
    }catch(err){setError(err?.message||"No se pudo completar el seguimiento.")}
    finally{setSaving(false)}
  }

  return <div style={{marginTop:14,padding:14,border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:14,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}>
    <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"start",marginBottom:10}}>
      <div><b style={{display:"block",fontSize:12}}>Seguimiento comercial</b><small style={{display:"block",marginTop:3,color:"var(--muted)"}}>Programá el próximo contacto después de enviar el presupuesto. No bloquea el Planning.</small></div>
      {quote.follow_up_status==="pending"&&quote.follow_up_at?<span style={{fontSize:10,fontWeight:900,color:new Date(quote.follow_up_at)<new Date()?"#c24850":"var(--accent)"}}>{new Date(quote.follow_up_at)<new Date()?"VENCIDO":"PENDIENTE"}</span>:quote.follow_up_status==="done"?<span style={{fontSize:10,fontWeight:900,color:"#2f8f61"}}>HECHO</span>:null}
    </div>
    {error?<div style={{marginBottom:8,color:"#c24850",fontSize:10,fontWeight:750}}>{error}</div>:null}
    <div style={{display:"grid",gridTemplateColumns:"minmax(180px,1fr) minmax(120px,.6fr)",gap:8}}>
      <label style={{display:"grid",gap:4,fontSize:10,fontWeight:800}}>Próximo seguimiento<input type="datetime-local" value={draft.at} onChange={e=>setDraft(current=>({...current,at:e.target.value}))} style={{height:38,border:"1px solid var(--line)",borderRadius:9,padding:"0 9px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}}/></label>
      <label style={{display:"grid",gap:4,fontSize:10,fontWeight:800}}>Canal<select value={draft.channel} onChange={e=>setDraft(current=>({...current,channel:e.target.value}))} style={{height:38,border:"1px solid var(--line)",borderRadius:9,padding:"0 9px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}}>{Object.entries(FOLLOW_CHANNEL).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <label style={{gridColumn:"1 / -1",display:"grid",gap:4,fontSize:10,fontWeight:800}}>Nota<input value={draft.note} onChange={e=>setDraft(current=>({...current,note:e.target.value}))} placeholder="Ej. confirmar si recibió la propuesta y resolver dudas" style={{height:38,border:"1px solid var(--line)",borderRadius:9,padding:"0 9px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit"}}/></label>
    </div>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:10}}>
      {quote.follow_up_status==="pending"?<button type="button" disabled={saving} onClick={finish}>Marcar hecho</button>:null}
      <button type="button" disabled={saving||!draft.at} onClick={save}>{quote.follow_up_status==="pending"?"Actualizar seguimiento":"Programar seguimiento"}</button>
    </div>
  </div>
}
