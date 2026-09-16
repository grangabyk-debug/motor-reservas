"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import DailyCashActionsMultiCurrency from"./DailyCashActionsMultiCurrency"
import{parseCashSessionMeta}from"./cashSessionMeta"
import s from"./dailyCashToolbar.module.css"

const fmtTime=value=>{
  if(!value)return""
  try{return new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(new Date(value))}
  catch{return""}
}

export default function DailyCashActions(props){
  const{session}=props
  const legacyRef=useRef(null)
  const menuRef=useRef(null)
  const[moreOpen,setMoreOpen]=useState(false)
  const sessionMeta=useMemo(()=>parseCashSessionMeta(session?.notes),[session?.notes])
  const openedAt=fmtTime(session?.opened_at)

  useEffect(()=>{
    if(!moreOpen)return
    const closeOnOutside=event=>{if(!menuRef.current?.contains(event.target))setMoreOpen(false)}
    const closeOnEscape=event=>{if(event.key==="Escape")setMoreOpen(false)}
    document.addEventListener("pointerdown",closeOnOutside)
    document.addEventListener("keydown",closeOnEscape)
    return()=>{
      document.removeEventListener("pointerdown",closeOnOutside)
      document.removeEventListener("keydown",closeOnEscape)
    }
  },[moreOpen])

  function triggerAction(label){
    const toolbar=legacyRef.current?.firstElementChild
    if(!toolbar)return
    const target=[...toolbar.querySelectorAll("button")].find(button=>String(button.textContent||"").toLowerCase().includes(label.toLowerCase()))
    target?.click()
  }

  function runMore(label){
    setMoreOpen(false)
    triggerAction(label)
  }

  return<>
    <div className={s.toolbar}>
      <div className={s.mainActions}>
        <button type="button" className={s.action} onClick={()=>triggerAction("Cobrar reserva")}>
          <span className={s.plus} aria-hidden="true">+</span> Cobrar reserva
        </button>
        {session?<button type="button" className={s.action} onClick={()=>triggerAction("Movimiento")}>
          <span className={s.plus} aria-hidden="true">+</span> Movimiento
        </button>:null}
        <div className={s.moreWrap} ref={menuRef}>
          <button type="button" className={`${s.action} ${s.moreButton}`} aria-haspopup="menu" aria-expanded={moreOpen} onClick={()=>setMoreOpen(value=>!value)}>
            Más <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 7.5 4.5 4.5 4.5-4.5"/></svg>
          </button>
          {moreOpen?<div className={s.menu} role="menu">
            {session?<button type="button" role="menuitem" onClick={()=>runMore("Libro de novedades")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4.75h9.25A2.75 2.75 0 0 1 18 7.5v11.75H8.75A2.75 2.75 0 0 1 6 16.5V4.75Zm0 11.75A2.75 2.75 0 0 1 8.75 13.75H18M9.25 8h5.5"/></svg>
              <span><b>Libro de novedades</b><small>Pase y pendientes del turno</small></span>
            </button>:null}
            <button type="button" role="menuitem" onClick={()=>runMore("Cierres")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.25v5l3.25 1.75M20 12a8 8 0 1 1-2.34-5.66M20 4.5v4h-4"/></svg>
              <span><b>Historial de cierres</b><small>Consultar arqueos anteriores</small></span>
            </button>
          </div>:null}
        </div>
      </div>

      <div className={`${s.sessionBlock} ${session?s.sessionOpen:s.sessionClosed}`}>
        <div className={s.status}>
          <span className={s.statusDot} aria-hidden="true"/>
          <span className={s.statusCopy}>
            <b>{session?"Caja abierta":"Caja cerrada"}</b>
            <small>{session?`${sessionMeta.openerName||"Turno activo"}${openedAt?` · desde ${openedAt}`:""}`:"Sin turno abierto"}</small>
          </span>
        </div>
        <button type="button" className={session?s.closeCash:s.openCash} onClick={()=>triggerAction(session?"Arqueo / cerrar caja":"Abrir caja")}>
          {session?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2M6 10.5h12v9H6zM12 14v2.5"/></svg>:<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V8a4 4 0 0 1 7.72-1.48M6 10.5h12v9H6zM12 14v2.5"/></svg>}
          {session?"Cerrar caja":"Abrir caja"}
        </button>
      </div>
    </div>

    <div className={s.legacyHost} ref={legacyRef} aria-hidden="true">
      <DailyCashActionsMultiCurrency {...props}/>
    </div>
  </>
}
