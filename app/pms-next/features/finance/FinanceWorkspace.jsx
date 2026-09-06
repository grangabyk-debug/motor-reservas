"use client"

import{useEffect,useState}from"react"
import FinanceDashboard from"./FinanceDashboard"
import PaymentsPanel from"./PaymentsPanel"
import OnlinePaymentsPanel from"./OnlinePaymentsPanel"
import DocumentsPanel from"./DocumentsPanel"
import ExpensesPanel from"./ExpensesPanel"
import s from"./finance.module.css"

const TABS=[
  ["dashboard","Resumen"],
  ["payments","Pagos"],
  ["online","Cobros online"],
  ["documents","Facturas y documentos"],
  ["expenses","Gastos"],
]
const validTab=value=>TABS.some(([id])=>id===value)

export default function FinanceWorkspace({propertyId,property}){
  const[tab,setTab]=useState("dashboard")
  useEffect(()=>{
    if(typeof window==="undefined")return
    const readUrl=()=>{const requested=new URL(window.location.href).searchParams.get("finance_tab");if(validTab(requested))setTab(requested);else setTab("dashboard")}
    const onRequested=event=>{if(validTab(event.detail))setTab(event.detail)}
    readUrl();window.addEventListener("hl:pms-finance-tab",onRequested);return()=>window.removeEventListener("hl:pms-finance-tab",onRequested)
  },[])
  function chooseTab(next){setTab(next);if(typeof window!=="undefined"){const url=new URL(window.location.href);if(next==="dashboard")url.searchParams.delete("finance_tab");else url.searchParams.set("finance_tab",next);window.history.replaceState({},"",url)}}
  return <section className={s.page}>
    <header className={s.header}><div><small>FINANZAS</small><h1>Control financiero</h1><p>{property?.name||"Propiedad activa"} · análisis, historial de pagos, cobros online, documentos y gastos. La operación de caja se gestiona desde Caja diaria.</p></div><div className={s.tabs}>{TABS.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>chooseTab(id)}>{label}</button>)}</div></header>
    {tab==="dashboard"?<FinanceDashboard propertyId={propertyId}/>:tab==="payments"?<PaymentsPanel propertyId={propertyId}/>:tab==="online"?<OnlinePaymentsPanel propertyId={propertyId}/>:tab==="documents"?<DocumentsPanel propertyId={propertyId}/>:<ExpensesPanel propertyId={propertyId}/>} 
  </section>
}
