"use client"

import{useState}from"react"
import FinanceDashboard from"./FinanceDashboard"
import PaymentsPanel from"./PaymentsPanel"
import DocumentsPanel from"./DocumentsPanel"
import CashPanel from"./CashPanel"
import ExpensesPanel from"./ExpensesPanel"
import s from"./finance.module.css"

const TABS=[
  ["dashboard","Resumen"],
  ["payments","Pagos"],
  ["documents","Facturas y documentos"],
  ["cash","Caja"],
  ["expenses","Gastos"],
]

export default function FinanceWorkspace({propertyId,property}){
  const[tab,setTab]=useState("dashboard")
  return <section className={s.page}>
    <header className={s.header}><div><small>FINANZAS</small><h1>Control financiero</h1><p>{property?.name||"Propiedad activa"} · ingresos, pagos, documentos, caja y egresos.</p></div><div className={s.tabs}>{TABS.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>setTab(id)}>{label}</button>)}</div></header>
    {tab==="dashboard"?<FinanceDashboard propertyId={propertyId}/>:tab==="payments"?<PaymentsPanel propertyId={propertyId}/>:tab==="documents"?<DocumentsPanel propertyId={propertyId}/>:tab==="cash"?<CashPanel propertyId={propertyId}/>:<ExpensesPanel propertyId={propertyId}/>} 
  </section>
}
