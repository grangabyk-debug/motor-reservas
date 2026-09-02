"use client"

import{useEffect}from"react"

const STAY='[class*="planning-parity-module"][class*="stayOverflow"]'
const PREVIEW='[class*="planning-parity-module"][class*="stayPreview"]'
const CALENDAR='[class*="command-center-module"][class*="calendar"]'

export default function PlanningHoverPlacementBridge(){
  useEffect(()=>{
    function place(stay){
      if(!stay)return
      const preview=stay.querySelector(PREVIEW)
      if(!preview)return
      const stayRect=stay.getBoundingClientRect()
      const previewRect=preview.getBoundingClientRect()
      const calendar=stay.closest(CALENDAR)
      const calendarRect=calendar?.getBoundingClientRect()
      const viewportTop=12
      const viewportBottom=window.innerHeight-12
      const topLimit=Math.max(viewportTop,calendarRect?.top??viewportTop)
      const bottomLimit=Math.min(viewportBottom,calendarRect?.bottom??viewportBottom)
      const previewHeight=Math.max(previewRect.height||0,190)
      const needed=previewHeight+12
      const below=bottomLimit-stayRect.bottom
      const above=stayRect.top-topLimit
      stay.dataset.hlPreviewSide=(below>=needed||below>=above)?"below":"above"
    }

    function onPointerOver(event){
      const stay=event.target instanceof Element?event.target.closest(STAY):null
      if(!stay)return
      const from=event.relatedTarget instanceof Element?event.relatedTarget.closest(STAY):null
      if(from===stay)return
      place(stay)
    }

    function onFocusIn(event){
      const stay=event.target instanceof Element?event.target.closest(STAY):null
      place(stay)
    }

    document.addEventListener("pointerover",onPointerOver,true)
    document.addEventListener("focusin",onFocusIn,true)
    return()=>{
      document.removeEventListener("pointerover",onPointerOver,true)
      document.removeEventListener("focusin",onFocusIn,true)
    }
  },[])
  return null
}
