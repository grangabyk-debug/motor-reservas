"use client"

import{useEffect,useMemo,useState}from"react"
import{HOTEL_NAVIGATION,groupForView}from"../../core/navigation"
import{ROLE_LABELS}from"../../core/permissions"
import ui from"./shell.module.css"

function initials(name="Hotel"){return String(name).trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"HL"}

export default function HotelSidebar({view,onView,hotelName="Hotel",hotelLogo="",role="reception",properties=[],propertyId,onPropertyChange,onLogout,mobileOpen=false}){
  const activeGroup=useMemo(()=>view==="support"?"":groupForView(view).id,[view]),[expanded,setExpanded]=useState("")
  useEffect(()=>setExpanded(""),[view])
  function openView(id){onView(id);setExpanded("")}
  return <aside className={`${ui.sidebar} ${mobileOpen?ui.open:""}`}>
    <button className={ui.brand} onClick={()=>openView("lobby")} data-tooltip={hotelName} aria-label={`Ir al inicio de ${hotelName}`}>{hotelLogo?<span className={ui.hotelLogo}><img src={hotelLogo} alt={`Logo de ${hotelName}`}/></span>:<span>{initials(hotelName)}</span>}<div><b>{hotelName}</b><small>Habitación Llena</small></div></button>
    {properties.length>1&&<label className={ui.property} data-tooltip="Cambiar propiedad"><span>⌂</span><select aria-label="Cambiar propiedad" value={propertyId} onChange={e=>onPropertyChange?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.hotel_name||item.name}</option>)}</select></label>}
    <nav className={ui.categories} aria-label="Navegación principal">
      {HOTEL_NAVIGATION.map(group=><section key={group.id} className={ui.group}>
        <button className={`${ui.category} ${activeGroup===group.id?ui.categoryActive:""}`} data-tooltip={group.label} aria-label={group.label} aria-expanded={expanded===group.id} onClick={()=>setExpanded(current=>current===group.id?"":group.id)}><i>{group.icon}</i><span className={ui.categoryLabel}><b>{group.label}</b><small>{group.description}</small></span><em>›</em></button>
        {expanded===group.id&&<div className={ui.groupMenu}>
          <header><small>MÓDULO</small><b>{group.label}</b><span>{group.description}</span></header>
          <div>{group.items.map(([id,label,icon])=><button key={id} className={view===id?ui.active:""} onClick={()=>openView(id)}><i>{icon}</i><span>{label}</span>{view===id&&<em>●</em>}</button>)}</div>
        </div>}
      </section>)}
    </nav>
    <div className={ui.sidebarFooter}>
      <button className={`${ui.supportLink} ${view==="support"?ui.supportActive:""}`} data-tooltip="Ayuda & soporte" onClick={()=>openView("support")}><i>?</i><span><b>Ayuda & soporte</b><small>FAQ y ayuda humana</small></span></button>
      <div className={ui.role} data-tooltip={ROLE_LABELS[role]||role}><i>{initials(ROLE_LABELS[role]||role)}</i><span><small>SESIÓN</small><b>{ROLE_LABELS[role]||role}</b></span></div>
      <button className={ui.logout} data-tooltip="Salir" onClick={onLogout} aria-label="Salir">↪<span>Salir</span></button>
      <div className={ui.argentina} title="Hecho en Argentina"><i/><span>Hecho en Argentina</span></div>
    </div>
  </aside>
}
