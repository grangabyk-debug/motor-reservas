"use client"

import{useEffect,useState}from"react"
import{useHotelSession}from"../../hooks/useHotelSession"
import{loadFinanceContext}from"../../services/financeContext"
import AccountingPremium from"./AccountingPremium"
import RegionalAccounting from"./RegionalAccounting"
import s from"./accounting-premium.module.css"

export default function AccountingGateway(props){
  const session=useHotelSession(),[context,setContext]=useState(null),[error,setError]=useState("")
  useEffect(()=>{let active=true;if(session.loading||!session.propertyId)return;setError("");loadFinanceContext({propertyId:session.propertyId}).then(value=>active&&setContext(value)).catch(e=>active&&setError(e.message||"No se pudo leer la configuración regional."));return()=>{active=false}},[session.loading,session.propertyId])
  if(session.loading||(!context&&!error))return <div className={s.loading}>Preparando contexto financiero…</div>
  if(error)return <div className={s.error}>{error}</div>
  if(context.country==="AR")return <AccountingPremium {...props}/>
  return <RegionalAccounting {...props} propertyId={session.propertyId} financeContext={context}/>
}
