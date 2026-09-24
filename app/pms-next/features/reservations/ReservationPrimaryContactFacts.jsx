"use client"

import useReservationPrimaryContact from"./useReservationPrimaryContact"

export default function ReservationPrimaryContactFacts({reservation,propertyId,contactClass=""}){
  const contact=useReservationPrimaryContact({reservation,propertyId})
  return <><div><small>Teléfono</small><b>{contact.phone||reservation?.telefono_huesped||"—"}</b></div><div className={contactClass}><small>Contacto</small><b>{contact.email||reservation?.email_huesped||"Sin email cargado"}</b></div></>
}
