"use client"

import{useEffect,useState}from"react"
import ChannelManagerCore from"./ChannelManagerCore"
import WebsitePanel from"./WebsitePanel"

const VALID_TABS=new Set(["channels","website"])
function readTab(){if(typeof window==="undefined")return"channels";const value=new URL(window.location.href).searchParams.get("distribution_tab");return VALID_TABS.has(value)?value:"channels"}

export default function ChannelManagerWorkspace({propertyId,property}){
  const[tab,setTab]=useState(readTab)
  useEffect(()=>{if(typeof window==="undefined")return;const sync=()=>setTab(readTab());window.addEventListener("popstate",sync);return()=>window.removeEventListener("popstate",sync)},[])
  function chooseTab(next){if(!VALID_TABS.has(next))return;setTab(next);if(typeof window==="undefined")return;const url=new URL(window.location.href);if(next==="channels")url.searchParams.delete("distribution_tab");else url.searchParams.set("distribution_tab",next);window.history.replaceState(window.history.state||{},"",url);window.scrollTo({top:0,behavior:"auto"})}
  return <section data-distribution>
    <style>{`
      [data-distribution]{padding:24px 26px 42px;min-height:calc(100dvh - 58px)}
      [data-distribution-head]{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:16px}
      [data-distribution-head] small{display:block;font-size:11px;font-weight:900;letter-spacing:.13em;color:var(--accent)}
      [data-distribution-head] h1{margin:5px 0 0;font-size:34px;letter-spacing:-.04em}
      [data-distribution-tabs]{display:flex;gap:5px;padding:4px;border:1px solid var(--line);border-radius:13px;background:color-mix(in srgb,var(--panelSolid) 80%,transparent);backdrop-filter:blur(18px)}
      [data-distribution-tabs] button{height:36px;padding:0 14px;border:0;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:12px;font-weight:850;cursor:pointer}
      [data-distribution-tabs] button[data-active="true"]{background:var(--panelSolid);color:var(--text);box-shadow:0 5px 16px rgba(20,28,44,.08)}
      [data-distribution-body]>section{padding:0!important;min-height:0!important}
      @media(max-width:760px){[data-distribution]{padding:16px 12px 32px}[data-distribution-head]{align-items:flex-start;flex-direction:column}[data-distribution-head] h1{font-size:29px}[data-distribution-tabs]{width:100%}[data-distribution-tabs] button{flex:1}}
    `}</style>
    <header data-distribution-head><div><small>VENTA ONLINE</small><h1>Distribución</h1></div><nav data-distribution-tabs aria-label="Áreas de distribución"><button type="button" data-active={tab==="channels"} onClick={()=>chooseTab("channels")}>Canales y sincronización</button><button type="button" data-active={tab==="website"} onClick={()=>chooseTab("website")}>Venta directa</button></nav></header>
    <div data-distribution-body>{tab==="channels"?<ChannelManagerCore propertyId={propertyId} property={property}/>:<WebsitePanel propertyId={propertyId} property={property}/>}</div>
  </section>
}
