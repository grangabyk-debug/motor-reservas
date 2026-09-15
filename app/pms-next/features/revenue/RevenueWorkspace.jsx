"use client"

import{useEffect,useState}from"react"
import RevenueCore from"./RevenueCore"
import IntelligenceWorkspace from"../intelligence/IntelligenceWorkspace"
import ReportsWorkspace from"../reports/ReportsWorkspace"

const VALID_TABS=new Set(["overview","revenue","intelligence"])
function readTab(){if(typeof window==="undefined")return"overview";const value=new URL(window.location.href).searchParams.get("performance_tab");return VALID_TABS.has(value)?value:"overview"}

export default function RevenueWorkspace({propertyId,property,onNavigate}){
  const[tab,setTab]=useState(readTab)
  useEffect(()=>{if(typeof window==="undefined")return;const sync=()=>setTab(readTab());window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync)},[])
  function chooseTab(next){if(!VALID_TABS.has(next))return;setTab(next);if(typeof window==="undefined")return;const url=new URL(window.location.href);if(next==="overview")url.searchParams.delete("performance_tab");else url.searchParams.set("performance_tab",next);window.history.replaceState(window.history.state||{},"",url);window.scrollTo({top:0,behavior:"auto"})}
  return <section data-performance>
    <style>{`
      [data-performance]{padding:24px 26px 42px;min-height:calc(100dvh - 58px)}
      [data-performance-head]{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}
      [data-performance-head] small{display:block;font-size:11px;font-weight:900;letter-spacing:.13em;color:var(--accent)}
      [data-performance-head] h1{margin:5px 0 0;font-size:34px;letter-spacing:-.04em}
      [data-performance-tabs]{display:flex;gap:5px;padding:4px;border:1px solid var(--line);border-radius:13px;background:color-mix(in srgb,var(--panelSolid) 80%,transparent);backdrop-filter:blur(18px)}
      [data-performance-tabs] button{height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:850;cursor:pointer}
      [data-performance-tabs] button[data-active="true"]{background:var(--panelSolid);color:var(--text);box-shadow:0 5px 16px rgba(20,28,44,.08)}
      [data-performance-body]>section{padding:0!important;min-height:0!important}
      [data-performance-body]>section>header:first-child>div:first-child{display:none!important}
      [data-performance-body]>section>header:first-child{justify-content:flex-end!important;margin-bottom:14px!important}
      [data-performance-body] [data-intelligence]{margin:0!important}
      @media(max-width:760px){[data-performance]{padding:16px 12px 32px}[data-performance-head]{align-items:flex-start;flex-direction:column}[data-performance-head] h1{font-size:29px}[data-performance-tabs]{width:100%;overflow:auto}[data-performance-tabs] button{flex:1;white-space:nowrap}}
    `}</style>
    <header data-performance-head><div><small>GESTIÓN · RENDIMIENTO</small><h1>Rendimiento</h1></div><nav data-performance-tabs aria-label="Secciones de rendimiento"><button type="button" data-active={tab==="overview"} onClick={()=>chooseTab("overview")}>Resumen</button><button type="button" data-active={tab==="revenue"} onClick={()=>chooseTab("revenue")}>Revenue</button><button type="button" data-active={tab==="intelligence"} onClick={()=>chooseTab("intelligence")}>Inteligencia</button></nav></header>
    <div data-performance-body>{tab==="overview"?<ReportsWorkspace propertyId={propertyId} property={property}/>:tab==="revenue"?<RevenueCore propertyId={propertyId} property={property} onNavigate={onNavigate}/>:<IntelligenceWorkspace propertyId={propertyId} property={property}/>}</div>
  </section>
}
