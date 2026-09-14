"use client"

import{useEffect,useMemo,useState}from"react"
import AnalyticsOverview from"./AnalyticsOverview"
import SalesIntelligence from"./SalesIntelligence"
import DemandIntelligence from"./DemandIntelligence"
import PipelineIntelligence from"./PipelineIntelligence"
import CommercialAutomation from"./CommercialAutomation"
import CommercialCopilot from"./CommercialCopilot"
import useIntelligenceData from"./useIntelligenceData"

const modes=new Set(["sales","demand","pipeline","automation","olivia","hotel"])
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
@media(max-width:760px){[data-intelligence] button{min-height:42px}[data-intelligence] select,[data-intelligence] input,[data-intelligence] textarea{font-size:16px!important}[data-intelligence-switch]{top:60px;max-width:calc(100% - 20px);margin:9px 10px -1px;overflow:auto}[data-intelligence-switch] button{padding:0 12px}}
`

export default function IntelligenceWorkspace({propertyId,property}){
  const data=useIntelligenceData(propertyId),role=property?.role||"member",canManage=["owner","manager"].includes(role),[mode,setMode]=useState("sales")
  const commercialGroups=useMemo(()=>{
    const latestByGroup=new Map()
    ;[...data.quotes].sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0)).forEach(quote=>{const key=String(quote.group_id||"");if(key&&!latestByGroup.has(key))latestByGroup.set(key,quote)})
    return data.groups.map(group=>{const quote=latestByGroup.get(String(group.id)),status=String(quote?.status||"").trim().toLowerCase();return status==="rejected"||status.includes("rechaz")?{...group,sales_stage:"lost"}:group})
  },[data.groups,data.quotes])
  useEffect(()=>{if(typeof window==="undefined")return;const apply=()=>{const requested=new URL(window.location.href).searchParams.get("intelligence");if(modes.has(requested))setMode(requested)};apply();window.addEventListener("popstate",apply);return()=>window.removeEventListener("popstate",apply)},[])
  function changeMode(next){setMode(next);if(typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("intelligence",next);window.history.replaceState(window.history.state||{},"",url)}
  if(data.loading)return <section style={{padding:24,fontSize:15,fontWeight:750}}>Cargando Inteligencia…</section>
  if(data.error)return <section style={{padding:24}}><div style={{padding:14,borderRadius:14,background:"rgba(229,72,77,.1)",color:"#b42343",fontWeight:750}}>{data.error}</div></section>
  let content
  if(mode==="sales")content=<SalesIntelligence reservations={data.reservations} conversations={data.conversations} messages={data.messages} webEvents={data.webEvents} quotes={data.quotes} groups={data.groups} channelCosts={data.channelCosts} settings={property||{}}/>
  else if(mode==="demand")content=<DemandIntelligence reservations={data.reservations} groups={data.groups} quotes={data.quotes} webEvents={data.webEvents} settings={property||{}}/>
  else if(mode==="pipeline")content=<PipelineIntelligence reservations={data.reservations} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={commercialGroups}/>
  else if(mode==="automation")content=<CommercialAutomation propertyId={propertyId} property={property} reservations={data.reservations} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={commercialGroups}/>
  else if(mode==="olivia")content=<CommercialCopilot property={property} rooms={data.rooms} reservations={data.reservations} blocks={data.blocks} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={commercialGroups} bookingEngine={data.bookingEngine}/>
  else content=<AnalyticsOverview rooms={data.rooms} reservations={data.reservations} payments={data.payments} blocks={data.blocks} snapshots={data.snapshots} channelCosts={data.channelCosts} settings={property||{}} canManageChannelCosts={canManage} onSaveChannelCost={data.saveChannelCost}/>
  return <section data-intelligence><style>{polish}</style><nav data-intelligence-switch aria-label="Secciones de Inteligencia"><button type="button" data-active={mode==="sales"} onClick={()=>changeMode("sales")}>Ventas directas</button><button type="button" data-active={mode==="demand"} onClick={()=>changeMode("demand")}>Demanda</button><button type="button" data-active={mode==="pipeline"} onClick={()=>changeMode("pipeline")}>Pipeline</button><button type="button" data-active={mode==="automation"} onClick={()=>changeMode("automation")}>Automatización</button><button type="button" data-active={mode==="olivia"} onClick={()=>changeMode("olivia")}>OlivIA</button><button type="button" data-active={mode==="hotel"} onClick={()=>changeMode("hotel")}>Rendimiento hotelero</button></nav>{content}</section>
}
