"use client"

import SubscriptionPanel from"./SubscriptionPanel"
import s from"./subscriptionWorkspace.module.css"

export default function SubscriptionWorkspace({propertyId,property}){
  return <section className={s.page}>
    <header className={s.header}><div><small>MI SUSCRIPCIÓN</small><h1>Plan, módulos y facturación</h1><p>Un solo lugar para ver qué incluye la propiedad, cuántas habitaciones usa y qué cambios están pendientes.</p></div><span className={s.secure}>● Gestión protegida</span></header>
    <SubscriptionPanel propertyId={propertyId} property={property}/>
  </section>
}
