"use client"

import{money,shortDate}from"../../core/formatters"
import sheet from"./stay-transition-sheet.module.css"

const roomState=value=>{const state=String(value||"disponible").toLowerCase();if(state==="sucia")return{label:"Sucia",tone:"warn",detail:"Conviene terminar Housekeeping antes de entregar la habitación."};if(["limpieza","en_limpieza","inspeccion"].includes(state))return{label:"En proceso",tone:"warn",detail:"La habitación todavía está en preparación."};if(state==="mantenimiento")return{label:"Mantenimiento",tone:"danger",detail:"La habitación figura en mantenimiento."};if(state==="fuera_servicio")return{label:"Fuera de servicio",tone:"danger",detail:"La habitación figura fuera de servicio."};if(["limpia","inspeccionada"].includes(state))return{label:"Lista",tone:"ok",detail:"Habitación preparada para recibir al huésped."};return{label:"Disponible",tone:"ok",detail:"No hay una alerta operativa en la habitación."}}
const documentReady=(draft,documents,pending)=>!!String(draft?.document||"").trim()||documents.some(item=>["primary","guest"].includes(String(item?.holder_role||item?.holderRole||"")))||pending.some(item=>["primary","guest"].includes(String(item?.holderRole||"")))

function Check({label,value,detail,tone="ok",action}){
  return <article className={sheet.check} data-tone={tone}><span className={sheet.checkIcon}>{tone==="ok"?"✓":tone==="danger"?"!":"·"}</span><div><small>{label}</small><b>{value}</b><p>{detail}</p></div>{action}</article>
}

export default function StayTransitionSheet({mode,draft,original,room,total=0,paid=0,balance=0,documents=[],pending=[],busy=false,onClose,onConfirm,onTab,onKey,onWebCheckin}){
  if(!mode)return null
  const checkin=mode==="checkin",state=roomState(room?.estado),docsReady=documentReady(draft,documents,pending),canCheckout=balance<=.01,confirmDisabled=busy||(!checkin&&!canCheckout)||original?.estado==="finalizada"||original?.estado==="cancelada",title=checkin?"Confirmar Check-in":"Preparar Check-out",kicker=checkin?"LLEGADA · CONTROL OPERATIVO":"SALIDA · CIERRE DE ESTADÍA"
  const confirm=()=>{if(!confirmDisabled)onConfirm?.()}
  return <div className={sheet.shade} role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}><section className={sheet.sheet} role="dialog" aria-modal="true" aria-label={title}>
    <header className={sheet.head}><div><small>{kicker}</small><h2>{title}</h2><p>{draft?.guest||"Huésped"} · {room?.nombre||"Sin habitación"}</p></div><button type="button" className={sheet.close} onClick={onClose} aria-label="Cerrar">×</button></header>
    <div className={sheet.hero}><div><small>{original?.numero_reserva||`Reserva ${original?.id||""}`}</small><b>{draft?.guest||"Huésped"}</b><span>{shortDate(draft?.start)} {draft?.arrivalTime||""} → {shortDate(draft?.end)} {draft?.departureTime||""}</span></div><div className={sheet.heroRoom}><small>HABITACIÓN</small><b>{room?.nombre||"—"}</b><span data-tone={state.tone}>{state.label}</span></div></div>
    <main className={sheet.body}>
      {checkin?<>
        <Check label="HABITACIÓN" value={`${room?.nombre||"Sin asignar"} · ${state.label}`} detail={state.detail} tone={state.tone}/>
        <Check label="DOCUMENTACIÓN" value={docsReady?"Identificación cargada":"Documento pendiente"} detail={docsReady?"Hay identificación vinculada a la reserva.":"Podés continuar, pero conviene completar DNI o pasaporte antes del ingreso."} tone={docsReady?"ok":"warn"} action={<button type="button" onClick={()=>onTab?.("guest")}>Revisar</button>}/>
        <Check label="CUENTA" value={balance>.01?`${money(balance,draft?.currency)} pendiente`:"Sin deuda para la llegada"} detail={`${money(paid,draft?.currency)} pagado sobre ${money(total,draft?.currency)}.`} tone={balance>.01?"warn":"ok"} action={<button type="button" onClick={()=>onTab?.("money")}>Pagos</button>}/>
        <div className={sheet.tools}><button type="button" onClick={onWebCheckin}>Web Check-in</button><button type="button" onClick={onKey}>Preparar llave</button><button type="button" onClick={()=>onTab?.("stay")}>Ver estadía</button></div>
      </>:<>
        <Check label="CUENTA FINAL" value={canCheckout?"Saldo cubierto":`${money(balance,draft?.currency)} pendiente`} detail={canCheckout?`${money(paid,draft?.currency)} pagado. El servidor volverá a validar la cuenta al confirmar.`:"El Check-out permanece bloqueado hasta cubrir el saldo."} tone={canCheckout?"ok":"danger"} action={<button type="button" onClick={()=>onTab?.("money")}>Abrir pagos</button>}/>
        <Check label="HABITACIÓN" value={room?.nombre||"Sin asignar"} detail="Al completar la salida, la operación existente envía la habitación al circuito de Housekeeping." tone="ok"/>
        <Check label="GARANTÍAS" value="Validación al confirmar" detail="El cierre vuelve a comprobar garantías activas y no se completa si queda una pendiente de resolver." tone="ok"/>
        <div className={sheet.closing}><span>Cuenta total <b>{money(total,draft?.currency)}</b></span><span>Pagado <b>{money(paid,draft?.currency)}</b></span><span>Pendiente <b data-due={balance>.01}>{money(balance,draft?.currency)}</b></span></div>
      </>}
    </main>
    <footer className={sheet.footer}><button type="button" className={sheet.secondary} onClick={onClose}>Volver</button><button type="button" className={checkin?sheet.checkin:sheet.checkout} disabled={confirmDisabled} onClick={confirm}>{busy?"Procesando…":checkin?"Confirmar Check-in":"Confirmar Check-out"}</button></footer>
  </section></div>
}
