"use client"

import{useEffect}from"react"

const META_KEY="hl:new-reservation-meta"
const PENDING_KEY="hl:new-reservation-pending"
const dockSelector='[data-hl-reservation-create-dock="true"]'

const text=node=>String(node?.textContent||"").trim()
const normalize=value=>String(value||"").trim().toLowerCase()

function dialog(){return document.querySelector('section[role="dialog"][aria-label="Nueva reserva"]')}
function activeTab(root){return[...root.querySelectorAll("nav button")].find(button=>String(button.className||"").includes("active"))||null}
function fieldByLabel(root,label){const wanted=normalize(label);for(const node of root.querySelectorAll("label")){const caption=node.querySelector(":scope > span");if(normalize(text(caption))===wanted)return node.querySelector("input,select,textarea")}return null}
function readMeta(root){
  let previous={}
  try{previous=JSON.parse(sessionStorage.getItem(META_KEY)||"{}")||{}}catch{}
  const form=root.querySelector("form")
  const guest=text(root.querySelector("header h2"))
  const start=fieldByLabel(form,"Entrada")?.value||previous.start||""
  const end=fieldByLabel(form,"Salida")?.value||previous.end||""
  const roomId=fieldByLabel(form,"Habitación principal")?.value||previous.roomId||""
  const next={...previous,start,end,roomId,guest:guest&&guest!=="Nueva reserva"?guest:previous.guest||"",capturedAt:Date.now()}
  sessionStorage.setItem(META_KEY,JSON.stringify(next))
  return next
}
function nativeValue(node,value){
  if(!node)return
  const proto=node instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype
  const setter=Object.getOwnPropertyDescriptor(proto,"value")?.set
  if(setter)setter.call(node,value);else node.value=value
  node.dispatchEvent(new Event("input",{bubbles:true}))
  node.dispatchEvent(new Event("change",{bubbles:true}))
}
function clickPlanning(){
  const rail=document.querySelector('[data-hl-rail="true"]')
  if(!rail)return false
  const module=[...rail.querySelectorAll("button")].find(button=>normalize(button.getAttribute("aria-label"))==="recepción")
  if(!module)return false
  module.click()
  setTimeout(()=>{
    const item=[...rail.querySelectorAll('[role="menuitem"]')].find(button=>normalize(text(button))==="planning")
    item?.click()
  },60)
  return true
}
function showPlanningNotice(message,ok=true){
  document.querySelector('[data-hl-created-reservation-notice="true"]')?.remove()
  const node=document.createElement("div")
  node.dataset.hlCreatedReservationNotice="true"
  node.dataset.ok=ok?"true":"false"
  node.textContent=message
  document.body.appendChild(node)
  setTimeout(()=>node.remove(),5000)
}
function findReservation(meta){
  const rows=[...document.querySelectorAll("[data-room-id]")]
  const preferred=meta.roomId?rows.find(row=>String(row.dataset.roomId)===String(meta.roomId)):null
  const pool=preferred?[preferred,...rows.filter(row=>row!==preferred)]:rows
  for(const row of pool){
    const buttons=[...row.querySelectorAll("button[title]")]
    const exact=buttons.find(button=>{
      const title=text(button.getAttribute("title"))
      return (!meta.guest||title.includes(meta.guest))&&(!meta.start||title.includes(meta.start))
    })
    if(exact)return exact
  }
  return null
}
function focusPlanning(meta){
  clickPlanning()
  const started=Date.now()
  const prepare=()=>{
    const dateInput=document.querySelector('input[aria-label="Ir a fecha"]')
    if(!dateInput){if(Date.now()-started<8000)setTimeout(prepare,120);return}
    if(meta.start&&dateInput.value!==meta.start)nativeValue(dateInput,meta.start)
    nativeValue(document.querySelector('input[aria-label="Filtrar habitación"]'),"")
    nativeValue(document.querySelector('select[aria-label="Tipo de habitación"]'),"")
    nativeValue(document.querySelector('select[aria-label="Piso"]'),"")
    locate()
  }
  const locate=()=>{
    const card=findReservation(meta)
    if(card){
      card.dataset.hlCreatedReservationFocus="true"
      card.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})
      setTimeout(()=>card.click(),260)
      showPlanningNotice("✓ Reserva creada y ubicada en el Planning.")
      sessionStorage.removeItem(PENDING_KEY)
      sessionStorage.removeItem(META_KEY)
      setTimeout(()=>delete card.dataset.hlCreatedReservationFocus,4600)
      return
    }
    if(Date.now()-started<9000){setTimeout(locate,180);return}
    showPlanningNotice("Reserva creada. Te llevé al Planning en la fecha de ingreso; no pude centrar la tarjeta automáticamente.",false)
    sessionStorage.removeItem(PENDING_KEY)
  }
  setTimeout(prepare,120)
}
function ensureDock(root){
  if(root.querySelector(dockSelector))return
  const form=root.querySelector("form")
  if(!form)return
  const dock=document.createElement("div")
  dock.dataset.hlReservationCreateDock="true"
  const copy=document.createElement("div")
  const small=document.createElement("small")
  small.textContent="PASO 3 DE 3 · EXTRAS Y CIERRE"
  const strong=document.createElement("strong")
  strong.textContent="Confirmá la reserva y revisala directamente en el Planning"
  copy.append(small,strong)
  const button=document.createElement("button")
  button.type="button"
  button.textContent="Crear reserva"
  button.dataset.hlCreateReservation="true"
  button.addEventListener("click",()=>{
    const meta=readMeta(root)
    sessionStorage.setItem(PENDING_KEY,JSON.stringify({...meta,requestedAt:Date.now()}))
    button.disabled=true
    button.textContent="Creando reserva…"
    try{form.requestSubmit()}catch{form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}))}
    setTimeout(()=>{if(document.body.contains(root)){button.disabled=false;button.textContent="Crear reserva";sessionStorage.removeItem(PENDING_KEY)}},4000)
  })
  dock.append(copy,button)
  root.appendChild(dock)
}
function sync(){
  const root=dialog()
  if(root){
    const tab=normalize(text(activeTab(root)))
    if(tab.includes("huésped")||tab.includes("estadía")||tab.includes("extras"))readMeta(root)
    if(tab.includes("extras"))ensureDock(root);else root.querySelector(dockSelector)?.remove()
    return
  }
  let pending=null
  try{pending=JSON.parse(sessionStorage.getItem(PENDING_KEY)||"null")}catch{}
  if(pending&&Date.now()-Number(pending.requestedAt||0)<15000){sessionStorage.removeItem(PENDING_KEY);focusPlanning(pending)}
}

export default function ReservationCreateFlowBridge(){
  useEffect(()=>{
    let queued=false
    const run=()=>{queued=false;sync()}
    const schedule=()=>{if(queued)return;queued=true;requestAnimationFrame(run)}
    sync()
    const observer=new MutationObserver(schedule)
    observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class","value","aria-selected"]})
    document.addEventListener("input",schedule,true)
    document.addEventListener("change",schedule,true)
    return()=>{observer.disconnect();document.removeEventListener("input",schedule,true);document.removeEventListener("change",schedule,true)}
  },[])
  return null
}
