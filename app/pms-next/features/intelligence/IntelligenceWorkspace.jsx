"use client"

import{useState}from"react"
import AnalyticsOverview from"./AnalyticsOverview"
import SalesIntelligence from"./SalesIntelligence"
import DemandIntelligence from"./DemandIntelligence"
import PipelineIntelligence from"./PipelineIntelligence"
import useIntelligenceData from"./useIntelligenceData"

const polish=`
[data-intelligence] header p{display:none!important}
[data-intelligence] button{min-height:38px;font-size:12px!important}
[data-intelligence] small{font-size:11px!important;line-height:1.35}
[data-intelligence] span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px,.82em)!important;line-height:1.4}
[data-intelligence] table{font-size:12px}
[data-intelligence] th,[data-intelligence] td{font-size:11px!important}
[data-intelligence] select,[data-intelligence] input{min-height:38px;font-size:13px!important}
[data-intelligence] article>div span>b,[data-intelligence] article footer b,[data-intelligence] aside>div>b{font-size:10px!important}
[data-intelligence] article>div>div>em{display:none!important}
[data-intelligence] main aside>p,[data-intelligence] main aside>div:last-child{display:none!important}
[data-intelligence] main aside>div[class*="focusEmpty"]:last-child{display:grid!important}
[data-intelligence] main aside>div[class*="guard"]:last-child{display:block!important}
[data-intelligence] main{border-radius:22px;overflow:hidden}
[data-intelligence] nav,[data-intelligence] section{scroll-margin-top:82px}
[data-intelligence-switch]{position:sticky;top:68px;z-index:15;display:flex;gap:6px;width:max-content;max-width:calc(100% - 32px);margin:12px 16px -2px;padding:5px;border:1px solid rgba(94,108,142,.15);border-radius:14px;background:rgba(250,251,254,.9);backdrop-filter:blur(18px);box-shadow:0 8px 24px rgba(36,45,76,.08)}
[data-intelligence-switch] button{border:0;border-radius:10px;padding:0 15px;background:transparent;color:#68758d;font-weight:850;white-space:nowrap;cursor:pointer}
[data-intelligence-switch] button[data-active="true"]{background:#1d2540;color:#fff;box-shadow:0 4px 12px rgba(29,37,64,.2)}
[data-theme="dark"] [data-intelligence] main{background:radial-gradient(circle at top right,rgba(118,101,230,.15),transparent 30%),#111522!important;color:#edf1fb!important}
[data-theme="dark"] [data-intelligence] article,[data-theme="dark"] [data-intelligence] section{border-color:rgba(151,163,194,.2)!important;color:#edf1fb}
[data-theme="dark"] [data-intelligence] table,[data-theme="dark"] [data-intelligence] thead,[data-theme="dark"] [data-intelligence] tbody,[data-theme="dark"] [data-intelligence] tr,[data-theme="dark"] [data-intelligence] td,[data-theme="dark"] [data-intelligence] th{color:#edf1fb!important;border-color:rgba(151,163,194,.15)!important}
[data-theme="dark"] [data-intelligence-switch]{background:rgba(17,21,34,.9);border-color:rgba(151,163,194,.18)}
[data-theme="dark"] [data-intelligence-switch] button{color:#aab4c8}
[data-theme="dark"] [data-intelligence-switch] button[data-active="true"]{background:#ede9ff;color:#24213e}
@media(max-width:760px){[data-intelligence] button{min-height:42px}[data-intelligence] select,[data-intelligence] input{font-size:16px!important}[data-intelligence-switch]{top:60px;max-width:calc(100% - 20px);margin:9px 10px -1px;overflow:auto}[data-intelligence-switch] button{padding:0 12px}}
`

export default function IntelligenceWorkspace({propertyId,property}){
  const data=useIntelligenceData(propertyId),role=property?.role||"member",canManage=["owner","manager"].includes(role),[mode,setMode]=useState("sales")
  if(data.loading)return <section style={{padding:24,fontSize:15,fontWeight:750}}>Cargando Inteligencia…</section>
  if(data.error)return <section style={{padding:24}}><div style={{padding:14,borderRadius:14,background:"rgba(229,72,77,.1)",color:"#b42343",fontWeight:750}}>{data.error}</div></section>
  return <section data-intelligence><style>{polish}</style><nav data-intelligence-switch aria-label="Secciones de Inteligencia"><button type="button" data-active={mode==="sales"} onClick={()=>setMode("sales")}>Ventas directas</button><button type="button" data-active={mode==="demand"} onClick={()=>setMode("demand")}>Demanda</button><button type="button" data-active={mode==="pipeline"} onClick={()=>setMode("pipeline")}>Pipeline</button><button type="button" data-active={mode==="hotel"} onClick={()=>setMode("hotel")}>Rendimiento hotelero</button></nav>{mode==="sales"?<SalesIntelligence reservations={data.reservations} conversations={data.conversations} messages={data.messages} webEvents={data.webEvents} quotes={data.quotes} groups={data.groups} channelCosts={data.channelCosts} settings={property||{}}/>:mode==="demand"?<DemandIntelligence reservations={data.reservations} groups={data.groups} quotes={data.quotes} webEvents={data.webEvents} settings={property||{}}/>:mode==="pipeline"?<PipelineIntelligence reservations={data.reservations} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={data.groups}/>:<AnalyticsOverview rooms={data.rooms} reservations={data.reservations} payments={data.payments} blocks={data.blocks} snapshots={data.snapshots} channelCosts={data.channelCosts} settings={property||{}} canManageChannelCosts={canManage} onSaveChannelCost={data.saveChannelCost}/>}</section>
}
