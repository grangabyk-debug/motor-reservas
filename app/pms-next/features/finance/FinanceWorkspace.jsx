"use client"

import{useEffect,useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import DailyCashWorkspace from"./DailyCashWorkspace"
import FinanceDashboard from"./FinanceDashboard"
import PaymentsPanel from"./PaymentsPanel"
import PaymentAutomationPanel from"./PaymentAutomationPanel"
import OnlinePaymentsPanel from"./OnlinePaymentsPanel"
import DocumentsPanel from"./DocumentsPanel"
import ExpensesPanel from"./ExpensesPanel"
import FiscalLatamPanel from"./FiscalLatamPanel"
import s from"./finance.module.css"

const PRIMARY_TABS=[
  ["cash","Caja"],
  ["dashboard","Resumen"],
  ["payments","Cobros"],
  ["documents","Facturación"],
  ["expenses","Gastos"],
]
const ADVANCED_TABS=[
  ["automation","Automatización"],
  ["online","Cobros online"],
  ["fiscal","Fiscal"],
]

export default function FinanceWorkspace({propertyId,property,onNavigate,focusReservationId,onFocusHandled}){
  const[tab,setTab]=useState("cash"),[automationAllowed,setAutomationAllowed]=useState(null)
  const advancedTabs=useMemo(()=>ADVANCED_TABS.filter(([id])=>id!=="automation"||automationAllowed!==false),[automationAllowed])
  const allTabs=useMemo(()=>[...PRIMARY_TABS,...advancedTabs],[advancedTabs])
  const validTab=value=>allTabs.some(([id])=>id===value)
  const advancedActive=advancedTabs.some(([id])=>id===tab)

  useEffect(()=>{let alive=true;if(!propertyId)return;Promise.all([supabase.rpc("hl_can_property_action",{p_property_id:propertyId,p_action:"payments.create_request"}),supabase.rpc("hl_can_property_action",{p_property_id:propertyId,p_action:"payments.verify_request"})]).then(results=>{if(alive)setAutomationAllowed(results.some(result=>!result.error&&result.data===true))}).catch(()=>alive&&setAutomationAllowed(false));return()=>{alive=false}},[propertyId])
  useEffect(()=>{if(automationAllowed===false&&tab==="automation")setTab("cash")},[automationAllowed,tab])
  useEffect(()=>{if(typeof window==="undefined")return;const readUrl=()=>{const requested=new URL(window.location.href).searchParams.get("finance_tab");if(validTab(requested))setTab(requested);else setTab("cash")};const onRequested=event=>{if(validTab(event.detail))setTab(event.detail)};readUrl();window.addEventListener("hl:pms-finance-tab",onRequested);return()=>window.removeEventListener("hl:pms-finance-tab",onRequested)},[automationAllowed])

  function chooseTab(next){if(!validTab(next))return;setTab(next);if(typeof window!=="undefined"){const url=new URL(window.location.href);if(next==="cash")url.searchParams.delete("finance_tab");else url.searchParams.set("finance_tab",next);window.history.replaceState({},"",url)}}

  return <section className={s.page}>
    <header className={s.header}><div><small>CAJA Y FINANZAS</small><h1>Caja y finanzas</h1><p>{property?.name||"Propiedad activa"} · caja diaria, cobros, facturación, gastos y control financiero desde un solo lugar.</p></div><div className={s.financeNav}><div className={s.tabs}>{PRIMARY_TABS.map(([id,label])=><button key={id} className={tab===id?s.active:""} onClick={()=>chooseTab(id)}>{label}</button>)}</div><select className={s.moreSelect} aria-label="Más herramientas financieras" value={advancedActive?tab:""} onChange={event=>event.target.value&&chooseTab(event.target.value)}><option value="">Más</option>{advancedTabs.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></div></header>
    {tab==="cash"?<div className={s.embeddedCash}><DailyCashWorkspace propertyId={propertyId} property={property} onNavigate={onNavigate} focusReservationId={focusReservationId} onFocusHandled={onFocusHandled}/></div>:tab==="dashboard"?<FinanceDashboard propertyId={propertyId}/>:tab==="payments"?<PaymentsPanel propertyId={propertyId}/>:tab==="automation"&&automationAllowed!==false?<PaymentAutomationPanel propertyId={propertyId}/>:tab==="online"?<OnlinePaymentsPanel propertyId={propertyId}/>:tab==="documents"?<DocumentsPanel propertyId={propertyId}/>:tab==="fiscal"?<FiscalLatamPanel propertyId={propertyId}/>:<ExpensesPanel propertyId={propertyId}/>} 
  </section>
}
