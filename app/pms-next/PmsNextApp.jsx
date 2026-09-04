"use client"

import{useEffect,useState}from"react"
import PmsSidebar from"./components/shell/PmsSidebar"
import PmsTopbar from"./components/shell/PmsTopbar"
import DashboardWorkspace from"./features/dashboard/DashboardWorkspace"
import PlanningWorkspace from"./features/planning/PlanningWorkspace"
import{NAV_LABELS}from"./core/navigation"
import{persistTheme,readTheme}from"./core/theme"
import s from"./pms-next.module.css"

function Placeholder({view}){
  return <section className={s.placeholder}><small>MÓDULO EN CONSTRUCCIÓN</small><h1>{NAV_LABELS[view]||"Módulo"}</h1><p>Este módulo pertenece al PMS nuevo y se construye de forma independiente, sin reutilizar la interfaz anterior.</p></section>
}

export default function PmsNextApp(){
  const[view,setView]=useState("dashboard")
  const[theme,setTheme]=useState("light")

  useEffect(()=>setTheme(readTheme()),[])
  function toggleTheme(){setTheme(current=>{const next=current==="dark"?"light":"dark";persistTheme(next);return next})}

  return <div className={s.app} data-theme={theme}>
    <PmsSidebar view={view} onView={setView} hotelName="Hotel Demo"/>
    <main className={s.workspace}>
      <PmsTopbar title={NAV_LABELS[view]||"Dashboard"} theme={theme} onToggleTheme={toggleTheme} onNewReservation={()=>setView("planning")}/>
      {view==="dashboard"?<DashboardWorkspace onNavigate={setView}/>:view==="planning"?<PlanningWorkspace/>:<Placeholder view={view}/>} 
    </main>
  </div>
}
