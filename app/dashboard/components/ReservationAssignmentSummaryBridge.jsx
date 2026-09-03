"use client"

import{useEffect}from"react"

const moneySummary=/^Alojamiento\s+(.+)$/i
const obsoleteStaySummary=/^(Noche hotelera|Day Use|Reserva grupal|Revisá la estadía:)/i
const normalize=value=>String(value||"").trim().toLowerCase()

function selectedRoomInfo(select){
  if(!select?.value)return null
  const option=select.options?.[select.selectedIndex]
  const parts=String(option?.textContent||"").split("·").map(value=>value.trim()).filter(Boolean)
  if(!parts.length)return null
  const name=parts[0]||"",type=parts[1]&&!/^\$/i.test(parts[1])?parts[1]:""
  return{name,type:type||name}
}

function roomTypeSummary(dialog,summary,leftText){
  const labels=[...dialog.querySelectorAll("label")]
  const primaryLabel=labels.find(label=>normalize(label.querySelector(":scope > span")?.textContent)==="habitación principal")
  const primary=selectedRoomInfo(primaryLabel?.querySelector("select"))
  if(!primary)return leftText
  const capacity=String(leftText||"").match(/capacidad estimada\s+(\d+)\s+pax/i)?.[1]||""
  const count=Number(String(leftText||"").match(/^(\d+)\s+habitaci/i)?.[1]||1)
  const extraInfos=labels.filter(label=>/^habitación\s+\d+$/i.test(String(label.querySelector(":scope > span")?.textContent||"").trim())).map(label=>selectedRoomInfo(label.querySelector("select"))).filter(Boolean)
  const infos=[primary,...extraInfos]
  if(count<=1){
    const detail=normalize(primary.name)===normalize(primary.type)?primary.type:[primary.name,primary.type].filter(Boolean).join(" · ")
    return`1 habitación${detail?` · ${detail}`:""}${capacity?` · capacidad estimada ${capacity} pax`:""}`
  }
  const typeCounts=new Map()
  infos.slice(0,count).forEach(info=>{const key=info.type||info.name;if(key)typeCounts.set(key,(typeCounts.get(key)||0)+1)})
  const types=[...typeCounts.entries()].map(([type,qty])=>qty>1?`${type} ×${qty}`:type).join(" + ")
  return`${count} habitaciones${types?` · ${types}`:""}${capacity?` · capacidad estimada ${capacity} pax`:""}`
}

function polish(root=document){
  root.querySelectorAll('section[role="dialog"] form main b').forEach(node=>{
    const label=node.querySelector(':scope > small[data-hl-summary-label="true"]')
    const value=node.querySelector(':scope > strong[data-hl-summary-amount="true"]')
    if(label&&value){node.dataset.hlAssignmentAmount="true";return}
    const match=String(node.textContent||"").trim().match(moneySummary)
    if(!match)return
    const parent=node.parentElement
    const roomSpan=parent?.querySelector(':scope > span')
    const roomText=roomSpan?.textContent||""
    if(!/habitaci[oó]n|habitaciones/i.test(roomText))return
    const amount=match[1]
    node.textContent=""
    node.dataset.hlAssignmentAmount="true"
    const nextLabel=document.createElement("small")
    nextLabel.dataset.hlSummaryLabel="true"
    nextLabel.textContent="Alojamiento"
    const nextValue=document.createElement("strong")
    nextValue.dataset.hlSummaryAmount="true"
    nextValue.textContent=amount
    node.append(nextLabel,nextValue)
    const dialog=node.closest('section[role="dialog"]')
    if(dialog&&roomSpan){const next=roomTypeSummary(dialog,parent,roomText);if(next&&roomSpan.textContent!==next)roomSpan.textContent=next}
  })

  root.querySelectorAll('section[role="dialog"] form main b[data-hl-assignment-amount="true"]').forEach(node=>{
    const parent=node.parentElement,roomSpan=parent?.querySelector(':scope > span'),dialog=node.closest('section[role="dialog"]')
    if(dialog&&roomSpan){const next=roomTypeSummary(dialog,parent,roomSpan.textContent||"");if(next&&roomSpan.textContent!==next)roomSpan.textContent=next}
  })

  root.querySelectorAll('section[role="dialog"] form main > section > div').forEach(node=>{
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
    document.addEventListener("change",schedule,true)
    document.addEventListener("input",schedule,true)
    return()=>{observer.disconnect();document.removeEventListener("change",schedule,true);document.removeEventListener("input",schedule,true)}
  },[])
  return null
}
