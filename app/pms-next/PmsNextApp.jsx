"use client"

import{useCallback,useEffect,useRef,useState}from"react"
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
import RatesWorkspace from"./features/rates/RatesWorkspace"
import FinanceWorkspace from"./features/finance/FinanceWorkspace"
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

function WorkspacePane({id,active,mounted,children}){
  if(!mounted)return null
  return <div className={s.workspacePane} data-workspace={id} hidden={!active} aria-hidden={!active}>{children}</div>
}

export default function PmsNextApp(){
  const[view,setView]=useState("dashboard")
  const[mountedViews,setMountedViews]=useState(()=>new Set(["dashboard"]))
  const[theme,setTheme]=useState("light")
  const scrollPositions=useRef({})
  const session=usePmsSession()

  useEffect(()=>setTheme(readTheme()),[])

  const activateView=useCallback((next,{historyMode="push",restoreScroll=true}={})=>{
    const safe=Object.prototype.hasOwnProperty.call(NAV_LABELS,next)?next:"dashboard"
    if(typeof window!=="undefined")scrollPositions.current[view]=window.scrollY
    setMountedViews(current=>{if(current.has(safe))return current;const nextSet=new Set(current);nextSet.add(safe);return nextSet})
    setView(safe)
    if(typeof window!=="undefined"){
      const url=new URL(window.location.href);url.searchParams.set("view",safe)
      if(historyMode==="replace")window.history.replaceState({pmsView:safe},"",url)
      else if(historyMode==="push")window.history.pushState({pmsView:safe},"",url)
      if(restoreScroll)requestAnimationFrame(()=>window.scrollTo({top:scrollPositions.current[safe]||0,behavior:"instant"}))
    }
  },[view])

  useEffect(()=>{
    if(typeof window==="undefined")return
    const initial=new URL(window.location.href).searchParams.get("view")
    if(initial&&Object.prototype.hasOwnProperty.call(NAV_LABELS,initial))activateView(initial,{historyMode:"replace",restoreScroll:false})
    else activateView("dashboard",{historyMode:"replace",restoreScroll:false})
    const onPopState=()=>{const next=new URL(window.location.href).searchParams.get("view")||"dashboard";activateView(next,{historyMode:"none"})}
    window.addEventListener("popstate",onPopState)
    return()=>window.removeEventListener("popstate",onPopState)
  },[])

  function toggleTheme(){setTheme(current=>{const next=current==="dark"?"light":"dark";persistTheme(next);return next})}

  if(session.status!=="ready")return <div className={s.app} data-theme={theme}><AccessGate status={session.status} error={session.error}/></div>

  const shared={propertyId:session.propertyId,property:session.property}
  const isMounted=id=>mountedViews.has(id)

  return <div className={s.app} data-theme={theme}>
    <PmsSidebar view={view} onView={activateView} property={session.property} properties={session.properties} onProperty={session.selectProperty} user={session.user}/>
    <main className={s.workspace}>
      <PmsTopbar title={NAV_LABELS[view]||"Dashboard"} theme={theme} onToggleTheme={toggleTheme} onNewReservation={()=>activateView("planning")}/>

      <WorkspacePane id="dashboard" active={view==="dashboard"} mounted={isMounted("dashboard")}><DashboardWorkspace {...shared} onNavigate={activateView}/></WorkspacePane>
      <WorkspacePane id="planning" active={view==="planning"} mounted={isMounted("planning")}><PlanningWorkspace {...shared} onNavigate={activateView}/></WorkspacePane>
      <WorkspacePane id="reservations" active={view==="reservations"} mounted={isMounted("reservations")}><ReservationsWorkspace {...shared} onNavigate={activateView}/></WorkspacePane>
      <WorkspacePane id="guests" active={view==="guests"} mounted={isMounted("guests")}><GuestsWorkspace {...shared}/></WorkspacePane>
      <WorkspacePane id="messages" active={view==="messages"} mounted={isMounted("messages")}><MessagesWorkspace {...shared}/></WorkspacePane>
      <WorkspacePane id="maintenance" active={view==="maintenance"} mounted={isMounted("maintenance")}><OperationsWorkspace {...shared} initialTab="maintenance"/></WorkspacePane>
      <WorkspacePane id="tasks" active={view==="tasks"} mounted={isMounted("tasks")}><OperationsWorkspace {...shared} initialTab="tasks"/></WorkspacePane>
      <WorkspacePane id="requests" active={view==="requests"} mounted={isMounted("requests")}><OperationsWorkspace {...shared} initialTab="requests"/></WorkspacePane>
      <WorkspacePane id="housekeeping" active={view==="housekeeping"} mounted={isMounted("housekeeping")}><HousekeepingWorkspace {...shared}/></WorkspacePane>
      <WorkspacePane id="inventory" active={view==="inventory"} mounted={isMounted("inventory")}><InventoryWorkspace {...shared}/></WorkspacePane>
      <WorkspacePane id="rates" active={view==="rates"} mounted={isMounted("rates")}><RatesWorkspace {...shared}/></WorkspacePane>
      <WorkspacePane id="finance" active={view==="finance"} mounted={isMounted("finance")}><FinanceWorkspace {...shared}/></WorkspacePane>
      {["reports","staff","integrations","settings"].map(id=><WorkspacePane key={id} id={id} active={view===id} mounted={isMounted(id)}><Placeholder view={id}/></WorkspacePane>)}
    </main>
  </div>
}
