"use client"

import{useCallback,useEffect,useRef,useState}from"react"
import PmsSidebar from"./components/shell/PmsSidebar"
import PmsTopbar from"./components/shell/PmsTopbar"
import PmsBootScreen from"./components/boot/PmsBootScreen"
import DashboardWorkspace from"./features/dashboard/DashboardWorkspace"
import PlanningWorkspace from"./features/planning/PlanningWorkspace"
import ReservationsWorkspace from"./features/reservations/ReservationsWorkspace"
import GuestsWorkspace from"./features/guests/GuestsWorkspace"
import MessagesWorkspace from"./features/messages/MessagesWorkspace"
import OperationsWorkspace from"./features/operations/OperationsWorkspace"
import HousekeepingWorkspace from"./features/housekeeping/HousekeepingWorkspace"
import InventoryWorkspace from"./features/inventory/InventoryWorkspace"
import ServicesWorkspace from"./features/services/ServicesWorkspace"
import RatesWorkspace from"./features/rates/RatesWorkspace"
import FinanceWorkspace from"./features/finance/FinanceWorkspace"
import StaffWorkspace from"./features/staff/StaffWorkspace"
import SettingsWorkspace from"./features/settings/SettingsWorkspace"
import ReportsWorkspace from"./features/reports/ReportsWorkspace"
import IntegrationsWorkspace from"./features/integrations/IntegrationsWorkspace"
import usePmsSession from"./core/usePmsSession"
import{NAV_LABELS}from"./core/navigation"
import{persistTheme,readTheme}from"./core/theme"
import s from"./pms-next.module.css"

function AccessGate({status,error}){const unauth=status==="unauthenticated";return <div className={s.app} data-theme="light"><div className={s.accessGate}><div className={s.accessCard}><span className={s.brandMark}>HL</span><small>HABITACIÓN LLENA</small><h1>{unauth?"Iniciá sesión":"No pudimos abrir el PMS"}</h1><p>{unauth?"Ingresá con tu cuenta para acceder únicamente a las propiedades que tenés autorizadas.":status==="no-property"?"Tu usuario no tiene ninguna propiedad habilitada todavía.":error||"Revisá la conexión y volvé a intentar."}</p>{unauth&&<a href="/login">Ir a iniciar sesión</a>}{status==="error"&&<button type="button" onClick={()=>window.location.reload()}>Reintentar</button>}</div></div></div>}
function WorkspacePane({id,active,mounted,children}){if(!mounted)return null;return <div className={s.workspacePane} data-workspace={id} hidden={!active} aria-hidden={!active}>{children}</div>}

export default function PmsNextApp(){
  const[view,setView]=useState("dashboard"),[mountedViews,setMountedViews]=useState(()=>new Set(["dashboard"])),[theme,setTheme]=useState("light"),[bootChecked,setBootChecked]=useState(false),[bootDone,setBootDone]=useState(false)
  const viewRef=useRef("dashboard"),scrollPositions=useRef({}),session=usePmsSession()
  useEffect(()=>setTheme(readTheme()),[])

  useEffect(()=>{
    if(session.status!=="ready")return
    const key=`hl:pms:boot:${session.user?.id||"session"}`
    try{setBootDone(window.sessionStorage.getItem(key)==="1")}catch{setBootDone(false)}
    setBootChecked(true)
  },[session.status,session.user?.id])

  const completeBoot=useCallback(()=>{
    const key=`hl:pms:boot:${session.user?.id||"session"}`
    try{window.sessionStorage.setItem(key,"1")}catch{}
    setBootDone(true)
  },[session.user?.id])

  const activateView=useCallback((next,{historyMode="push",restoreScroll=true}={})=>{const safe=Object.prototype.hasOwnProperty.call(NAV_LABELS,next)?next:"dashboard";if(typeof window!=="undefined")scrollPositions.current[viewRef.current]=window.scrollY;viewRef.current=safe;setMountedViews(current=>{if(current.has(safe))return current;const nextSet=new Set(current);nextSet.add(safe);return nextSet});setView(safe);if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("view",safe);if(historyMode==="replace")window.history.replaceState({pmsView:safe},"",url);else if(historyMode==="push")window.history.pushState({pmsView:safe},"",url);if(restoreScroll)requestAnimationFrame(()=>window.scrollTo({top:scrollPositions.current[safe]||0,behavior:"auto"}))}},[])
  useEffect(()=>{if(typeof window==="undefined")return;const initial=new URL(window.location.href).searchParams.get("view");activateView(initial&&Object.prototype.hasOwnProperty.call(NAV_LABELS,initial)?initial:"dashboard",{historyMode:"replace",restoreScroll:false});const onPopState=()=>{const next=new URL(window.location.href).searchParams.get("view")||"dashboard";activateView(next,{historyMode:"none"})};window.addEventListener("popstate",onPopState);return()=>window.removeEventListener("popstate",onPopState)},[activateView])
  function toggleTheme(){setTheme(current=>{const next=current==="dark"?"light":"dark";persistTheme(next);return next})}

  if(session.status==="loading")return <PmsBootScreen ready={false}/>
  if(session.status!=="ready")return <AccessGate status={session.status} error={session.error}/>
  if(!bootChecked||!bootDone)return <PmsBootScreen ready={bootChecked} property={session.property} onComplete={bootChecked?completeBoot:undefined}/>

  const shared={propertyId:session.propertyId,property:session.property},isMounted=id=>mountedViews.has(id)
  const pane=(id,node)=><WorkspacePane id={id} active={view===id} mounted={isMounted(id)}>{node}</WorkspacePane>
  return <div className={s.app} data-theme={theme}><PmsSidebar view={view} onView={activateView} property={session.property} properties={session.properties} onProperty={session.selectProperty} user={session.user}/><main className={s.workspace}><PmsTopbar title={NAV_LABELS[view]||"Dashboard"} theme={theme} onToggleTheme={toggleTheme} onNewReservation={()=>activateView("planning")}/>
    {pane("dashboard",<DashboardWorkspace {...shared} onNavigate={activateView}/>)}{pane("planning",<PlanningWorkspace {...shared} onNavigate={activateView}/>)}{pane("reservations",<ReservationsWorkspace {...shared} onNavigate={activateView}/>)}{pane("guests",<GuestsWorkspace {...shared}/>)}{pane("messages",<MessagesWorkspace {...shared}/>)}{pane("maintenance",<OperationsWorkspace {...shared} initialTab="maintenance"/>)}{pane("tasks",<OperationsWorkspace {...shared} initialTab="tasks"/>)}{pane("requests",<OperationsWorkspace {...shared} initialTab="requests"/>)}{pane("housekeeping",<HousekeepingWorkspace {...shared}/>)}{pane("inventory",<InventoryWorkspace {...shared}/>)}{pane("services",<ServicesWorkspace {...shared}/>)}{pane("rates",<RatesWorkspace {...shared}/>)}{pane("finance",<FinanceWorkspace {...shared}/>)}{pane("reports",<ReportsWorkspace {...shared}/>)}{pane("staff",<StaffWorkspace {...shared}/>)}{pane("integrations",<IntegrationsWorkspace {...shared}/>)}{pane("settings",<SettingsWorkspace {...shared}/>)}</main></div>
}
