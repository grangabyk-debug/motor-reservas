"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import FinanceDashboard from"./FinanceDashboard"
import PaymentsPanel from"./PaymentsPanel"
import PaymentAutomationPanel from"./PaymentAutomationPanel"
import OnlinePaymentsPanel from"./OnlinePaymentsPanel"
import DocumentsPanel from"./DocumentsPanel"
import ExpensesPanel from"./ExpensesPanel"
import FiscalLatamPanel from"./FiscalLatamPanel"
import s from"./finance.module.css"

const ALL_TABS=[
  ["dashboard","Resumen"],
  ["payments","Pagos"],
  ["automation","Automatización"],
  ["online","Cobros online"],
  ["documents","Facturas y documentos"],
  ["fiscal","Fiscal Argentina / LATAM"],
  ["expenses","Gastos"],
]

export default function FinanceWorkspace({propertyId,property}){
  const[tab,setTab]=useState("dashboard"),[automationAllowed,setAutomationAllowed]=useState(null)
  const tabs=useMemo(()=>ALL_TABS.filter(([id])=>id!=="automation"||automationAllowed!==false),[automationAllowed])
  const validTab=value=>tabs.some(([id])=>id===value)
  useEffect(()=>{let alive=true;if(!propertyId)return;Promise.all([supabase.rpc("hl_can_property_action",{p_property_id:propertyId,p_action:"payments.create_request"}),supabase.rpc("hl_can_property_action",{p_property_id:propertyId,p_action:"payments.verify_request"})]).then(results=>{if(alive)setAutomationAllowed(results.some(result=>!result.error&&result.data===true))}).catch(()=>alive&&setAutomationAllowed(false));return()=>{alive=false}},[propertyId])
  useEffect(()=>{if(automationAllowed===false&&tab==="automation")setTab("dashboard")},[automationAllowed,tab])
  useEffect(()=>{if(typeof window==="undefined")return;const readUrl=()=>{const requested=new URL(window.location.href).searchParams.get("finance_tab");if(validTab(requested))setTab(requested);else setTab("dashboard")};const onRequested=event=>{if(validTab(event.detail))setTab(event.detail)};readUrl();window.addEventListener("hl:pms-finance-tab",onRequested);return()=>window.removeEventListener("hl:pms-finance-tab",onRequested)},[automationAllowed])
  function chooseTab(next){if(!validTab(next))return;setTab(next);if(typeof window!=="undefined"){const url=new URL(window.location.href);if(next==="dashboard")url.searchParams.delete("finance_tab");else url.searchParams.set("finance_tab",next);window.history.replaceState({},"",url)}}
  return <section className={s.page}>
    <header className={s.header}><div><small>FINANZAS</small><h1>Control financiero</h1><p>{property?.name||"Propiedad activa"} · análisis, pagos, automatización, documentos y capa fiscal regional. La operación de caja se gestiona desde Caja diaria.</p></div><div className={s.tabs}>{tabs.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>chooseTab(id)}>{label}</button>)}</div></header>
    {tab==="dashboard"?<FinanceDashboard propertyId={propertyId}/>:tab==="payments"?<PaymentsPanel propertyId={propertyId}/>:tab==="automation"&&automationAllowed!==false?<PaymentAutomationPanel propertyId={propertyId}/>:tab==="online"?<OnlinePaymentsPanel propertyId={propertyId}/>:tab==="documents"?<DocumentsPanel propertyId={propertyId}/>:tab==="fiscal"?<FiscalLatamPanel propertyId={propertyId}/>:<ExpensesPanel propertyId={propertyId}/>} 
  </section>
}
