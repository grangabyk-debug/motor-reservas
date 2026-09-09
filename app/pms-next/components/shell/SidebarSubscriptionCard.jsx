"use client"

import s from"./sidebarSubscriptionCard.module.css"

export default function SidebarSubscriptionCard({onManage}){
  return <button type="button" className={s.card} onClick={onManage} aria-label="Ver plan">Ver plan</button>
}
