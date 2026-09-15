"use client"

import{useEffect,useMemo,useState}from"react"
import AnalyticsOverview from"./AnalyticsOverview"
import SalesIntelligence from"./SalesIntelligence"
import DemandIntelligence from"./DemandIntelligence"
import PipelineIntelligence from"./PipelineIntelligence"
import CommercialAutomation from"./CommercialAutomation"
import CommercialCopilot from"./CommercialCopilot"
import IntelligenceHome from"./IntelligenceHome"
import useIntelligenceData from"./useIntelligenceData"

const modes=new Set(["overview","sales","demand","pipeline","automation","olivia","hotel"])
const polish=`
[data-intelligence]{display:block;min-width:0}
[data-intelligence] button{min-height:38px;font-size:12px!important}
[data-intelligence] small{font-size:11px!important;line-height:1.4}
[data-intelligence] span,[data-intelligence] em,[data-intelligence] label,[data-intelligence] footer{font-size:max(10px,.82em)!important;line-height:1.4}
[data-intelligence] table{font-size:12px}
[data-intelligence] th,[data-intelligence] td{font-size:11px!important}
[data-intelligence] select,[data-intelligence] input{min-height:38px;font-size:13px!important}
[data-intelligence] article>div span>b,[data-intelligence] article footer b,[data-intelligence] aside>div>b{font-size:10px!important}
[data-intelligence] article>div>div>em{display:none!important}
[data-intelligence] main aside>p,[data-intelligence] main aside>div:last-child{display:none!important}
[data-intelligence] main aside>div[class*="focusEmpty"]:last-child{display:grid!important}
[data-intelligence] main aside>div[class*="guard"]:last-child{display:block!important}
[data-intelligence] main{border-radius:20px;overflow:hidden;animation:intelligenceIn .22s ease both}
[data-intelligence] main>header:first-child{min-height:0!important;padding:20px 22px!important;border-radius:20px!important;background:radial-gradient(circle at 88% 0%,rgba(125,109,237,.2),transparent 28%),linear-gradient(135deg,#171e35 0%,#28304f 72%,#393866 100%)!important;box-shadow:0 12px 32px rgba(29,37,67,.13)!important;color:#fff!important}
[data-intelligence] main>header:first-child>div:first-child>small:first-child{display:none!important}
[data-intelligence] main>header:first-child h1{max-width:780px!important;margin:4px 0 6px!important;color:#fff!important;font-size:clamp(25px,2.5vw,34px)!important;line-height:1.07!important;letter-spacing:-.038em!important;text-shadow:0 1px 1px rgba(0,0,0,.08)}
[data-intelligence] main>header:first-child p{display:block!important;max-width:700px!important;margin:0!important;color:#d2d8e8!important;font-size:12px!important;line-height:1.5!important}
[data-intelligence] main>header:first-child strong{color:#fff!important}
[data-intelligence] main>header:first-child span,[data-intelligence] main>header:first-child small{color:#c6cee2!important}
[data-intelligence] main>section[class*="filters"]{margin-top:-2px;padding:0!important}
[data-intelligence] main>section[class*="filters"]>div{padding:4px!important;border-radius:12px!important;box-shadow:none!important}
[data-intelligence] main>section[class*="filters"] button{min-height:34px!important;padding:0 12px!important;border-radius:9px!important}
[data-intelligence] article{border-color:rgba(68,80,112,.09)!important;box-shadow:0 7px 22px rgba(43,54,85,.045)!important;transition:border-color .18s ease,box-shadow .18s ease,transform .18s ease}
[data-intelligence] article:hover{border-color:rgba(102,89,223,.14)!important;box-shadow:0 10px 25px rgba(43,54,85,.065)!important}
[data-intelligence] nav,[data-intelligence] section{scroll-margin-top:82px}
[data-intelligence-switch]{position:sticky;top:68px;z-index:15;display:flex;align-items:center;gap:4px;width:max-content;max-width:calc(100% - 32px);margin:10px 16px 0;padding:4px;border:1px solid rgba(94,108,142,.13);border-radius:13px;background:rgba(250,251,254,.92);backdrop-filter:blur(18px);box-shadow:0 6px 18px rgba(36,45,76,.06);overflow:auto}
[data-intelligence-switch] button{border:0;border-radius:9px;padding:0 13px;background:transparent;color:#6f7a90;font-weight:820;white-space:nowrap;cursor:pointer;transition:.16s ease}
[data-intelligence-switch] button:hover{background:rgba(95,83,204,.07);color:#4c456f}
[data-intelligence-switch] button[data-active="true"]{background:#202844;color:#fff;box-shadow:0 4px 10px rgba(29,37,64,.16)}
[data-intelligence-context]{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:8px 16px 0;padding:9px 11px;border:1px solid rgba(87,99,132,.1);border-radius:12px;background:rgba(255,255,255,.72);color:#6e7990}
[data-intelligence-context] span{font-weight:780}
[data-intelligence-context] button{min-height:32px!important;padding:0 11px;border:1px solid rgba(95,84,203,.13);border-radius:9px;background:#f5f3ff;color:#5d54c7;font-weight:820;cursor:pointer}
@keyframes intelligenceIn{from{opacity:.72;transform:translateY(3px)}to{opacity:1;transform:none}}
[data-theme="dark"] [data-intelligence] main{background:radial-gradient(circle at top right,rgba(118,101,230,.12),transparent 30%),#111522!important;color:#edf1fb!important}
[data-theme="dark"] [data-intelligence] article,[data-theme="dark"] [data-intelligence] section{border-color:rgba(151,163,194,.16)!important;color:#edf1fb}
[data-theme="dark"] [data-intelligence] table,[data-theme="dark"] [data-intelligence] thead,[data-theme="dark"] [data-intelligence] tbody,[data-theme="dark"] [data-intelligence] tr,[data-theme="dark"] [data-intelligence] td,[data-theme="dark"] [data-intelligence] th{color:#edf1fb!important;border-color:rgba(151,163,194,.14)!important}
[data-theme="dark"] [data-intelligence-switch]{background:rgba(17,21,34,.92);border-color:rgba(151,163,194,.16)}
[data-theme="dark"] [data-intelligence-switch] button{color:#aab4c8}
[data-theme="dark"] [data-intelligence-switch] button:hover{background:rgba(237,233,255,.07);color:#d5dbea}
[data-theme="dark"] [data-intelligence-switch] button[data-active="true"]{background:#ede9ff;color:#24213e}
[data-theme="dark"] [data-intelligence-context]{background:rgba(22,27,41,.8);border-color:rgba(151,163,194,.13);color:#aab4c8}
[data-theme="dark"] [data-intelligence-context] button{background:rgba(119,101,230,.12);color:#d9d4ff;border-color:rgba(155,142,240,.18)}
@media(max-width:760px){[data-intelligence] button{min-height:42px}[data-intelligence] select,[data-intelligence] input,[data-intelligence] textarea{font-size:16px!important}[data-intelligence] main>header:first-child{padding:18px 16px!important;border-radius:18px!important}[data-intelligence] main>header:first-child h1{font-size:27px!important}[data-intelligence-switch]{top:60px;max-width:calc(100% - 20px);margin:8px 10px 0;overflow:auto}[data-intelligence-switch] button{padding:0 11px}[data-intelligence-context]{margin:7px 10px 0;align-items:flex-start;flex-direction:column}}
`

export default function IntelligenceWorkspace({propertyId,property}){
  const data=useIntelligenceData(propertyId),role=property?.role||"member",canManage=["owner","manager"].includes(role),[mode,setMode]=useState("overview")
  const commercialGroups=useMemo(()=>{const latestByGroup=new Map();[...data.quotes].sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0)).forEach(quote=>{const key=String(quote.group_id||"");if(key&&!latestByGroup.has(key))latestByGroup.set(key,quote)});return data.groups.map(group=>{const quote=latestByGroup.get(String(group.id)),status=String(quote?.status||"").trim().toLowerCase();return status==="rejected"||status.includes("rechaz")?{...group,sales_stage:"lost"}:group})},[data.groups,data.quotes])
  useEffect(()=>{if(typeof window==="undefined")return;const apply=()=>{const requested=new URL(window.location.href).searchParams.get("intelligence");setMode(modes.has(requested)?requested:"overview")};apply();window.addEventListener("popstate",apply);return()=>window.removeEventListener("popstate",apply)},[])
  function changeMode(next){setMode(next);if(typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("intelligence",next);window.history.replaceState(window.history.state||{},"",url);window.scrollTo({top:0,behavior:"smooth"})}
  if(data.loading)return <section style={{padding:24,fontSize:15,fontWeight:750}}>Cargando Inteligencia…</section>
  if(data.error)return <section style={{padding:24}}><div style={{padding:14,borderRadius:14,background:"rgba(229,72,77,.1)",color:"#b42343",fontWeight:750}}>{data.error}</div></section>
  let content
  if(mode==="overview")content=<IntelligenceHome data={data} property={property||{}} onNavigate={changeMode}/>
  else if(mode==="sales")content=<SalesIntelligence reservations={data.reservations} conversations={data.conversations} messages={data.messages} webEvents={data.webEvents} quotes={data.quotes} groups={data.groups} channelCosts={data.channelCosts} settings={property||{}}/>
  else if(mode==="demand")content=<DemandIntelligence reservations={data.reservations} groups={data.groups} quotes={data.quotes} webEvents={data.webEvents} settings={property||{}}/>
  else if(mode==="pipeline")content=<PipelineIntelligence reservations={data.reservations} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={commercialGroups}/>
  else if(mode==="automation")content=<CommercialAutomation propertyId={propertyId} property={property} reservations={data.reservations} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={commercialGroups}/>
  else if(mode==="olivia")content=<CommercialCopilot property={property} rooms={data.rooms} reservations={data.reservations} blocks={data.blocks} conversations={data.conversations} messages={data.messages} quotes={data.quotes} groups={commercialGroups} bookingEngine={data.bookingEngine}/>
  else content=<AnalyticsOverview rooms={data.rooms} reservations={data.reservations} payments={data.payments} blocks={data.blocks} snapshots={data.snapshots} channelCosts={data.channelCosts} settings={property||{}} canManageChannelCosts={canManage} onSaveChannelCost={data.saveChannelCost}/>
  const active=mode==="sales"?"overview":mode==="automation"?"pipeline":mode
  const context=mode==="sales"?{label:"Detalle de venta directa",back:"Volver al resumen",to:"overview"}:mode==="automation"?{label:"Reglas y seguimiento automático",back:"Volver al pipeline",to:"pipeline"}:mode==="pipeline"?{label:"Pipeline comercial",back:"Abrir reglas y seguimiento",to:"automation"}:null
  return <section data-intelligence><style>{polish}</style><nav data-intelligence-switch aria-label="Secciones de Inteligencia"><button type="button" data-active={active==="overview"} onClick={()=>changeMode("overview")}>Resumen</button><button type="button" data-active={active==="demand"} onClick={()=>changeMode("demand")}>Demanda</button><button type="button" data-active={active==="pipeline"} onClick={()=>changeMode("pipeline")}>Pipeline</button><button type="button" data-active={active==="olivia"} onClick={()=>changeMode("olivia")}>OlivIA</button><button type="button" data-active={active==="hotel"} onClick={()=>changeMode("hotel")}>Rendimiento</button></nav>{context?<div data-intelligence-context><span>{context.label}</span><button type="button" onClick={()=>changeMode(context.to)}>{context.back}</button></div>:null}{content}</section>
}
