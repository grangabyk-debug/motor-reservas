"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{HOTEL_NAVIGATION,groupForView}from"../../core/navigation"
import{ROLE_LABELS}from"../../core/permissions"
import ui from"./shell.module.css"

function initials(name="Hotel"){return String(name).trim().split(/\s+/).map(part=>part[0]).join("").slice(0,2).toUpperCase()||"HL"}

function HotelIcon({name}){
  const common={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round",focusable:"false","aria-hidden":"true"}
  switch(name){
    case"frontdesk":return <svg {...common}><path d="M4 17h16"/><path d="M6.5 17v-2.2a5.5 5.5 0 0 1 11 0V17"/><path d="M12 7.3v2"/><path d="M10.2 7.3h3.6"/><circle cx="12" cy="5.2" r="1.2"/><path d="M3.5 20h17"/></svg>
    case"operations":return <svg {...common}><path d="M3.5 16.5V9.8a2 2 0 0 1 2-2h2.3a2 2 0 0 1 2 2v1.7h8.7a2 2 0 0 1 2 2v3"/><path d="M3.5 13.2h17"/><path d="M5.5 16.5v2M18.5 16.5v2"/></svg>
    case"commercial":case"rates":return <svg {...common}><path d="M4 18.5V14l4-3 3 2 6-7"/><path d="M14.5 6H17v2.5"/><path d="M4 20h16"/></svg>
    case"finance":case"cash":return <svg {...common}><path d="M4 7.5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2h11"/><path d="M16 12.5h4"/><circle cx="16" cy="12.5" r=".7"/></svg>
    case"hotel":case"lobby":return <svg {...common}><path d="M5 20V5.5L12 3l7 2.5V20"/><path d="M9 20v-4h6v4M8 8h1M12 8h1M16 8h1M8 11.5h1M12 11.5h1M16 11.5h1"/><path d="M3 20h18"/></svg>
    case"calendar":return <svg {...common}><rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M8 3.5v4M16 3.5v4M4 9.5h16"/><path d="M8 13h2M14 13h2M8 16h2"/></svg>
    case"reservations":return <svg {...common}><path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h3"/><path d="M4 7V3h12"/></svg>
    case"guests":return <svg {...common}><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.2 2.4-5 5.5-5s4.9 1.8 5.5 5"/><path d="M15.5 10.5h4v5h-4zM17.5 9v1.5"/></svg>
    case"keys":return <svg {...common}><circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M17 12v3M19.5 12v2"/></svg>
    case"rooms":return <svg {...common}><path d="M5 20V4h12v16"/><path d="M9 20v-6h8"/><circle cx="14" cy="9" r=".8"/><path d="M3 20h18"/></svg>
    case"housekeeping":return <svg {...common}><path d="M12 3l.9 2.5L15.5 6l-2.1 1.5.7 2.5L12 8.5 9.9 10l.7-2.5L8.5 6l2.6-.5L12 3z"/><path d="M6 12l.7 1.8 1.8.7-1.8.7L6 17l-.7-1.8-1.8-.7 1.8-.7L6 12zM17.5 12l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z"/></svg>
    case"maintenance":return <svg {...common}><path d="M14.5 5.5a4.5 4.5 0 0 0-5.7 5.7L4 16l4 4 4.8-4.8a4.5 4.5 0 0 0 5.7-5.7l-3 3-2-2 3-3z"/></svg>
    case"resources":return <svg {...common}><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M8 6V4h8v2M12 10v6M9 13h6"/></svg>
    case"twin":return <svg {...common}><path d="M4 7l8-4 8 4-8 4-8-4z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/></svg>
    case"packages":return <svg {...common}><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8v12M4 12h16"/><path d="M12 8H8.5a2 2 0 1 1 0-4C11 4 12 8 12 8zM12 8h3.5a2 2 0 1 0 0-4C13 4 12 8 12 8z"/></svg>
    case"partners":return <svg {...common}><rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2M4 11h16M10 14h4"/></svg>
    case"groups":case"team":return <svg {...common}><circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.2"/><path d="M3.5 19c.5-3.1 2.4-5 5.5-5 3.2 0 5 1.9 5.5 5M14.5 15c2.8-.8 5 .7 6 3"/></svg>
    case"upselling":case"intelligence":return <svg {...common}><path d="M12 3l1.1 3.2L16 7.3l-2.9 1.1L12 12l-1.1-3.6L8 7.3l2.9-1.1L12 3z"/><path d="M18 12l.8 2.2L21 15l-2.2.8L18 18l-.8-2.2L15 15l2.2-.8L18 12zM6 13l.7 1.8 1.8.7-1.8.7L6 18l-.7-1.8-1.8-.7 1.8-.7L6 13z"/></svg>
    case"distribution":case"integrations":return <svg {...common}><circle cx="6" cy="12" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 11l8-4M8 13l8 4"/></svg>
    case"billing":return <svg {...common}><path d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>
    case"reports":return <svg {...common}><path d="M5 20V10M10 20V5M15 20v-7M20 20V8"/><path d="M3 20h19"/></svg>
    case"automations":return <svg {...common}><path d="M13 2L5.5 13h6L11 22l7.5-11h-6L13 2z"/></svg>
    case"settings":return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19 13.5l1.5 1-2 3.5-1.8-.7a7 7 0 0 1-2.2 1.3L14.2 21h-4.4l-.3-2.4a7 7 0 0 1-2.2-1.3l-1.8.7-2-3.5 1.5-1a7 7 0 0 1 0-3l-1.5-1 2-3.5 1.8.7a7 7 0 0 1 2.2-1.3L9.8 3h4.4l.3 2.4a7 7 0 0 1 2.2 1.3l1.8-.7 2 3.5-1.5 1a7 7 0 0 1 0 3z"/></svg>
    case"support":return <svg {...common}><path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v4a2 2 0 0 0 2 2h2v-6H4zM20 13v4a2 2 0 0 1-2 2h-2v-6h4z"/><path d="M16 19c0 1.2-1.2 2-3 2h-1"/></svg>
    case"logout":return <svg {...common}><path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/></svg>
    default:return <svg {...common}><circle cx="12" cy="12" r="7"/><path d="M12 8v8M8 12h8"/></svg>
  }
}

export default function HotelSidebar({view,onView,hotelName="Hotel",hotelLogo="",role="reception",properties=[],propertyId,onPropertyChange,onLogout,mobileOpen=false}){
  const activeGroup=useMemo(()=>view==="support"?"":groupForView(view).id,[view])
  const[expanded,setExpanded]=useState("")
  const railRef=useRef(null)
  useEffect(()=>setExpanded(""),[view])
  useEffect(()=>{
    if(!expanded)return
    const closeOutside=event=>{if(railRef.current&&!railRef.current.contains(event.target))setExpanded("")}
    const closeEscape=event=>{if(event.key==="Escape")setExpanded("")}
    document.addEventListener("pointerdown",closeOutside,true)
    document.addEventListener("keydown",closeEscape)
    return()=>{document.removeEventListener("pointerdown",closeOutside,true);document.removeEventListener("keydown",closeEscape)}
  },[expanded])
  function openView(id){setExpanded("");onView(id)}

  return <aside ref={railRef} className={`${ui.rail} ${mobileOpen?ui.railOpen:""}`} data-hl-rail="true" aria-label="Navegación de Habitación Llena">
    <div className={ui.railTop}>
      <button type="button" className={ui.railHome} onClick={()=>openView("lobby")} data-tip={hotelName} aria-label={`Ir al inicio de ${hotelName}`}>
        {hotelLogo?<span className={ui.hotelMark}><img src={hotelLogo} alt=""/></span>:<span className={ui.hotelMark}>{initials(hotelName)}</span>}
        <span className={ui.mobileHotelText}><b>{hotelName}</b><small>Habitación Llena</small></span>
      </button>
      {properties.length>1&&<label className={ui.hotelSwitch} data-tip="Cambiar propiedad">
        <span aria-hidden="true">⌂</span>
        <select aria-label="Cambiar propiedad" value={propertyId} onChange={e=>onPropertyChange?.(e.target.value)}>{properties.map(item=><option key={item.id} value={item.id}>{item.hotel_name||item.name}</option>)}</select>
      </label>}
    </div>

    <nav className={ui.moduleList} aria-label="Módulos del hotel">
      {HOTEL_NAVIGATION.map(group=><div key={group.id} className={ui.moduleItem}>
        <button type="button" className={`${ui.moduleButton} ${activeGroup===group.id?ui.moduleButtonActive:""}`} data-tip={group.label} aria-label={group.label} aria-expanded={expanded===group.id} onClick={()=>setExpanded(current=>current===group.id?"":group.id)}>
          <i className={ui.moduleGlyph} aria-hidden="true"><HotelIcon name={group.id}/></i>
          <span className={ui.mobileModuleText}><b>{group.label}</b><small>{group.description}</small></span>
          <span className={ui.mobileChevron} aria-hidden="true">›</span>
        </button>
        {expanded===group.id&&<div className={ui.moduleFlyout} role="menu" aria-label={group.label}>
          <header><small>MÓDULO</small><b>{group.label}</b><span>{group.description}</span></header>
          <div>{group.items.map(([id,label])=><button type="button" role="menuitem" key={id} className={view===id?ui.flyoutActive:""} onClick={()=>openView(id)}><i className={ui.flyoutGlyph} aria-hidden="true"><HotelIcon name={id}/></i><span>{label}</span>{view===id&&<em aria-hidden="true">●</em>}</button>)}</div>
        </div>}
      </div>)}
    </nav>

    <footer className={ui.railBottom}>
      <button type="button" className={`${ui.railUtility} ${view==="support"?ui.railUtilityActive:""}`} data-tip="Ayuda & soporte" aria-label="Ayuda y soporte" onClick={()=>openView("support")}><span className={ui.utilityGlyph} aria-hidden="true"><HotelIcon name="support"/></span><b>Ayuda & soporte</b></button>
      <div className={ui.sessionMark} data-tip={ROLE_LABELS[role]||role} aria-label={`Sesión: ${ROLE_LABELS[role]||role}`}><span>{initials(ROLE_LABELS[role]||role)}</span><b>{ROLE_LABELS[role]||role}</b></div>
      <button type="button" className={ui.railUtility} data-tip="Salir" aria-label="Salir" onClick={onLogout}><span className={ui.utilityGlyph} aria-hidden="true"><HotelIcon name="logout"/></span><b>Salir</b></button>
      <div className={ui.countryMark} data-tip="Hecho en Argentina" aria-label="Hecho en Argentina"><i aria-hidden="true"/><b>Hecho en Argentina</b></div>
    </footer>
  </aside>
}
