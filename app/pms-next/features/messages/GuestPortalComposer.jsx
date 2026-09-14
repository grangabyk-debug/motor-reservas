"use client"

import{useState}from"react"
import{supabase}from"../../../../lib/supabase"

export default function GuestPortalComposer({propertyId,conversationId,onSent}){
  const[text,setText]=useState(""),[sending,setSending]=useState(false),[status,setStatus]=useState("")
  async function submit(event){event.preventDefault();const value=text.trim();if(!value||sending)return;setSending(true);setStatus("");try{const{data,error}=await supabase.rpc("hl_guest_portal_reply",{p_property_id:propertyId,p_conversation_id:conversationId,p_text:value});if(error||!data?.ok)throw error||new Error(data?.error||"No se pudo enviar");setText("");setStatus("Enviado al portal del huésped");await onSent?.()}catch(err){setStatus(err?.message||"No se pudo enviar el mensaje.")}finally{setSending(false)}}
  const disabled=sending||!text.trim()
  return <form onSubmit={submit} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,padding:10,borderTop:"1px solid var(--line)",background:"var(--panelSolid)"}}><textarea value={text} onChange={event=>setText(event.target.value)} maxLength={2000} rows={2} placeholder="Responder al huésped…" style={{resize:"none",border:"1px solid var(--line)",borderRadius:12,padding:"9px 10px",font:"inherit",fontSize:10.5,background:"var(--surface)",color:"var(--text)",outline:"none"}}/><button type="submit" disabled={disabled} style={{border:0,borderRadius:11,padding:"0 14px",background:"var(--accent)",color:"#fff",fontWeight:800,fontSize:10.5,cursor:"pointer",opacity:disabled?0.55:1}}>{sending?"Enviando…":"Enviar"}</button>{status?<small style={{gridColumn:"1 / -1",color:status.startsWith("Enviado")?"#2f7b50":"#b64a52"}}>{status}</small>:null}</form>
}
