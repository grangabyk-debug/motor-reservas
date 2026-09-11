"use client"

import{usePathname}from"next/navigation"

export default function PlatformAdminLayout({children}){
  const path=usePathname(),creating=path?.startsWith("/pms-admin/nuevo")
  return <>{children}<a href={creating?"/pms-admin":"/pms-admin/nuevo"} style={{position:"fixed",right:22,bottom:22,zIndex:1000,minHeight:46,padding:"0 17px",borderRadius:14,display:"inline-flex",alignItems:"center",justifyContent:"center",background:"#6252dc",color:"#fff",fontFamily:"Inter,Arial,sans-serif",fontSize:14,fontWeight:900,textDecoration:"none",boxShadow:"0 14px 32px rgba(69,53,176,.28)",border:"1px solid rgba(255,255,255,.28)"}}>{creating?"← Clientes":"＋ Nuevo cliente"}</a></>
}
