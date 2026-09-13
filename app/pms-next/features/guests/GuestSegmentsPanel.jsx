"use client"

import{CRM_SEGMENTS,segmentCounts}from"./guestCrm"
import s from"./guests.module.css"

export default function GuestSegmentsPanel({guests=[],activeSegment,onSegment}){
  const counts=segmentCounts(guests)
  return <section className={s.crmPanel}>
    <div className={s.crmHead}><div><small>SEGMENTOS EN VIVO</small><h2>CRM accionable</h2><p>Los grupos se calculan con estadías y perfiles reales. Elegí uno para filtrar el directorio; todavía no envía campañas automáticamente.</p></div>{activeSegment?<button type="button" onClick={()=>onSegment?.("")}>Ver todos</button>:null}</div>
    <div className={s.segmentGrid}>{CRM_SEGMENTS.map(item=><button type="button" key={item.id} className={`${s.segmentCard} ${activeSegment===item.id?s.segmentActive:""}`} onClick={()=>onSegment?.(activeSegment===item.id?"":item.id)}><span>{item.label}</span><b>{counts[item.id]||0}</b><small>{item.description}</small></button>)}</div>
  </section>
}
