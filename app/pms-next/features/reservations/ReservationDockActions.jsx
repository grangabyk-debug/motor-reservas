"use client"

import{useEffect,useState}from"react"
import{createPortal}from"react-dom"
import PmsIcon from"../../components/shell/PmsIcons"

const ATTACHMENTS_TITLE="Archivos adjuntos de la reserva"
const PAYMENT_TITLE="Solicitar un pago por Mercado Pago"

export default function ReservationDockActions(){
  const[target,setTarget]=useState(null)
  useEffect(()=>{
    let first=0,second=0
    const resolve=()=>setTarget(document.querySelector('[class*="bottomActions"]'))
    first=requestAnimationFrame(()=>{resolve();second=requestAnimationFrame(resolve)})
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second)}
  },[])
  function trigger(title){const button=[...document.querySelectorAll("button")].find(node=>node.title===title);button?.click()}
  if(!target)return null
  return createPortal(<><button type="button" data-reservation-dock-action="attachments" onClick={()=>trigger(ATTACHMENTS_TITLE)}><PmsIcon name="attachment" size={14}/>Adjuntos</button><button type="button" data-reservation-dock-action="payment" onClick={()=>trigger(PAYMENT_TITLE)} style={{borderColor:"color-mix(in srgb,var(--accent) 30%,var(--line))",background:"color-mix(in srgb,var(--accent) 8%,var(--panelSolid))",color:"var(--accent)"}}><PmsIcon name="payment" size={14}/>Solicitar pago</button></>,target)
}
