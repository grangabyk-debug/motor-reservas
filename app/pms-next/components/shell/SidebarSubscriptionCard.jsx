"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./sidebarSubscriptionCard.module.css"

export default function SidebarSubscriptionCard({onManage}){
  const[platformAdmin,setPlatformAdmin]=useState(false)
  useEffect(()=>{let cancelled=false;supabase.rpc("hl_is_platform_admin").then(({data,error})=>{if(!cancelled&&!error)setPlatformAdmin(Boolean(data))});return()=>{cancelled=true}},[])
  return <div className={s.stack}>
    <button type="button" className={s.card} onClick={onManage} aria-label="Ver plan">Ver plan</button>
    {platformAdmin?<a className={`${s.card} ${s.admin}`} href="/pms-admin" aria-label="Abrir panel de plataforma">Panel de plataforma</a>:null}
  </div>
}
