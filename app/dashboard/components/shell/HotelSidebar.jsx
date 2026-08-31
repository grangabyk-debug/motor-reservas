"use client"

import { useEffect,useMemo,useState } from "react"
import { HOTEL_NAVIGATION,groupForView } from "../../core/navigation"
import { ROLE_LABELS } from "../../core/permissions"
import ui from "./shell.module.css"
import polish from "./shell-polish.module.css"

function initials(name="Hotel"){return String(name).trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"HL"}

export default function HotelSidebar({view,onView,hotelName="Hotel",hotelLogo="",role="reception",properties=[],propertyId,onPropertyChange,onLogout,mobileOpen=false}){
  const activeGroup=useMemo(()=>view==="support"?"":groupForView(view).id,[view]),[expanded,setExpanded]=useState(()=>activeGroup)
  useEffect(()=>setExpanded(view==="support"?"":activeGroup),[view,activeGroup])
  return <aside className={`${ui.sidebar} ${polish.premiumSidebar} ${mobileOpen?ui.open:""}`}>
    <div className={ui.leather}/><button className={`${ui.brand} ${polish.brandPremium}`} onClick={()=>onView("lobby")}>{hotelLogo?<span className={ui.hotelLogo}><img src={hotelLogo} alt={`Logo de ${hotelName}`}/></span>:<span>{initials(hotelName)}</span>}<div><b>{hotelName}</b></div></button>
    {properties.length>1&&<label className={ui.property}><small>PROPIEDAD</small><select value={propertyId} onChange={e=>onPropertyChange?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.hotel_name||item.name}</option>)}</select></label>}
    <nav className={ui.categories}>{HOTEL_NAVIGATION.map(group=><section key={group.id}><button className={`${ui.category} ${polish.categoryButton} ${activeGroup===group.id?ui.categoryActive:""}`} onClick={()=>setExpanded(current=>current===group.id?"":group.id)}><i>{group.icon}</i><span><b>{group.label}</b><small>{group.description}</small></span><em>{expanded===group.id?"−":"+"}</em></button>{expanded===group.id&&<div className={ui.children}>{group.items.map(([id,label,icon])=><button key={id} className={`${polish.childButton} ${view===id?`${ui.active} ${polish.childActive}`:""}`} onClick={()=>onView(id)}><i>{icon}</i><span>{label}</span></button>)}</div>}</section>)}</nav>
    <div className={ui.sidebarFooter}>
      <button className={`${ui.supportLink} ${view==="support"?ui.supportActive:""}`} onClick={()=>onView("support")}><i>?</i><span><b>Ayuda & soporte</b><small>FAQ y ayuda humana</small></span><em>→</em></button>
      <div className={ui.role}><small>SESIÓN</small><b>{ROLE_LABELS[role]||role}</b></div>
      <button className={ui.logout} onClick={onLogout}>Salir</button>
      <div className={ui.productSignature}>© HabitaciónLlena.com</div>
    </div>
  </aside>
}
