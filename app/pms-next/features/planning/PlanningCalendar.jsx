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
  const sidebarButtons=[...document.querySelectorAll("aside button")]
  const housekeepingButton=sidebarButtons.find(button=>button.getAttribute("aria-label")==="Housekeeping"||button.textContent?.trim()==="Housekeeping")
  if(!housekeepingButton){
    window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail:{tone:"warning",title:"Housekeeping no disponible",message:"Tu rol no tiene acceso a Housekeeping."}}))
    return
  }
  housekeepingButton.click()
  const url=new URL(window.location.href)
  url.searchParams.set("housekeeping_room",String(room.id))
  window.history.replaceState(window.history.state||{},"",url)
}

export default function PlanningCalendar(props){
  return <div className="hlPlanningCalendarHost" onClickCapture={event=>openHousekeepingForRoom(event,props.rooms)}><style>{`.hlPlanningCalendarHost{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;overflow:hidden}.hlPlanningCalendarHost>div{flex:1;min-height:0;width:100%}.hlPlanningCalendarHost>div>div:first-child{scrollbar-gutter:stable}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:252px!important;bottom:16px!important}i[aria-label^="Housekeeping:"]{position:relative;cursor:pointer!important;transition:transform .14s ease,box-shadow .14s ease}i[aria-label^="Housekeeping:"]:hover{transform:scale(1.35);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)!important}i[aria-label^="Housekeeping:"]::after{content:attr(aria-label);position:absolute;left:50%;bottom:calc(100% + 8px);z-index:80;min-width:max-content;max-width:190px;transform:translate(-50%,4px);padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:color-mix(in srgb,var(--panelSolid) 96%,transparent);color:var(--text);box-shadow:0 10px 28px rgba(18,31,55,.16);font:800 10px/1.2 inherit;font-style:normal;letter-spacing:0;opacity:0;pointer-events:none;transition:opacity .14s ease,transform .14s ease}i[aria-label^="Housekeeping:"]:hover::after{opacity:1;transform:translate(-50%,0)}@media(max-width:1150px) and (min-width:761px){body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:305px!important}}@media(max-width:760px){body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:68px!important;bottom:8px!important}i[aria-label^="Housekeeping:"]{width:10px!important;height:10px!important}i[aria-label^="Housekeeping:"]::after{display:none}}`}</style><PlanningCalendarCore {...props}/></div>
}
