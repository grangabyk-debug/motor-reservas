"use client"

import{useEffect,useState}from"react"
import PmsSidebar from"./components/shell/PmsSidebar"
import PmsTopbar from"./components/shell/PmsTopbar"
import DashboardWorkspace from"./features/dashboard/DashboardWorkspace"
import PlanningWorkspace from"./features/planning/PlanningWorkspace"
import ReservationsWorkspace from"./features/reservations/ReservationsWorkspace"
import GuestsWorkspace from"./features/guests/GuestsWorkspace"
import MessagesWorkspace from"./features/messages/MessagesWorkspace"
import OperationsWorkspace from"./features/operations/OperationsWorkspace"
import HousekeepingWorkspace from"./features/housekeeping/HousekeepingWorkspace"
import InventoryWorkspace from"./features/inventory/InventoryWorkspace"
import usePmsSession from"./core/usePmsSession"
import{NAV_LABELS}from"./core/navigation"
import{persistTheme,readTheme}from"./core/theme"
import s from"./pms-next.module.css"

function Placeholder({view}){
  return <section className={s.placeholder}><small>PRÓXIMO MÓDULO</small><h1>{NAV_LABELS[view]||"Módulo"}</h1><p>La función se habilitará cuando su flujo completo y persistencia estén listos. No mostramos controles ficticios.</p></section>
}

function AccessGate({status,error}){
  const loading=status==="loading"
  const unauth=status==="unauthenticated"
  return <div className={s.accessGate}><div className={s.accessCard}><span className={s.brandMark}>HL</span><small>HABITACIÓN LLENA</small><h1>{loading?"Cargando tu PMS":unauth?"Iniciá sesión":"No pudimos abrir el PMS"}</h1><p>{loading?"Validando usuario y propiedades autorizadas…":unauth?"El PMS muestra únicamente datos reales de las propiedades a las que tenés acceso.":status==="no-property"?"Tu usuario no tiene ninguna propiedad habilitada todavía.":error||"Revisá la conexión y volvé a intentar."}</p>{unauth&&<a href="/login">Ir a iniciar sesión</a>}{status==="error"&&<button type="button" onClick={()=>window.location.reload()}>Reintentar</button>}</div></div>
}

export default function PmsNextApp(){
  const[view,setView]=useState("dashboard")
  const[theme,setTheme]=useState("light")
  const session=usePmsSession()

  useEffect(()=>setTheme(readTheme()),[])
  function toggleTheme(){setTheme(current=>{const next=current==="dark"?"light":"dark";persistTheme(next);return next})}

  if(session.status!=="ready")return <div className={s.app} data-theme={theme}><AccessGate status={session.status} error={session.error}/></div>

  const shared={propertyId:session.propertyId,property:session.property}
  return <div className={s.app} data-theme={theme}>
    <PmsSidebar view={view} onView={setView} property={session.property} properties={session.properties} onProperty={session.selectProperty} user={session.user}/>
    <main className={s.workspace}>
      <PmsTopbar title={NAV_LABELS[view]||"Dashboard"} theme={theme} onToggleTheme={toggleTheme} onNewReservation={()=>setView("planning")}/>
      {view==="dashboard"?<DashboardWorkspace {...shared} onNavigate={setView}/>:view==="planning"?<PlanningWorkspace {...shared} onNavigate={setView}/>:view==="reservations"?<ReservationsWorkspace {...shared} onNavigate={setView}/>:view==="guests"?<GuestsWorkspace {...shared}/>:view==="messages"?<MessagesWorkspace {...shared}/>:view==="maintenance"?<OperationsWorkspace {...shared} initialTab="maintenance"/>:view==="tasks"?<OperationsWorkspace {...shared} initialTab="tasks"/>:view==="requests"?<OperationsWorkspace {...shared} initialTab="requests"/>:view==="housekeeping"?<HousekeepingWorkspace {...shared}/>:view==="inventory"?<InventoryWorkspace {...shared}/>:<Placeholder view={view}/>} 
    </main>
  </div>
}
