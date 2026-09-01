"use client"

import{useEffect,useMemo,useState}from"react"
import{money}from"../../core/formatters"
import{reservationTotal}from"./reservationModel"
import{emailUrl,loadMessageTemplates,logReservationMessage,renderMessageTemplate,saveMessageTemplate,templateContext,whatsappUrl}from"../../services/communications"
import s from"./reservation-action-dock.module.css"

const readyStates=new Set(["inspeccionada","inspeccionado","disponible","libre"])
const hardBlockedStates=new Set(["mantenimiento","fuera_servicio","fuera de servicio","fuera_de_servicio"])
const roomStateLabel=value=>{const raw=String(value||"libre").toLowerCase();if(raw==="inspeccionada"||raw==="inspeccionado")return"Inspeccionada";if(raw==="limpia")return"Limpia";if(raw==="limpieza"||raw==="en_limpieza")return"En limpieza";if(raw==="sucia")return"Sucia";if(raw.includes("mantenimiento"))return"Mantenimiento";if(raw.includes("fuera"))return"Fuera de servicio";return raw?raw.replaceAll("_"," "):"Sin estado"}
const firstName=value=>String(value||"").trim().split(/\s+/)[0]||"Huésped"

export default function ReservationActionDock({draft,original,rooms=[],payments=[],propertyId,userId,hotelName,onCheckin,onCheckout,onWebCheckin,onEmail,onKey,onPrint,onRoomStatus,onHousekeepingTask,onNotify}){
  const[open,setOpen]=useState(false),[templates,setTemplates]=useState([]),[templateId,setTemplateId]=useState(""),[busy,setBusy]=useState(""),[message,setMessage]=useState(""),[guard,setGuard]=useState(false),[editing,setEditing]=useState(false),[editDraft,setEditDraft]=useState(null)
  const room=rooms.find(r=>String(r.id)===String(draft?.roomId||original?.habitacion_id)),totals=useMemo(()=>reservationTotal(draft||{},room),[draft,room]),paid=payments.filter(p=>String(p.reserva_id)===String(original?.id)).reduce((sum,p)=>sum+Number(p.monto||0),0),balance=Math.max(0,Number(totals.total||original?.precio_total||0)-paid),roomState=String(room?.estado||"libre").toLowerCase(),roomReady=readyStates.has(roomState),hardBlocked=hardBlockedStates.has(roomState),selected=templates.find(t=>String(t.id)===String(templateId))||templates[0]||null

  useEffect(()=>{let active=true;if(!propertyId||!original?.id)return;loadMessageTemplates({propertyId,userId}).then(rows=>{if(!active)return;setTemplates(rows);setTemplateId(current=>current||rows?.[0]?.id||"")}).catch(error=>active&&setMessage(error.message||"No se pudieron cargar las plantillas."));return()=>{active=false}},[propertyId,original?.id,userId])
  useEffect(()=>{setGuard(false);setMessage("");setEditing(false);setOpen(false)},[original?.id])
  if(!draft?.id||!original)return null

  const notify=text=>{setMessage(text);onNotify?.(text)}
  async function run(key,fn){if(busy)return;setBusy(key);setMessage("");try{return await fn()}catch(error){notify(error?.message||"No se pudo completar la acción.")}finally{setBusy("")}}
  async function doCheckin(force=false){if(!room)return notify("La reserva todavía no tiene una habitación asignada.");if(hardBlocked)return notify(`No se puede hacer check-in: ${room.nombre} está ${roomStateLabel(roomState).toLowerCase()}.`);if(!roomReady&&!force){setGuard(true);return}setGuard(false);await run("checkin",()=>onCheckin?.())}
  async function changeRoomState(status){if(!room)return;await run(`room-${status}`,async()=>{await onRoomStatus?.(room,status);notify(`Habitación ${room.nombre}: ${roomStateLabel(status)}.`)})}
  async function createCleaning(){if(!room)return;await run("cleaning",async()=>{await onHousekeepingTask?.({room_id:room.id,reservation_id:original.id,task_type:"cleaning",priority:"high",status:"pending",scheduled_for:new Date().toISOString(),notes:`Creada desde la reserva ${original.numero_reserva||original.id} · ${draft.guest||original.nombre_huesped}`});notify("Limpieza enviada a Housekeeping.")})}
  function rawWhatsApp(){const url=whatsappUrl(draft.phone||original.telefono_huesped);if(!url)return notify("Falta el teléfono del huésped.");window.open(url,"_blank","noopener,noreferrer")}
  function callGuest(){const phone=String(draft.phone||original.telefono_huesped||"").trim();if(!phone)return notify("Falta el teléfono del huésped.");window.location.href=`tel:${phone}`}

  async function openTemplate(channel="whatsapp"){
    if(!selected)return notify("Elegí una plantilla.")
    const popup=channel==="whatsapp"?window.open("about:blank","_blank"):null
    await run(`template-${channel}`,async()=>{
      let webCheckinUrl=""
      if(selected.code==="pre_checkin")webCheckinUrl=await onWebCheckin?.({copy:false})||""
      const context=templateContext({draft,original,room,hotelName,balance,webCheckinUrl}),rendered=renderMessageTemplate(selected,context),recipient=channel==="whatsapp"?(draft.phone||original.telefono_huesped):(draft.email||original.email_huesped)
      if(!recipient){popup?.close();throw new Error(channel==="whatsapp"?"Falta el teléfono del huésped.":"Falta el email del huésped.")}
      await logReservationMessage({propertyId,userId,reservationId:original.id,templateId:selected.id,channel,status:"opened",recipient,subject:rendered.subject,body:rendered.body,metadata:{template_code:selected.code}})
      const url=channel==="whatsapp"?whatsappUrl(recipient,rendered.body):emailUrl(recipient,rendered.subject||`${hotelName||"Hotel"} · Reserva ${original.numero_reserva||original.id}`,rendered.body)
      if(channel==="whatsapp"){if(popup)popup.location.href=url;else window.open(url,"_blank","noopener,noreferrer")}else window.location.href=url
      notify(`${selected.name} preparado para ${firstName(draft.guest)}.`)
    })
  }

  function startEdit(){if(!selected)return;setEditDraft({...selected});setEditing(true)}
  async function saveEdit(){if(!editDraft)return;await run("save-template",async()=>{await saveMessageTemplate({propertyId,userId,draft:editDraft});const rows=await loadMessageTemplates({propertyId,userId});setTemplates(rows);setTemplateId(editDraft.id||rows.find(x=>x.code===editDraft.code)?.id||rows[0]?.id||"");setEditing(false);notify("Plantilla actualizada.")})}

  return <div className={s.root}>
    <button type="button" className={s.launcher} onClick={()=>setOpen(v=>!v)} aria-expanded={open}><span>⚡</span><b>Acciones de reserva</b><em>{balance>.01?`${money(balance,draft.currency)} pend.`:roomStateLabel(roomState)}</em></button>
    {open&&<aside className={s.panel}>
      <header className={s.head}><div><small>RESERVA EN VIVO</small><h3>{draft.guest||original.nombre_huesped}</h3><p>{room?.nombre||"Sin habitación"} · {original.numero_reserva||original.id}</p></div><button type="button" onClick={()=>setOpen(false)}>×</button></header>

      <section className={s.section}><div className={s.sectionHead}><span><small>OPERACIÓN</small><b>Entrada, salida y estado real</b></span><i data-ready={roomReady&&!hardBlocked}>{roomStateLabel(roomState)}</i></div>
        <div className={s.primaryGrid}><button type="button" className={s.primary} disabled={busy==="checkin"||original.estado==="alojado"||original.estado==="finalizada"} onClick={()=>doCheckin(false)}>{busy==="checkin"?"Procesando…":"Check-in"}</button><button type="button" disabled={busy==="checkout"||original.estado!=="alojado"||balance>.01} title={balance>.01?`Saldo pendiente ${money(balance,draft.currency)}`:""} onClick={()=>run("checkout",()=>onCheckout?.())}>Check-out</button></div>
        {guard&&<div className={s.guard}><b>La habitación todavía no figura inspeccionada.</b><p>Estado actual: {roomStateLabel(roomState)}. Recepción puede continuar bajo confirmación o enviar la habitación a Housekeeping.</p><div><button type="button" onClick={()=>setGuard(false)}>Cancelar</button><button type="button" className={s.warning} onClick={()=>doCheckin(true)}>Hacer check-in igual</button></div></div>}
        {hardBlocked&&<div className={s.blocked}>El check-in está bloqueado mientras la habitación figure {roomStateLabel(roomState).toLowerCase()}.</div>}
      </section>

      <section className={s.section}><div className={s.sectionHead}><span><small>CONTACTO</small><b>WhatsApp con plantillas</b></span><button type="button" className={s.link} onClick={rawWhatsApp}>Abrir chat</button></div>
        <select className={s.select} value={templateId} onChange={e=>{setTemplateId(e.target.value);setEditing(false)}}>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
        {selected&&<div className={s.templatePreview}>{renderMessageTemplate(selected,templateContext({draft,original,room,hotelName,balance,webCheckinUrl:selected.code==="pre_checkin"?"[se genera al enviar]":""})).body}</div>}
        <div className={s.messageActions}><button type="button" className={s.whatsapp} disabled={!draft.phone||busy.startsWith("template-")} onClick={()=>openTemplate("whatsapp")}>WhatsApp</button><button type="button" disabled={!draft.email||busy.startsWith("template-")} onClick={()=>openTemplate("email")}>Email</button><button type="button" onClick={startEdit}>Editar plantilla</button></div>
        {editing&&editDraft&&<div className={s.editor}><input value={editDraft.name||""} onChange={e=>setEditDraft(x=>({...x,name:e.target.value}))}/><textarea value={editDraft.body||""} onChange={e=>setEditDraft(x=>({...x,body:e.target.value}))}/><small>Variables: {'{{guest_first}}'}, {'{{hotel}}'}, {'{{reservation}}'}, {'{{room}}'}, {'{{arrival_date}}'}, {'{{departure_date}}'}, {'{{balance}}'}, {'{{web_checkin_url}}'}.</small><div><button type="button" onClick={()=>setEditing(false)}>Cancelar</button><button type="button" className={s.primary} disabled={busy==="save-template"} onClick={saveEdit}>Guardar</button></div></div>}
      </section>

      <section className={s.section}><div className={s.sectionHead}><span><small>HOUSEKEEPING</small><b>{room?.nombre||"Habitación"}</b></span><button type="button" className={s.link} onClick={createCleaning}>＋ Tarea</button></div><div className={s.stateGrid}><button type="button" onClick={()=>changeRoomState("sucia")}>Sucia</button><button type="button" onClick={()=>changeRoomState("limpieza")}>En limpieza</button><button type="button" onClick={()=>changeRoomState("limpia")}>Limpia</button><button type="button" className={s.inspected} onClick={()=>changeRoomState("inspeccionada")}>Inspeccionada</button></div></section>

      <section className={s.utilities}><button type="button" onClick={callGuest}>Llamar</button><button type="button" onClick={()=>onWebCheckin?.()}>Web Check-in</button><button type="button" onClick={()=>onKey?.()}>Llave</button><button type="button" disabled={!draft.email} onClick={()=>onEmail?.()}>Email directo</button><button type="button" onClick={()=>onPrint?.()}>Imprimir</button></section>
      {message&&<div className={s.message}>{message}</div>}
    </aside>}
  </div>
}
