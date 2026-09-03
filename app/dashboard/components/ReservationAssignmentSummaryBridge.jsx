"use client"

import{useEffect}from"react"

const moneySummary=/^Alojamiento\s+(.+)$/i
const obsoleteStaySummary=/^(Noche hotelera|Day Use|Reserva grupal|Revisá la estadía:)/i

function polish(root=document){
  root.querySelectorAll('section[role="dialog"] form main b').forEach(node=>{
    if(node.dataset.hlAssignmentAmount==="true")return
    const match=String(node.textContent||"").trim().match(moneySummary)
    if(!match)return
    const parent=node.parentElement
    const roomText=parent?.querySelector(':scope > span')?.textContent||""
    if(!/habitaci[oó]n|habitaciones/i.test(roomText))return
    const amount=match[1]
    node.textContent=""
    node.dataset.hlAssignmentAmount="true"
    const label=document.createElement("small")
    label.dataset.hlSummaryLabel="true"
    label.textContent="Alojamiento"
    const value=document.createElement("strong")
    value.dataset.hlSummaryAmount="true"
    value.textContent=amount
    node.append(label,value)
  })

  root.querySelectorAll('section[role="dialog"] form main > section > div').forEach(node=>{
    if(node.dataset.hlHideStaySummary==="true")return
    const text=String(node.textContent||"").trim()
    if(!obsoleteStaySummary.test(text))return
    if(!(/Ocupa/i.test(text)||/^Revisá la estadía:/i.test(text)))return
    node.dataset.hlHideStaySummary="true"
    node.hidden=true
  })
}

export default function ReservationAssignmentSummaryBridge(){
  useEffect(()=>{
    let queued=false
    const run=()=>{queued=false;polish(document)}
    const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(run)}
    polish(document)
    const observer=new MutationObserver(schedule)
    observer.observe(document.body,{subtree:true,childList:true,characterData:true})
    return()=>observer.disconnect()
  },[])
  return null
}
