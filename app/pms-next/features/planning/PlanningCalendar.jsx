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
  return <div className="hlPlanningCalendarHost" onClickCapture={event=>openHousekeepingForRoom(event,props.rooms)}><style>{`.hlPlanningCalendarHost{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;overflow:hidden}.hlPlanningCalendarHost>div{flex:1;min-height:0;width:100%}.hlPlanningCalendarHost>div>div:first-child{scrollbar-gutter:stable}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:252px!important;bottom:16px!important;max-height:calc(100dvh - 268px)!important;overflow-y:auto!important;overflow-x:hidden!important;scroll-padding-bottom:74px!important}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer{position:sticky!important;bottom:0!important;z-index:20!important;min-height:64px!important;box-sizing:border-box!important;flex:0 0 auto!important;background:color-mix(in srgb,var(--panelSolid) 98%,transparent)!important;backdrop-filter:blur(20px)!important;box-shadow:0 -10px 24px color-mix(in srgb,#17213a 8%,transparent)!important;padding-bottom:max(13px,env(safe-area-inset-bottom))!important}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{min-height:38px!important;white-space:nowrap!important}i[aria-label^="Housekeeping:"]{position:relative;cursor:pointer!important;transition:transform .14s ease,box-shadow .14s ease}i[aria-label^="Housekeeping:"]:hover{transform:scale(1.35);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)!important}i[aria-label^="Housekeeping:"]::after{content:attr(aria-label);position:absolute;left:50%;bottom:calc(100% + 8px);z-index:80;min-width:max-content;max-width:190px;transform:translate(-50%,4px);padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:color-mix(in srgb,var(--panelSolid) 96%,transparent);color:var(--text);box-shadow:0 10px 28px rgba(18,31,55,.16);font:800 10px/1.2 inherit;font-style:normal;letter-spacing:0;opacity:0;pointer-events:none;transition:opacity .14s ease,transform .14s ease}i[aria-label^="Housekeeping:"]:hover::after{opacity:1;transform:translate(-50%,0)}

/* Reforma visual segura: solo piel, sin tocar geometría ni comportamiento del Planning */
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost){background:radial-gradient(circle at 88% 4%,color-mix(in srgb,var(--accent) 7%,transparent),transparent 24%),linear-gradient(180deg,color-mix(in srgb,var(--bg) 97%,#f7f4ef),var(--bg))!important}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"]{border-color:color-mix(in srgb,var(--accent) 11%,var(--line))!important;border-radius:16px!important;background:color-mix(in srgb,var(--panelSolid) 93%,transparent)!important;box-shadow:0 12px 30px rgba(28,38,64,.07),inset 0 1px color-mix(in srgb,#fff 48%,transparent)!important;backdrop-filter:blur(22px) saturate(1.12)!important}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="navArrow"],body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="todayButton"],body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="datePicker"],body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="quickSearch"]{border-radius:11px!important;border-color:color-mix(in srgb,var(--accent) 10%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 98%,transparent)!important;box-shadow:inset 0 1px color-mix(in srgb,#fff 45%,transparent)!important;font-family:inherit!important;letter-spacing:0!important}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="navArrow"]:hover,body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="todayButton"]:hover{background:color-mix(in srgb,var(--accent) 7%,var(--panelSolid))!important;border-color:color-mix(in srgb,var(--accent) 26%,var(--line))!important}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"]{border-color:color-mix(in srgb,var(--accent) 9%,var(--line))!important;border-radius:15px!important;background:color-mix(in srgb,var(--panelSolid) 94%,transparent)!important;box-shadow:0 9px 24px rgba(28,38,64,.045),inset 0 1px color-mix(in srgb,#fff 42%,transparent)!important;backdrop-filter:blur(18px)!important}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"] span{font-family:inherit!important;color:color-mix(in srgb,var(--muted) 88%,var(--text))!important;font-weight:850!important;letter-spacing:.065em!important}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"] input,body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"] select{border-radius:10px!important;border-color:color-mix(in srgb,var(--accent) 9%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 99%,transparent)!important;font-family:inherit!important;letter-spacing:0!important}
.hlPlanningCalendarHost [class*="calendarShell"]>[class*="calendar"]{border-color:color-mix(in srgb,var(--accent) 9%,var(--line))!important;border-radius:16px!important;background:color-mix(in srgb,var(--panelSolid) 99%,transparent)!important;box-shadow:0 18px 44px rgba(28,38,64,.075),inset 0 1px color-mix(in srgb,#fff 38%,transparent)!important}
.hlPlanningCalendarHost [class*="monthRow"]{background:color-mix(in srgb,var(--panelSolid) 97%,var(--bg))!important;border-bottom-color:color-mix(in srgb,var(--accent) 8%,var(--line))!important}
.hlPlanningCalendarHost [class*="months"]>div{background:linear-gradient(180deg,color-mix(in srgb,var(--accent) 3%,var(--panelSolid)),var(--panelSolid))!important;border-right-color:color-mix(in srgb,var(--accent) 7%,var(--line))!important;font-family:inherit!important;letter-spacing:0!important}
.hlPlanningCalendarHost [class*="dayRow"]{background:color-mix(in srgb,var(--panelSolid) 99%,var(--bg))!important;border-bottom-color:color-mix(in srgb,var(--accent) 7%,var(--line))!important}
.hlPlanningCalendarHost [class*="days"]>div{border-right-color:color-mix(in srgb,var(--accent) 6%,var(--line))!important}
.hlPlanningCalendarHost [class*="days"] small,.hlPlanningCalendarHost [class*="days"] b{font-family:inherit!important;letter-spacing:0!important}
.hlPlanningCalendarHost [class*="todayHead"]{background:linear-gradient(180deg,color-mix(in srgb,#6bb9ff 14%,var(--panelSolid)),color-mix(in srgb,#6bb9ff 8%,var(--panelSolid)))!important;box-shadow:inset 0 -2px color-mix(in srgb,#5b9cff 22%,transparent)!important}
.hlPlanningCalendarHost [class*="inventoryRow"]{background:color-mix(in srgb,var(--panelSolid) 97%,var(--bg))!important;box-shadow:0 5px 14px rgba(28,38,64,.025)!important}
.hlPlanningCalendarHost [class*="inventoryLabel"]{background:inherit!important}
.hlPlanningCalendarHost [class*="inventoryDays"]>div{border-right-color:color-mix(in srgb,var(--accent) 5%,var(--line))!important}
.hlPlanningCalendarHost [class*="roomRow"]{border-bottom-color:color-mix(in srgb,var(--accent) 5%,var(--line))!important}
.hlPlanningCalendarHost [class*="room"]{background:color-mix(in srgb,var(--panelSolid) 99%,var(--bg))!important;border-right-color:color-mix(in srgb,var(--accent) 7%,var(--line))!important;box-shadow:5px 0 12px rgba(28,38,64,.018)!important}
.hlPlanningCalendarHost [class*="room"]:hover{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 6%,var(--panelSolid)),color-mix(in srgb,var(--panelSolid) 99%,var(--bg)))!important}
.hlPlanningCalendarHost [class*="room"] b,.hlPlanningCalendarHost [class*="room"] small{font-family:inherit!important;letter-spacing:0!important}
.hlPlanningCalendarHost [class*="timelineBands"]>span{border-right-color:color-mix(in srgb,var(--accent) 5%,var(--line))!important}
.hlPlanningCalendarHost [class*="timelineBands"]>span:after{border-left-color:color-mix(in srgb,var(--muted) 20%,transparent)!important}
.hlPlanningCalendarHost [class*="stay_"]{border-radius:8px!important;box-shadow:0 3px 10px rgba(28,44,72,.11),inset 0 -2px color-mix(in srgb,currentColor 30%,transparent)!important}
.hlPlanningCalendarHost [class*="stay_"]:hover,.hlPlanningCalendarHost [class*="stay_"]:focus-visible{box-shadow:0 7px 17px rgba(28,44,72,.16),inset 0 -2px color-mix(in srgb,currentColor 28%,transparent)!important}
.hlPlanningCalendarHost [class*="stayText"] b,.hlPlanningCalendarHost [class*="stayText"] small{font-family:inherit!important;letter-spacing:0!important}
.hlPlanningCalendarHost [class*="avatar"]{border-radius:6px!important}
.hlPlanningCalendarHost [class*="reservationPreview"],.hlPlanningCalendarHost [class*="referencePopover"]{border-radius:15px!important;border-color:color-mix(in srgb,var(--accent) 10%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 97%,transparent)!important;box-shadow:0 22px 58px rgba(17,29,52,.22)!important}
body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{border-radius:16px!important;box-shadow:0 24px 64px rgba(24,34,56,.16)!important}
body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{border-radius:10px!important}

@media(max-width:1150px) and (min-width:761px){body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:305px!important;bottom:12px!important;max-height:calc(100dvh - 317px)!important}}@media(max-width:760px){body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:68px!important;right:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important;max-height:calc(100dvh - 76px)!important;scroll-padding-bottom:82px!important}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer{justify-content:stretch!important;padding:10px 10px max(10px,env(safe-area-inset-bottom))!important}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{flex:1!important;min-width:0!important}i[aria-label^="Housekeeping:"]{width:10px!important;height:10px!important}i[aria-label^="Housekeeping:"]::after{display:none}}@media(max-width:480px){body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer{gap:6px!important}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{padding:0 8px!important;font-size:11px!important}}`}</style><PlanningCalendarCore {...props}/></div>
}
