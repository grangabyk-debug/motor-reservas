"use client"

import{CRM_SEGMENTS,segmentCounts}from"./guestCrm"
import c from"./guestCrmCompact.module.css"

export default function GuestSegmentsPanel({guests=[],activeSegment,onSegment}){
  const counts=segmentCounts(guests)
  return <section className={c.segmentBar}>
    <div className={c.segmentHead}><div><small>SEGMENTOS</small><b>Filtrar huéspedes</b></div>{activeSegment?<button type="button" onClick={()=>onSegment?.("")}>Ver todos</button>:null}</div>
    <div className={c.segmentList}>{CRM_SEGMENTS.map(item=><button type="button" key={item.id} className={activeSegment===item.id?c.active:""} onClick={()=>onSegment?.(activeSegment===item.id?"":item.id)}><span>{item.label}</span><b>{counts[item.id]||0}</b></button>)}</div>
  </section>
}
