"use client"

import{useMemo,useState}from"react"
import{MANAGEMENT_NAV,OPERATIONS_NAV,PRIMARY_NAV}from"../../core/navigation"
import PmsIcon from"./PmsIcons"
import glass from"./pmsGlassShell.module.css"

const COLORS={dashboard:"#5b6cf3",planning:"#2797ff",reservations:"#8a63e8",quotes:"#d79a31",guests:"#ed6b8f",messages:"#20ad7a",tasks:"#ea7a37",requests:"#e65d68",housekeeping:"#21a8a0",maintenance:"#e09533",inventory:"#597fda",services:"#b268dc",rates:"#4b9c72",finance:"#2a9b64",onboarding:"#6181dc",website:"#5d8ee7",growth:"#45a16f",reports:"#7c68d8",audit:"#596f9d",staff:"#dd718f",integrations:"#557ed1",settings:"#7a8497",support:"#20a18f"}
const ALL=[...PRIMARY_NAV,...OPERATIONS_NAV,...MANAGEMENT_NAV]
const DOCK_IDS=["dashboard","planning","reservations","guests"]

function NavButton({item,active,onClick,compact=false}){
  return <button type="button" className={`${compact?glass.mobileSheetItem:glass.mobileDockItem} ${active?glass.mobileDockActive:""}`} style={{"--mobile-icon":COLORS[item.id]||"var(--accent)"}} onClick={onClick} aria-current={active?"page":undefined}><span className={glass.mobileIcon}><PmsIcon name={item.icon} size={compact?17:18}/></span><span>{item.label}</span></button>
}

export default function PmsMobileNav({view,onView,allowedViews=[]}){
  const[open,setOpen]=useState(false),allowed=useMemo(()=>new Set(allowedViews),[allowedViews])
  const dock=useMemo(()=>DOCK_IDS.map(id=>ALL.find(item=>item.id===id)).filter(item=>item&&allowed.has(item.id)),[allowed])
  const extras=useMemo(()=>ALL.filter(item=>allowed.has(item.id)&&!DOCK_IDS.includes(item.id)),[allowed])
  const moreActive=!DOCK_IDS.includes(view)
  function go(id){setOpen(false);onView?.(id)}
  if(!dock.length)return null
  return <>
    {open?<><button type="button" className={glass.mobileSheetBackdrop} aria-label="Cerrar menú" onClick={()=>setOpen(false)}/><section className={glass.mobileSheet} aria-label="Más secciones"><header><div><small>HABITACIÓN LLENA</small><b>Más secciones</b></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar">×</button></header><div className={glass.mobileSheetGrid}>{extras.map(item=><NavButton key={item.id} item={item} active={view===item.id} compact onClick={()=>go(item.id)}/>)}</div></section></>:null}
    <nav className={glass.mobileDock} aria-label="Navegación principal móvil">{dock.map(item=><NavButton key={item.id} item={item} active={view===item.id} onClick={()=>go(item.id)}/>)}{extras.length?<button type="button" className={`${glass.mobileDockItem} ${moreActive?glass.mobileDockActive:""}`} style={{"--mobile-icon":"#7a8497"}} onClick={()=>setOpen(value=>!value)} aria-expanded={open}><span className={glass.mobileIcon}><PmsIcon name="sliders" size={18}/></span><span>Más</span></button>:null}</nav>
  </>
}
