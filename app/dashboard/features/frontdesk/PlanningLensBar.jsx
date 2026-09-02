"use client"

import lens from"./planning-lenses.module.css"

const OPTIONS=[
  {id:"operation",label:"Operación",hint:"IN · OUT · pendientes"},
  {id:"revenue",label:"Revenue",hint:"ocupación · tarifa"},
  {id:"housekeeping",label:"Housekeeping",hint:"estado · recambios"},
]

export default function PlanningLensBar({mode="operation",onModeChange,focusOnly=false,onFocusChange,stats={},moveModeGuest="",onCancelMove}){
  return <section className={lens.bar} aria-label="Lentes inteligentes del Planning">
    <div className={lens.brand}>
      <span className={lens.orbit}><i/><i/><i/></span>
      <div><small>HL LENSES</small><b>Un Planning, tres formas de leer el hotel.</b><p>La información cambia según lo que necesitás resolver.</p></div>
    </div>
    <div className={lens.modes} role="group" aria-label="Elegir lente">
      {OPTIONS.map(option=><button key={option.id} className={mode===option.id?lens.active:""} data-mode={option.id} onClick={()=>onModeChange?.(option.id)}><span>{option.label}</span><small>{option.hint}</small></button>)}
    </div>
    <div className={lens.signalStrip}>
      <span><small>IN HOY</small><b>{stats.arrivals||0}</b></span>
      <span><small>OUT HOY</small><b>{stats.departures||0}</b></span>
      <span><small>ATENCIÓN</small><b>{stats.attention||0}</b></span>
      <span><small>DEUDA</small><b>{stats.debt||0}</b></span>
      <button className={focusOnly?lens.focusActive:lens.focus} onClick={()=>onFocusChange?.(!focusOnly)}><i/> {focusOnly?`Focus · ${stats.attention||0}`:"Focus mode"}</button>
    </div>
    {moveModeGuest&&<div className={lens.moveMode}><span><i/>MODO MOVER</span><b>{moveModeGuest}</b><small>Tocá una habitación y fecha de destino. Funciona también en móvil.</small><button onClick={onCancelMove}>Cancelar</button></div>}
  </section>
}
