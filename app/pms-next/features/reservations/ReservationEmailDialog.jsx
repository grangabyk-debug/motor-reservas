"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmt=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${String(value).slice(0,10)}T12:00:00`)):"—"
const roomNames=rooms=>(rooms||[]).map(room=>room?.nombre).filter(Boolean).join(", ")||"Sin asignar"

const TEMPLATES=[
  ["preconfirmation","Pre-confirmación de reserva"],
  ["confirmation","Confirmación de reserva"],
  ["cancellation","Cancelación de reserva"],
  ["availability","Disponibilidad"],
  ["budget","Presupuesto"],
  ["payment","Confirmación de pago"],
]

function buildTemplate(key,context){
  const{hotel,guest,reservation,arrival,departure,rooms,pax,total}=context
  const details=`Reserva: ${reservation}\nEntrada: ${arrival}\nSalida: ${departure}\nHabitación: ${rooms}\nPasajeros: ${pax}\nTotal de la reserva: ${total}`
  if(key==="preconfirmation")return{
    subject:`${hotel} · Pre-confirmación de reserva ${reservation}`,
    text:`Hola ${guest},\n\nRecibimos tu solicitud de reserva en ${hotel}. Te compartimos los datos registrados para que puedas revisarlos:\n\n${details}\n\nLa reserva queda pendiente de confirmación final. Si necesitás corregir algún dato, respondé este correo.\n\nSaludos,\n${hotel}`,
  }
  if(key==="cancellation")return{
    subject:`${hotel} · Cancelación de reserva ${reservation}`,
    text:`Hola ${guest},\n\nTe informamos que la reserva ${reservation} en ${hotel} fue cancelada.\n\nEntrada: ${arrival}\nSalida: ${departure}\nHabitación: ${rooms}\n\nSi necesitás volver a reservar o tenés alguna consulta, respondé este correo.\n\nSaludos,\n${hotel}`,
  }
  if(key==="availability")return{
    subject:`${hotel} · Disponibilidad para tu estadía`,
    text:`Hola ${guest},\n\nTe compartimos la disponibilidad registrada para las fechas consultadas en ${hotel}:\n\nEntrada: ${arrival}\nSalida: ${departure}\nHabitación / categoría: ${rooms}\nPasajeros: ${pax}\n\nPodemos ajustar esta propuesta antes de confirmar la reserva.\n\nSaludos,\n${hotel}`,
  }
  if(key==="budget")return{
    subject:`${hotel} · Presupuesto de estadía`,
    text:`Hola ${guest},\n\nTe enviamos el presupuesto para tu estadía en ${hotel}:\n\n${details}\n\nEste mensaje funciona como presupuesto y puede editarse antes de confirmar la reserva.\n\nSaludos,\n${hotel}`,
  }
  if(key==="payment")return{
    subject:`${hotel} · Confirmación de pago · Reserva ${reservation}`,
    text:`Hola ${guest},\n\nConfirmamos la recepción del pago asociado a tu reserva ${reservation} en ${hotel}.\n\nResumen de la reserva:\n${details}\n\nSi necesitás el comprobante o tenés alguna consulta sobre el pago, respondé este correo.\n\nSaludos,\n${hotel}`,
  }
  return{
    subject:`${hotel} · Confirmación de reserva ${reservation}`,
    text:`Hola ${guest},\n\nTu reserva en ${hotel} está confirmada.\n\n${details}\n\nSi necesitás hacer algún cambio o agregar una solicitud, respondé este correo.\n\nSaludos,\n${hotel}`,
  }
}

export default function ReservationEmailDialog({item,rooms=[],propertyId,onClose,onSent}){
  const[hotel,setHotel]=useState("Habitación Llena"),[templateKey,setTemplateKey]=useState("confirmation"),[subject,setSubject]=useState(""),[text,setText]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("")
  const context=useMemo(()=>({hotel,guest:item?.nombre_huesped||"huésped",reservation:item?.numero_reserva||item?.id||"—",arrival:fmt(item?.fecha_entrada),departure:fmt(item?.fecha_salida),rooms:roomNames(rooms),pax:Number(item?.cantidad_huespedes)||1,total:money(item?.precio_total,item?.moneda)}),[hotel,item,rooms])

  useEffect(()=>{
    let active=true
    supabase.from("hotel_os_settings").select("hotel_name").eq("property_id",propertyId).maybeSingle().then(({data})=>{if(active&&data?.hotel_name)setHotel(data.hotel_name)})
    return()=>{active=false}
  },[propertyId])

  useEffect(()=>{const template=buildTemplate(templateKey,context);setSubject(template.subject);setText(template.text)},[templateKey,context])

  async function send(){
    if(busy)return
    if(!item?.email_huesped){setError("La reserva no tiene email cargado.");return}
    if(!subject.trim()||!text.trim()){setError("Completá el asunto y el mensaje antes de enviar.");return}
    setBusy(true);setError("")
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session?.access_token)throw new Error("La sesión no está disponible.")
      const response=await fetch("/api/hotel/email",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({reservation_id:item.id,subject:subject.trim(),text:text.trim()})})
      const result=await response.json().catch(()=>({}))
      if(!response.ok)throw new Error(result?.error||"No se pudo enviar el email.")
      if(result.mode==="mailto"&&result.mailto){onSent?.("Abrí tu aplicación de correo con el mensaje preparado.");window.location.href=result.mailto;return}
      onSent?.("Email enviado al huésped.")
    }catch(err){setError(err?.message||"No se pudo enviar el email.")}
    finally{setBusy(false)}
  }

  return <div style={{position:"fixed",inset:0,zIndex:290,display:"grid",placeItems:"center",padding:16,background:"rgba(12,20,38,.3)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)"}} onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}>
    <section style={{width:"min(720px,calc(100vw - 28px))",maxHeight:"90vh",overflow:"auto",padding:18,border:"1px solid color-mix(in srgb,#fff 36%,var(--line))",borderRadius:20,background:"color-mix(in srgb,var(--panelSolid) 94%,transparent)",boxShadow:"0 30px 90px rgba(20,30,55,.28)",backdropFilter:"blur(30px) saturate(1.4)",WebkitBackdropFilter:"blur(30px) saturate(1.4)"}}>
      <header style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>EMAIL AL HUÉSPED</small><h3 style={{margin:"4px 0 0",fontSize:20}}>Preparar mensaje</h3><p style={{margin:"5px 0 0",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}>Elegí una plantilla, ajustá lo que necesites y enviá desde la ficha de la reserva.</p></div><button type="button" onClick={onClose} style={{width:36,height:36,border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",fontSize:18,cursor:"pointer"}}>×</button></header>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
        <label style={{display:"grid",gap:5,fontSize:10.5,fontWeight:800}}>Plantilla<select value={templateKey} onChange={event=>setTemplateKey(event.target.value)} style={{height:40,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",padding:"0 10px"}}>{TEMPLATES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
        <label style={{display:"grid",gap:5,fontSize:10.5,fontWeight:800}}>Para<input readOnly value={item?.email_huesped||"Sin email cargado"} style={{height:40,border:"1px solid var(--line)",borderRadius:10,background:"color-mix(in srgb,var(--bg) 35%,var(--panelSolid))",color:item?.email_huesped?"var(--text)":"var(--red)",font:"inherit",padding:"0 10px"}}/></label>
      </div>
      <label style={{display:"grid",gap:5,marginTop:10,fontSize:10.5,fontWeight:800}}>Asunto<input value={subject} onChange={event=>setSubject(event.target.value)} maxLength={200} style={{height:40,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",padding:"0 10px",outline:"none"}}/></label>
      <label style={{display:"grid",gap:5,marginTop:10,fontSize:10.5,fontWeight:800}}>Mensaje<textarea value={text} onChange={event=>setText(event.target.value)} rows={15} maxLength={20000} style={{width:"100%",minHeight:280,resize:"vertical",border:"1px solid var(--line)",borderRadius:12,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,lineHeight:1.5,padding:12,outline:"none"}}/></label>
      {error?<div role="alert" style={{marginTop:10,padding:"9px 10px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--red) 7%,var(--panelSolid))",color:"var(--red)",fontSize:10.5,fontWeight:800}}>{error}</div>:null}
      <footer style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14,paddingTop:12,borderTop:"1px solid var(--line)"}}><button type="button" onClick={onClose} style={{height:38,padding:"0 14px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:"pointer"}}>Cancelar</button><button type="button" disabled={busy||!item?.email_huesped} onClick={send} style={{height:38,padding:"0 16px",border:0,borderRadius:10,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontSize:10.5,fontWeight:900,cursor:busy?"wait":"pointer",opacity:busy||!item?.email_huesped?.65:1}}>{busy?"Enviando…":"Enviar email"}</button></footer>
    </section>
  </div>
}
