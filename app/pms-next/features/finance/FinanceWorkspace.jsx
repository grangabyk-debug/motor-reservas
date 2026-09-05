"use client"

import{useEffect,useState}from"react"
import FinanceDashboard from"./FinanceDashboard"
import PaymentsPanel from"./PaymentsPanel"
import OnlinePaymentsPanel from"./OnlinePaymentsPanel"
import DocumentsPanel from"./DocumentsPanel"
import CashPanel from"./CashPanel"
import ExpensesPanel from"./ExpensesPanel"
import s from"./finance.module.css"

const TABS=[
  ["dashboard","Resumen"],
  ["payments","Pagos"],
  ["online","Cobros online"],
  ["documents","Facturas y documentos"],
  ["cash","Arqueo y turnos"],
  ["expenses","Gastos"],
]

export default function FinanceWorkspace({propertyId,property}){
  const[tab,setTab]=useState("dashboard")
  useEffect(()=>{if(typeof window==="undefined")return;const requested=new URL(window.location.href).searchParams.get("finance_tab");if(TABS.some(([id])=>id===requested))setTab(requested)},[])
  function chooseTab(next){setTab(next);if(typeof window!=="undefined"){const url=new URL(window.location.href);if(next==="dashboard")url.searchParams.delete("finance_tab");else url.searchParams.set("finance_tab",next);window.history.replaceState({},"",url)}}
  return <section className={s.page}>
    <header className={s.header}><div><small>FINANZAS</small><h1>Control financiero</h1><p>{property?.name||"Propiedad activa"} · ingresos, pagos, documentos, caja y egresos.</p></div><div className={s.tabs}>{TABS.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>chooseTab(id)}>{label}</button>)}</div></header>
    {tab==="dashboard"?<FinanceDashboard propertyId={propertyId}/>:tab==="payments"?<PaymentsPanel propertyId={propertyId}/>:tab==="online"?<OnlinePaymentsPanel propertyId={propertyId}/>:tab==="documents"?<DocumentsPanel propertyId={propertyId}/>:tab==="cash"?<CashPanel propertyId={propertyId}/>:<ExpensesPanel propertyId={propertyId}/>} 
  </section>
}
