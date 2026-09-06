"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./sidebarSubscriptionCard.module.css"

const PLAN_LABELS={essential:"Esencial",pro:"Pro",total:"Total"}
const STATUS_LABELS={trial:"Prueba",active:"Activo",past_due:"Pago pendiente",canceled:"Cancelado",inactive:"Sin activar"}
function dateLabel(value){if(!value)return"Sin renovación definida";return `Renueva ${new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value))}`}

export default function SidebarSubscriptionCard({propertyId,onManage}){
  const[data,setData]=useState({loading:true,subscription:null,rooms:0})
  useEffect(()=>{let alive=true;if(!propertyId){setData({loading:false,subscription:null,rooms:0});return}
    Promise.all([
      supabase.from("hotel_subscriptions").select("plan_code,status,room_limit,renews_at").eq("property_id",propertyId).maybeSingle(),
      supabase.from("habitaciones").select("id",{count:"exact",head:true}).eq("property_id",propertyId).eq("activa",true),
    ]).then(([sub,rooms])=>{if(!alive)return;if(sub.error){setData({loading:false,subscription:null,rooms:rooms.count||0});return}setData({loading:false,subscription:sub.data||null,rooms:rooms.count||0})}).catch(()=>alive&&setData(current=>({...current,loading:false})))
    return()=>{alive=false}
  },[propertyId])
  const subscription=data.subscription,status=subscription?.status||"inactive",active=["active","trial"].includes(status),plan=PLAN_LABELS[subscription?.plan_code]||"Sin plan"
  return <button type="button" className={s.card} data-active={active} onClick={onManage} aria-label="Administrar suscripción">
    <div className={s.top}><span className={s.dot}/><b>{data.loading?"Cargando plan…":STATUS_LABELS[status]||status}</b><span className={s.spark}>✦</span></div>
    <div className={s.plan}><strong>{plan}</strong><span>{data.rooms}{subscription?.room_limit?` / ${subscription.room_limit}`:""} hab.</span></div>
    <small>{data.loading?"Consultando suscripción":dateLabel(subscription?.renews_at)}</small>
    <span className={s.manage}>{subscription?"Administrar suscripción":"Ver planes"}<i>›</i></span>
  </button>
}
