"use client"

import{useCallback,useEffect,useMemo,useRef,useState}from"react"
import PmsSidebar from"./components/shell/PmsSidebar"
import PmsTopbar from"./components/shell/PmsTopbar"
import PmsBootScreen from"./components/boot/PmsBootScreen"
import PmsUpdateNotice from"./components/system/PmsUpdateNotice"
import PmsGlobalSearch from"./components/system/PmsGlobalSearch"
import PmsToastHost from"./components/system/PmsToastHost"
import PaymentAlertWatcher from"./components/system/PaymentAlertWatcher"
import DashboardWorkspace from"./features/dashboard/DashboardWorkspace"
import PlanningWorkspace from"./features/planning/PlanningWorkspace"
import ReservationsWorkspace from"./features/reservations/ReservationsWorkspace"
import QuotesWorkspace from"./features/quotes/QuotesWorkspace"
import GuestsWorkspace from"./features/guests/GuestsWorkspace"
import MessagesWorkspace from"./features/messages/MessagesWorkspace"
import OperationsWorkspace from"./features/operations/OperationsWorkspace"
import HousekeepingWorkspace from"./features/housekeeping/HousekeepingWorkspace"
import InventoryWorkspace from"./features/inventory/InventoryWorkspace"
import ServicesWorkspace from"./features/services/ServicesWorkspace"
import RatesWorkspace from"./features/rates/RatesWorkspace"
import FinanceWorkspace from"./features/finance/FinanceWorkspace"
import GrowthWorkspace from"./features/growth/GrowthWorkspace"
import StaffWorkspace from"./features/staff/StaffWorkspace"
import SettingsWorkspace from"./features/settings/SettingsWorkspace"
import ReportsWorkspace from"./features/reports/ReportsWorkspace"
import AuditWorkspace from"./features/audit/AuditWorkspace"
import IntegrationsWorkspace from"./features/integrations/IntegrationsWorkspace"
import SupportWorkspace from"./features/support/SupportWorkspace"
import usePmsSession from"./core/usePmsSession"
import usePropertyFeatureFlags from"./core/usePropertyFeatureFlags"
import{canOpenView,getAllowedViews,NAV_LABELS,VIEW_DESCRIPTIONS}from"./core/navigation"
import{persistTheme,readTheme}from"./core/theme"
import s from"./pms-next.module.css"
import visual from"./pms-visual-system.module.css"

function AccessGate({status,error}){const unauth=status==="unauthenticated";return <div className={`${s.app} ${visual.system}`} data-theme="light"><div className={s.accessGate}><div className={s.accessCard}><span className={s.brandMark}>HL</span><small>HABITACIÓN LLENA</small><h1>{unauth?"Iniciá sesión":"No pudimos abrir el PMS"}</h1><p>{unauth?"Ingresá con tu cuenta para acceder únicamente a las propiedades que tenés autorizadas.":status==="no-property"?"Tu usuario no tiene ninguna propiedad habilitada todavía.":error||"Revisá la conexión y volvé a intentar."}</p>{unauth&&<a href="/login">Ir a iniciar sesión</a>}{status==="error"&&<button type="button" onClick={()=>window.location.reload()}>Reintentar</button>}</div></div></div>}
function WorkspacePane({id,active,mounted,children}){if(!mounted)return null;return <div className={s.workspacePane} data-workspace={id} hidden={!active} aria-hidden={!active}>{children}</div>}

export default function PmsNextApp({buildId="local"}){
  const[view,setView]=useState("dashboard"),[mountedViews,setMountedViews]=useState(()=>new Set(["dashboard"])),[theme,setTheme]=useState("light"),[bootChecked,setBootChecked]=useState(false),[bootDone,setBootDone]=useState(false),[reservationFocus,setReservationFocus]=useState(null),[newReservationRequest,setNewReservationRequest]=useState(0),[searchOpen,setSearchOpen]=useState(false)
  const viewRef=useRef("dashboard"),scrollPositions=useRef({}),session=usePmsSession()
  const featureState=usePropertyFeatureFlags(session.propertyId)
  const rolePermissions=featureState.settings?.role_permissions||{}
  const role=session.property?.role||"member"
  const allowedViews=useMemo(()=>getAllowedViews(role,featureState.flags,rolePermissions),[role,featureState.flags,rolePermissions])
  const allowedSet=useMemo(()=>new Set(allowedViews),[allowedViews])
  useEffect(()=>setTheme(readTheme()),[])
  useEffect(()=>{const handler=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setSearchOpen(true)}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler)},[])
  useEffect(()=>{if(session.status!=="ready")return;const key=`hl:pms:boot:${session.user?.id||"session"}`;try{setBootDone(window.sessionStorage.getItem(key)==="1")}catch{setBootDone(false)}setBootChecked(true)},[session.status,session.user?.id])
  const completeBoot=useCallback(()=>{const key=`hl:pms:boot:${session.user?.id||"session"}`;try{window.sessionStorage.setItem(key,"1")}catch{}setBootDone(true)},[session.user?.id])
  const activateView=useCallback((requested,{historyMode="push",restoreScroll=true,reservationId=null}={})=>{const next=canOpenView(role,requested,featureState.flags,rolePermissions)?requested:"dashboard";if(next==="reservations"&&reservationId!=null)setReservationFocus(Number(reservationId));if(typeof window!=="undefined")scrollPositions.current[viewRef.current]=window.scrollY;viewRef.current=next;setMountedViews(current=>{if(current.has(next))return current;const nextSet=new Set(current);nextSet.add(next);return nextSet});setView(next);if(typeof window!=="undefined"){const url=new URL(window.location.href);url.searchParams.set("view",next);if(historyMode==="replace")window.history.replaceState({pmsView:next},"",url);else if(historyMode==="push")window.history.pushState({pmsView:next},"",url);if(restoreScroll)requestAnimationFrame(()=>window.scrollTo({top:scrollPositions.current[next]||0,behavior:"auto"}))}},[role,featureState.flags,rolePermissions])
  const startNewReservation=useCallback(()=>{if(typeof window!=="undefined"&&session.propertyId)try{window.localStorage.removeItem(`hl:pms-next:reservation-draft:${session.propertyId}`)}catch{}activateView("planning");setNewReservationRequest(value=>value+1)},[activateView,session.propertyId])
  useEffect(()=>{if(typeof window==="undefined"||session.status!=="ready"||featureState.status==="loading")return;const initial=new URL(window.location.href).searchParams.get("view")||"dashboard";activateView(initial,{historyMode:"replace",restoreScroll:false});const onPopState=()=>activateView(new URL(window.location.href).searchParams.get("view")||"dashboard",{historyMode:"none"});window.addEventListener("popstate",onPopState);return()=>window.removeEventListener("popstate",onPopState)},[activateView,session.status,featureState.status])
  useEffect(()=>{if(session.status!=="ready"||featureState.status==="loading")return;if(!canOpenView(role,view,featureState.flags,rolePermissions))activateView("dashboard",{historyMode:"replace"})},[session.status,role,featureState.status,featureState.flags,rolePermissions,view,activateView])
  function toggleTheme(){setTheme(current=>{const next=current==="dark"?"light":"dark";persistTheme(next);return next})}
  if(session.status==="loading")return <PmsBootScreen ready={false}/>
  if(session.status!=="ready")return <AccessGate status={session.status} error={session.error}/>
  if(!bootChecked||!bootDone)return <PmsBootScreen ready={bootChecked} property={session.property} onComplete={bootChecked?completeBoot:undefined}/>
  const shared={propertyId:session.propertyId,property:session.property},isMounted=id=>mountedViews.has(id),pane=(id,node)=>allowedSet.has(id)?<WorkspacePane id={id} active={view===id} mounted={isMounted(id)}>{node}</WorkspacePane>:null
  return <div className={`${s.app} ${visual.system}`} data-theme={theme}><style>{`[data-workspace] > section > header p{display:none!important}`}</style><PmsSidebar view={view} onView={activateView} property={session.property} properties={session.properties} onProperty={session.selectProperty} user={session.user} featureFlags={featureState.flags} rolePermissions={rolePermissions} buildId={buildId}/><main className={s.workspace}><PmsTopbar title={NAV_LABELS[view]||"Dashboard"} info={VIEW_DESCRIPTIONS[view]||""} theme={theme} onToggleTheme={toggleTheme} onNewReservation={allowedSet.has("planning")?startNewReservation:null} onNewQuote={allowedSet.has("quotes")?()=>activateView("quotes"):null} onOpenSearch={()=>setSearchOpen(true)} onOpenActivity={allowedSet.has("audit")?()=>activateView("audit"):null} onOpenSupport={allowedSet.has("support")?()=>activateView("support"):null} timeZone={featureState.settings?.preferences?.timezone}/>{pane("dashboard",<DashboardWorkspace {...shared} onNavigate={activateView} allowedViews={allowedViews}/>)}{pane("planning",<PlanningWorkspace {...shared} onNavigate={activateView} newReservationRequest={newReservationRequest}/>)}{pane("reservations",<ReservationsWorkspace {...shared} onNavigate={activateView} focusReservationId={reservationFocus} onFocusHandled={()=>setReservationFocus(null)}/>)}{pane("quotes",<QuotesWorkspace {...shared} onNavigate={activateView}/>)}{pane("guests",<GuestsWorkspace {...shared}/>)}{pane("messages",<MessagesWorkspace {...shared}/>)}{pane("maintenance",<OperationsWorkspace {...shared} initialTab="maintenance"/>)}{pane("tasks",<OperationsWorkspace {...shared} initialTab="tasks"/>)}{featureState.flags.guest_requests&&pane("requests",<OperationsWorkspace {...shared} initialTab="requests"/>)}{pane("housekeeping",<HousekeepingWorkspace {...shared}/>)}{pane("inventory",<InventoryWorkspace {...shared}/>)}{pane("services",<ServicesWorkspace {...shared}/>)}{pane("rates",<RatesWorkspace {...shared}/>)}{pane("finance",<FinanceWorkspace {...shared}/>)}{pane("growth",<GrowthWorkspace {...shared}/>)}{pane("reports",<ReportsWorkspace {...shared}/>)}{pane("audit",<AuditWorkspace {...shared}/>)}{pane("staff",<StaffWorkspace {...shared}/>)}{pane("integrations",<IntegrationsWorkspace {...shared}/>)}{pane("settings",<SettingsWorkspace {...shared}/>)}{pane("support",<SupportWorkspace {...shared}/>)}</main><PmsGlobalSearch open={searchOpen} onClose={()=>setSearchOpen(false)} propertyId={session.propertyId} onNavigate={activateView} allowedViews={allowedViews}/><PaymentAlertWatcher propertyId={session.propertyId}/><PmsToastHost/><PmsUpdateNotice buildId={buildId}/></div>
}
