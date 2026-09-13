"use client"

import{useState}from"react"
import{CRM_SEGMENTS,segmentCounts}from"./guestCrm"
import c from"./guestCrmCompact.module.css"

export default function GuestSegmentsPanel({guests=[],activeSegment,onSegment,initialExpanded=false}){
  const[expanded,setExpanded]=useState(initialExpanded)
  const counts=segmentCounts(guests),quick=CRM_SEGMENTS.filter(item=>item.quick),advanced=CRM_SEGMENTS.filter(item=>!item.quick)
  return <section className={c.segmentBar}>
    <div className={c.segmentHead}><div><small>SEGMENTOS</small><b>Filtrar huéspedes</b></div><div className={c.segmentActions}>{activeSegment?<button type="button" onClick={()=>onSegment?.("")}>Ver todos</button>:null}<button type="button" className={expanded?c.activeToggle:""} aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{expanded?"Ocultar reglas":"Ver reglas"}</button></div></div>
    <div className={c.segmentList}>{quick.map(item=><button type="button" key={item.id} className={activeSegment===item.id?c.active:""} title={item.description} onClick={()=>onSegment?.(activeSegment===item.id?"":item.id)}><span>{item.label}</span><b>{counts[item.id]||0}</b></button>)}</div>
    {expanded?<div className={c.segmentMore}><div className={c.segmentMoreHead}><b>Reglas dinámicas</b><span>Se recalculan con estadías, canales y consentimiento real.</span></div><div className={c.ruleGrid}>{advanced.map(item=><button type="button" key={item.id} className={`${c.ruleButton} ${activeSegment===item.id?c.active:""}`} onClick={()=>onSegment?.(activeSegment===item.id?"":item.id)}><span><b>{item.label}</b><small>{item.description}</small></span><strong>{counts[item.id]||0}</strong></button>)}</div></div>:null}
  </section>
}
