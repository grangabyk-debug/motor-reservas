"use client"

import{usePathname}from"next/navigation"
import"./admin-glass.css"

function Icon({name}){const p={width:18,height:18,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.9",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true};return name==="back"?<svg {...p}><path d="M19 12H5M10 7l-5 5 5 5"/></svg>:<svg {...p}><path d="M12 5v14M5 12h14"/></svg>}

export default function PlatformAdminLayout({children}){
  const path=usePathname(),creating=path?.startsWith("/pms-admin/nuevo")
  return <div className="hl-admin-shell">{children}<a href={creating?"/pms-admin":"/pms-admin/nuevo"} className="hl-admin-fab"><Icon name={creating?"back":"plus"}/>{creating?"Clientes":"Nuevo cliente"}</a></div>
}
