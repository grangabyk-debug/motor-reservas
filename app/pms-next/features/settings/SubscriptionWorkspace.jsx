"use client"

import SubscriptionPanel from"./SubscriptionPanel"
import s from"./subscriptionWorkspace.module.css"

function Shield(){return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 5 6v5c0 5 3.2 8.3 7 10 3.8-1.7 7-5 7-10V6z"/><path d="m9 12 2 2 4-4"/></svg>}
const polish=`[data-subscription] section[class*="paymentMethod"] button{display:none!important}[data-subscription] button svg,[data-subscription] li svg,[data-subscription] footer b svg{vertical-align:middle;flex:0 0 auto}[data-subscription] li,[data-subscription] footer b,[data-subscription] button{gap:7px}`

export default function SubscriptionWorkspace({propertyId,property}){
  return <section className={s.page} data-subscription><style>{polish}</style><header className={s.header}><div><small>MI SUSCRIPCIÓN</small><h1>Plan, módulos y facturación</h1></div><span className={s.secure}><Shield/> Gestión protegida</span></header><SubscriptionPanel propertyId={propertyId} property={property}/></section>
}
