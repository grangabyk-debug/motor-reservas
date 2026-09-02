"use client"

import lens from"./planning-lenses.module.css"

const OPTIONS=[
  {id:"operation",label:"Operación"},
  {id:"revenue",label:"Revenue"},
  {id:"housekeeping",label:"Housekeeping"},
]

export default function PlanningLensBar({mode="operation",onModeChange,focusOnly=false,onFocusChange,stats={},moveModeGuest="",onCancelMove}){
  return <section className={lens.bar} aria-label="Lentes inteligentes del Planning">
    <div className={lens.modes} role="group" aria-label="Elegir lente">
      {OPTIONS.map(option=><button key={option.id} className={mode===option.id?lens.active:""} data-mode={option.id} onClick={()=>onModeChange?.(option.id)}>{option.label}</button>)}
    </div>
    <div className={lens.signalStrip} aria-label="Señales de hoy">
      <span><small>IN</small><b>{stats.arrivals||0}</b></span>
      <span><small>OUT</small><b>{stats.departures||0}</b></span>
      <span data-alert={Number(stats.attention||0)>0?"true":"false"}><small>Atención</small><b>{stats.attention||0}</b></span>
      <span data-alert={Number(stats.debt||0)>0?"true":"false"}><small>Deuda</small><b>{stats.debt||0}</b></span>
      <button className={focusOnly?lens.focusActive:lens.focus} onClick={()=>onFocusChange?.(!focusOnly)}>{focusOnly?`Focus ${stats.attention||0}`:"Focus"}</button>
    </div>
    {moveModeGuest&&<div className={lens.moveMode}><span>Mover</span><b>{moveModeGuest}</b><small>Tocá destino</small><button onClick={onCancelMove}>Cancelar</button></div>}
  </section>
}
