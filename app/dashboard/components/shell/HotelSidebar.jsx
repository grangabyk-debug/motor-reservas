"use client"

import { useMemo,useState } from "react"
import { HOTEL_NAVIGATION,groupForView } from "../../core/navigation"
import { ROLE_LABELS } from "../../core/permissions"
import ui from "./shell.module.css"
import polish from "./shell-polish.module.css"

export default function HotelSidebar({view,onView,hotelName="Habitación Llena",role="reception",properties=[],propertyId,onPropertyChange,onLogout,mobileOpen=false}){
  const initial=groupForView(view).id
  const [expanded,setExpanded]=useState(initial)
  const activeGroup=useMemo(()=>groupForView(view).id,[view])
  const open=expanded||activeGroup
  return <aside className={`${ui.sidebar} ${polish.premiumSidebar} ${mobileOpen?ui.open:""}`}>
    <div className={ui.leather}/><button className={`${ui.brand} ${polish.brandPremium}`} onClick={()=>onView("lobby")}><span>HL</span><div><b>{hotelName}</b><small>Hospitality Operating System</small></div></button>
    {properties.length>1&&<label className={ui.property}><small>PROPIEDAD</small><select value={propertyId} onChange={e=>onPropertyChange?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <nav className={ui.categories}>{HOTEL_NAVIGATION.map(group=><section key={group.id}><button className={`${ui.category} ${polish.categoryButton} ${activeGroup===group.id?ui.categoryActive:""}`} onClick={()=>setExpanded(open===group.id?"":group.id)}><i>{group.icon}</i><span><b>{group.label}</b><small>{group.description}</small></span><em>{open===group.id?"−":"+"}</em></button>{open===group.id&&<div className={ui.children}>{group.items.map(([id,label,icon])=><button key={id} className={`${polish.childButton} ${view===id?`${ui.active} ${polish.childActive}`:""}`} onClick={()=>onView(id)}><i>{icon}</i><span>{label}</span></button>)}</div>}</section>)}</nav>
    <div className={ui.role}><small>SESIÓN</small><b>{ROLE_LABELS[role]||role}</b></div><button className={ui.logout} onClick={onLogout}>Salir</button>
  </aside>
}
