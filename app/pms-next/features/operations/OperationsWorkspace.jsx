"use client"

import MaintenancePremium from"./MaintenancePremium"
import OperationsWorkspaceLegacy from"./OperationsWorkspaceLegacy"
import useOperationsData from"./useOperationsData"

function MaintenanceContext({propertyId}){
  const data=useOperationsData(propertyId)
  if(data.loading)return <section style={{padding:24,fontSize:15,fontWeight:700}}>Cargando Mantenimiento…</section>
  return <MaintenancePremium propertyId={propertyId} rooms={data.rooms||[]} reservations={data.reservations||[]} resources={[]}/>
}

export default function OperationsWorkspace(props){
  if(props.initialTab==="maintenance")return <MaintenanceContext propertyId={props.propertyId}/>
  return <OperationsWorkspaceLegacy {...props}/>
}
