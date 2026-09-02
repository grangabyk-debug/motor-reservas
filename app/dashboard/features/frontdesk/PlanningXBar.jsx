"use client"

import px from"./planning-x.module.css"

const LENSES=[
  {id:"operation",icon:"◉",label:"Operación",caption:"Reservas, estados y canales"},
  {id:"revenue",icon:"↗",label:"Revenue",caption:"Tarifa, ocupación y saldo"},
  {id:"housekeeping",icon:"✦",label:"Housekeeping",caption:"Limpieza y recambios"},
]

export default function PlanningXBar({lens,onLens,focus,onFocus,heatmap,onHeatmap,attentionCount=0,visibleCount=0}){
  return <section className={px.bar}>
    <div className={px.brand}><span className={px.orbit}><i/></span><div><small>HL PLANNING X</small><b>Lentes inteligentes</b><p>La misma grilla cambia de lectura según lo que necesitás resolver.</p></div></div>
    <div className={px.lenses}>{LENSES.map(item=><button key={item.id} type="button" aria-pressed={lens===item.id} className={lens===item.id?px.activeLens:""} onClick={()=>onLens(item.id)}><span>{item.icon}</span><div><b>{item.label}</b><small>{item.caption}</small></div></button>)}</div>
    <div className={px.actions}>
      <button type="button" aria-pressed={focus} className={focus?px.focusActive:""} onClick={()=>onFocus(!focus)}><span className={px.focusDot}/><div><b>Focus</b><small>{focus?`${visibleCount} visibles`:`${attentionCount} requieren atención`}</small></div></button>
      <button type="button" aria-pressed={heatmap} className={heatmap?px.heatActive:""} onClick={()=>onHeatmap(!heatmap)}><span className={px.heatIcon}>≋</span><div><b>Heatmap</b><small>{heatmap?"presión visible":"sin capa térmica"}</small></div></button>
    </div>
  </section>
}
