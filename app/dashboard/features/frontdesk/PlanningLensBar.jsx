"use client"

import lens from"./planning-lenses.module.css"

const OPTIONS=[
  {id:"operation",label:"Operación",hint:"IN · OUT · pendientes"},
  {id:"revenue",label:"Revenue",hint:"ocupación · tarifa"},
  {id:"housekeeping",label:"Housekeeping",hint:"estado · recambios"},
]

export default function PlanningLensBar({mode="operation",onModeChange,focusOnly=false,onFocusChange,stats={},moveModeGuest="",onCancelMove}){
  return <section className={lens.bar} aria-label="Lentes inteligentes del Planning">
    <div className={lens.brand}><span className={lens.orbit}/><small>VISTA</small></div>
    <div className={lens.modes} role="group" aria-label="Elegir lente">{OPTIONS.map(option=><button title={option.hint} key={option.id} className={mode===option.id?lens.active:""} data-mode={option.id} onClick={()=>onModeChange?.(option.id)}>{option.label}</button>)}</div>
    <div className={lens.signalStrip}><span title="Check-ins de hoy">IN <b>{stats.arrivals||0}</b></span><span title="Check-outs de hoy">OUT <b>{stats.departures||0}</b></span><span title="Habitaciones o reservas que requieren atención">Atención <b>{stats.attention||0}</b></span><span title="Reservas con deuda operativa">Deuda <b>{stats.debt||0}</b></span><button className={focusOnly?lens.focusActive:lens.focus} onClick={()=>onFocusChange?.(!focusOnly)}><i/> {focusOnly?`Focus ${stats.attention||0}`:"Focus"}</button></div>
    {moveModeGuest&&<div className={lens.moveMode}><span><i/> Mover</span><b>{moveModeGuest}</b><small>Tocá habitación y fecha de destino.</small><button onClick={onCancelMove}>Cancelar</button></div>}
  </section>
}
