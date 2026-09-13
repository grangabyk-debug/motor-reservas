"use client"

import PlanningCalendarCore from"./PlanningCalendarCore"

function openHousekeepingForRoom(event,rooms){
  const target=event.target?.closest?.('i[aria-label^="Housekeeping:"]')
  if(!target)return
  const roomName=target.closest("b")?.textContent?.trim()
  const room=(rooms||[]).find(item=>String(item.nombre||"").trim()===roomName)
  if(!room||typeof window==="undefined")return
  event.preventDefault()
  event.stopPropagation()
  const url=new URL(window.location.href)
  url.searchParams.set("view","housekeeping")
  url.searchParams.set("housekeeping_room",String(room.id))
  window.history.pushState({pmsView:"housekeeping"},"",url)
  window.dispatchEvent(new PopStateEvent("popstate",{state:{pmsView:"housekeeping"}}))
}

export default function PlanningCalendar(props){
  return <div onClickCapture={event=>openHousekeepingForRoom(event,props.rooms)}><style>{`i[aria-label^="Housekeeping:"]{cursor:pointer!important;transition:transform .14s ease,box-shadow .14s ease}i[aria-label^="Housekeeping:"]:hover{transform:scale(1.35);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)!important}`}</style><PlanningCalendarCore {...props}/></div>
}
