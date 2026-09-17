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
  return <div className="hlPlanningCalendarHost" onClickCapture={event=>openHousekeepingForRoom(event,props.rooms)}><style>{`
.hlPlanningCalendarHost{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;overflow:hidden}
.hlPlanningCalendarHost>div{flex:1;min-height:0;width:100%}
.hlPlanningCalendarHost>div>div:first-child{scrollbar-gutter:stable}

/* Modern skin: Planning alineado con Dashboard y Guestbook */
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost){
  padding:12px 14px 16px!important;
  background:radial-gradient(circle at 82% 8%,rgba(117,96,210,.07),transparent 24%),linear-gradient(180deg,color-mix(in srgb,var(--bg) 94%,#f6f1e9),var(--bg))!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"]{
  min-height:58px!important;
  padding:9px 11px!important;
  border:1px solid color-mix(in srgb,#b78955 12%,var(--line))!important;
  border-radius:18px!important;
  background:color-mix(in srgb,var(--panelSolid) 92%,#f8f3eb)!important;
  box-shadow:0 14px 34px rgba(31,37,56,.075),inset 0 1px rgba(255,255,255,.72)!important;
  backdrop-filter:blur(24px) saturate(1.14)!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="navCluster"]{
  padding:3px!important;border-radius:13px!important;background:color-mix(in srgb,var(--panelSolid) 82%,#efe8dc)!important;border:1px solid color-mix(in srgb,#b78955 10%,var(--line))!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] button,
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] label{
  font-family:inherit!important;letter-spacing:0!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="navArrow"],
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="todayButton"]{
  border-radius:10px!important;border-color:transparent!important;background:transparent!important;box-shadow:none!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="navArrow"]:hover,
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="todayButton"]:hover{
  background:color-mix(in srgb,var(--accent) 8%,var(--panelSolid))!important;color:var(--accent)!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="datePicker"]{
  min-width:230px!important;border-radius:11px!important;border-color:color-mix(in srgb,#b78955 13%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 96%,#f7f2e9)!important;font-weight:780!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="quickSearch"]{
  min-width:225px!important;border-radius:11px!important;border-color:color-mix(in srgb,#b78955 11%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 97%,#f7f2e9)!important;box-shadow:inset 0 1px rgba(255,255,255,.58)!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"]{
  margin-top:9px!important;padding:10px!important;gap:8px!important;border:1px solid color-mix(in srgb,#b78955 11%,var(--line))!important;border-radius:17px!important;background:color-mix(in srgb,var(--panelSolid) 94%,#f8f3eb)!important;box-shadow:0 10px 26px rgba(31,37,56,.045),inset 0 1px rgba(255,255,255,.62)!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"] span{
  color:color-mix(in srgb,var(--muted) 82%,#8f682f)!important;font-size:10px!important;font-weight:900!important;letter-spacing:.075em!important;
}
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"] input,
body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"] select{
  height:38px!important;border-radius:10px!important;border-color:color-mix(in srgb,#b78955 12%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 98%,#f7f2e9)!important;font-family:inherit!important;font-size:11px!important;box-shadow:inset 0 1px rgba(255,255,255,.62)!important;
}

.hlPlanningCalendarHost [class*="calendarShell"]{padding-top:9px!important}
.hlPlanningCalendarHost [class*="calendar_"]{
  margin-top:0!important;border:1px solid color-mix(in srgb,#b78955 13%,var(--line))!important;border-radius:20px!important;background:color-mix(in srgb,var(--panelSolid) 97%,#f8f4ed)!important;box-shadow:0 22px 55px rgba(31,37,56,.09),inset 0 1px rgba(255,255,255,.72)!important;
}
.hlPlanningCalendarHost [class*="monthRow"]{
  height:38px!important;background:color-mix(in srgb,var(--panelSolid) 94%,#f2eadf)!important;border-bottom-color:color-mix(in srgb,#b78955 13%,var(--line))!important;
}
.hlPlanningCalendarHost [class*="months"]>div{
  height:38px!important;background:transparent!important;border-right-color:color-mix(in srgb,#b78955 11%,var(--line))!important;font-size:11px!important;font-weight:900!important;letter-spacing:.025em!important;
}
.hlPlanningCalendarHost [class*="corner"]{
  padding-left:13px!important;background:color-mix(in srgb,var(--panelSolid) 95%,#f2eadf)!important;border-right-color:color-mix(in srgb,#b78955 12%,var(--line))!important;
}
.hlPlanningCalendarHost [class*="corner"] span{font-size:10px!important;font-weight:900!important;letter-spacing:.07em!important;text-transform:uppercase!important}
.hlPlanningCalendarHost [class*="dayRow"]{top:38px!important;height:50px!important;background:color-mix(in srgb,var(--panelSolid) 98%,#faf7f2)!important}
.hlPlanningCalendarHost [class*="days"]{height:50px!important}
.hlPlanningCalendarHost [class*="days"]>div{height:50px!important;background:transparent!important;border-right-color:color-mix(in srgb,#b78955 10%,var(--line))!important}
.hlPlanningCalendarHost [class*="days"] small{font-size:9px!important;font-weight:850!important;letter-spacing:.05em!important}
.hlPlanningCalendarHost [class*="days"] b{font-size:14px!important;font-weight:900!important}
.hlPlanningCalendarHost [class*="todayHead"]{background:linear-gradient(180deg,color-mix(in srgb,#78bfff 18%,var(--panelSolid)),color-mix(in srgb,#78bfff 10%,var(--panelSolid)))!important;box-shadow:inset 0 -2px color-mix(in srgb,#5b9cff 30%,transparent)!important}
.hlPlanningCalendarHost [class*="weekendHead"]{background:color-mix(in srgb,#b78955 6%,var(--panelSolid))!important}
.hlPlanningCalendarHost [class*="inventoryRow"]{top:88px!important;height:34px!important;background:color-mix(in srgb,var(--panelSolid) 95%,#f4eee5)!important;box-shadow:0 8px 18px rgba(31,37,56,.04)!important}
.hlPlanningCalendarHost [class*="inventoryLabel"]{height:34px!important;padding:0 12px!important;background:inherit!important}
.hlPlanningCalendarHost [class*="inventoryLabel"] b{font-weight:850!important}
.hlPlanningCalendarHost [class*="inventoryDays"],.hlPlanningCalendarHost [class*="inventoryDays"]>div{height:34px!important}
.hlPlanningCalendarHost [class*="inventoryDays"]>div{border-right-color:color-mix(in srgb,#b78955 9%,var(--line))!important}

.hlPlanningCalendarHost [class*="roomRow"]{height:50px!important;border-bottom-color:color-mix(in srgb,#b78955 9%,var(--line))!important}
.hlPlanningCalendarHost [class*="room"]{
  height:50px!important;padding:6px 11px!important;background:color-mix(in srgb,var(--panelSolid) 98%,#faf7f2)!important;border-right-color:color-mix(in srgb,#b78955 12%,var(--line))!important;box-shadow:8px 0 16px rgba(31,37,56,.025)!important;
}
.hlPlanningCalendarHost [class*="room"]:hover{background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 7%,var(--panelSolid)),color-mix(in srgb,var(--panelSolid) 98%,#faf7f2))!important}
.hlPlanningCalendarHost [class*="room"] b{font-size:12px!important;font-weight:900!important}
.hlPlanningCalendarHost [class*="room"] small{font-size:10px!important;color:color-mix(in srgb,var(--muted) 86%,#7a7065)!important}
.hlPlanningCalendarHost [class*="timelineRow"]{height:50px!important}
.hlPlanningCalendarHost [class*="cell"]{height:50px!important}
.hlPlanningCalendarHost [class*="cell"]:hover{background:linear-gradient(90deg,transparent 0 50%,color-mix(in srgb,var(--accent) 8%,transparent) 50% 100%)!important}
.hlPlanningCalendarHost [class*="timelineBands"]>span{border-right-color:color-mix(in srgb,#b78955 8%,var(--line))!important}
.hlPlanningCalendarHost [class*="timelineBands"]>span:after{border-left-color:color-mix(in srgb,var(--muted) 18%,transparent)!important}

.hlPlanningCalendarHost [class*="stay_"]{
  top:7px!important;height:36px!important;border-radius:10px!important;padding-left:6px!important;box-shadow:0 5px 13px rgba(28,44,72,.12),inset 0 -2px color-mix(in srgb,currentColor 22%,transparent)!important;transition:transform .15s ease,box-shadow .15s ease,filter .15s ease!important;
}
.hlPlanningCalendarHost [class*="stay_"]:hover,.hlPlanningCalendarHost [class*="stay_"]:focus-visible{transform:translateY(-2px)!important;box-shadow:0 9px 20px rgba(28,44,72,.17),inset 0 -2px color-mix(in srgb,currentColor 20%,transparent)!important}
.hlPlanningCalendarHost [class*="stayText"] b{font-size:10px!important;font-weight:900!important;letter-spacing:0!important}
.hlPlanningCalendarHost [class*="avatar"]{border-radius:7px!important}
.hlPlanningCalendarHost [class*="resizeHandle"]{top:5px!important;height:26px!important;border-radius:6px!important}
.hlPlanningCalendarHost [class*="rangeHighlight"]{top:6px!important;height:38px!important;border-radius:10px!important}
.hlPlanningCalendarHost [class*="reservationPreview"],
.hlPlanningCalendarHost [class*="referencePopover"]{border-radius:16px!important;border-color:color-mix(in srgb,#b78955 13%,var(--line))!important;background:color-mix(in srgb,var(--panelSolid) 96%,#f8f3eb)!important;box-shadow:0 24px 66px rgba(17,29,52,.22)!important}

body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:252px!important;bottom:16px!important;max-height:calc(100dvh - 268px)!important;overflow-y:auto!important;overflow-x:hidden!important;scroll-padding-bottom:74px!important;border-radius:20px!important;box-shadow:0 26px 70px rgba(31,37,56,.18)!important}
body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer{position:sticky!important;bottom:0!important;z-index:20!important;min-height:64px!important;box-sizing:border-box!important;flex:0 0 auto!important;background:color-mix(in srgb,var(--panelSolid) 98%,transparent)!important;backdrop-filter:blur(20px)!important;box-shadow:0 -10px 24px color-mix(in srgb,#17213a 8%,transparent)!important;padding-bottom:max(13px,env(safe-area-inset-bottom))!important}
body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{min-height:38px!important;white-space:nowrap!important;border-radius:10px!important}

i[aria-label^="Housekeeping:"]{position:relative;cursor:pointer!important;transition:transform .14s ease,box-shadow .14s ease}
i[aria-label^="Housekeeping:"]:hover{transform:scale(1.35);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 12%,transparent)!important}
i[aria-label^="Housekeeping:"]::after{content:attr(aria-label);position:absolute;left:50%;bottom:calc(100% + 8px);z-index:80;min-width:max-content;max-width:190px;transform:translate(-50%,4px);padding:6px 8px;border:1px solid var(--line);border-radius:9px;background:color-mix(in srgb,var(--panelSolid) 96%,transparent);color:var(--text);box-shadow:0 10px 28px rgba(18,31,55,.16);font:800 10px/1.2 inherit;font-style:normal;letter-spacing:0;opacity:0;pointer-events:none;transition:opacity .14s ease,transform .14s ease}
i[aria-label^="Housekeeping:"]:hover::after{opacity:1;transform:translate(-50%,0)}

@media(max-width:1150px) and (min-width:761px){
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"]{align-items:flex-start!important;flex-wrap:wrap!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"]{grid-template-columns:1fr 1fr!important}
  body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:305px!important;bottom:12px!important;max-height:calc(100dvh - 317px)!important}
}
@media(max-width:760px){
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost){padding:8px!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"]{border-radius:15px!important;align-items:stretch!important;flex-direction:column!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="navCluster"]{width:100%!important;overflow:auto!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="datePicker"]{min-width:185px!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="toolbarActions"]{width:100%!important;justify-content:space-between!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="toolbar"] [class*="quickSearch"]{flex:1!important;min-width:0!important}
  body:has(.hlPlanningCalendarHost) section:has(>.hlPlanningCalendarHost)>[class*="filters"]{grid-template-columns:1fr!important;border-radius:15px!important}
  .hlPlanningCalendarHost [class*="calendar_"]{border-radius:16px!important}
  body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]{top:68px!important;right:8px!important;bottom:8px!important;width:calc(100vw - 16px)!important;max-height:calc(100dvh - 76px)!important;scroll-padding-bottom:82px!important}
  body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer{justify-content:stretch!important;padding:10px 10px max(10px,env(safe-area-inset-bottom))!important}
  body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{flex:1!important;min-width:0!important}
  i[aria-label^="Housekeeping:"]{width:10px!important;height:10px!important}
  i[aria-label^="Housekeeping:"]::after{display:none}
}
@media(max-width:480px){body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer{gap:6px!important}body:has(.hlPlanningCalendarHost) [class*="detailDrawer"]>footer button{padding:0 8px!important;font-size:11px!important}}
`}</style><PlanningCalendarCore {...props}/></div>
}
