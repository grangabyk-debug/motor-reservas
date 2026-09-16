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
import AccountsReceivablePanel from"./AccountsReceivablePanel"
import s from"./finance.module.css"
import hotel from"./financeHotelOs.module.css"
import menu from"./financeMoreMenu.module.css"

const PRIMARY_TABS=[["cash","Caja"],["dashboard","Resumen"],["payments","Cobros"],["documents","Facturación"],["expenses","Gastos"]]
const ADVANCED_TABS=[["accounts","Empresas y cuentas"],["automation","Automatización"],["online","Cobros online"],["fiscal","Fiscal"]]
const ADVANCED_HINT={accounts:"Crédito y saldos",automation:"Reglas de cobro",online:"Pasarelas y links",fiscal:"Configuración fiscal"}

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
  function chooseAdvanced(event,id){chooseTab(id);event.currentTarget.closest("details")?.removeAttribute("open")}
  function navigate(next,options={}){if(onNavigate)return onNavigate(next,options);if(typeof window==="undefined")return;const url=new URL(window.location.href);url.searchParams.set("view",next);if(next==="reservations"&&options.reservationId!=null)url.searchParams.set("reservation",String(options.reservationId));window.history.pushState({pmsView:next},"",url);window.dispatchEvent(new PopStateEvent("popstate"))}

  return <section className={`${s.page} ${hotel.financeOs}`}>
    <style>{`[data-finance-cash-embed] > section{padding:0!important;min-height:0!important}[data-finance-cash-embed] > section > header{margin-bottom:14px!important;justify-content:flex-end!important}[data-finance-cash-embed] > section > header > div:first-child{display:none!important}`}</style>
    <header className={s.header}><div><small>CAJA Y FINANZAS</small><h1>Caja y finanzas</h1><p>{property?.name||"Propiedad activa"} · caja diaria, cobros, facturación, gastos y control financiero desde un solo lugar.</p></div><div className={s.toolbar}><div className={s.tabs}>{PRIMARY_TABS.map(([id,label])=><button key={id} aria-pressed={tab===id} className={tab===id?s.active:""} onClick={()=>chooseTab(id)}>{label}</button>)}</div><details className={menu.moreMenu}><summary>{advancedActive?allTabs.find(([id])=>id===tab)?.[1]||"Más":"Más"}</summary><div className={menu.popover}>{advancedTabs.map(([id,label])=><button type="button" key={id} data-active={tab===id} onClick={event=>chooseAdvanced(event,id)}><b>{label}</b><span>{ADVANCED_HINT[id]}</span></button>)}</div></details></div></header>
    {tab==="cash"?<div data-finance-cash-embed><DailyCashWorkspace propertyId={propertyId} property={property} onNavigate={navigate} focusReservationId={focusReservationId} onFocusHandled={onFocusHandled}/></div>:tab==="dashboard"?<FinanceDashboard propertyId={propertyId}/>:tab==="payments"?<PaymentsPanel propertyId={propertyId}/>:tab==="accounts"?<AccountsReceivablePanel propertyId={propertyId} onNavigate={navigate}/>:tab==="automation"&&automationAllowed!==false?<PaymentAutomationPanel propertyId={propertyId}/>:tab==="online"?<OnlinePaymentsPanel propertyId={propertyId}/>:tab==="documents"?<DocumentsPanel propertyId={propertyId}/>:tab==="fiscal"?<FiscalLatamPanel propertyId={propertyId}/>:<ExpensesPanel propertyId={propertyId}/>} 
  </section>
}