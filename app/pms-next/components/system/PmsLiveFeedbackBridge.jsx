"use client"

import{useEffect,useRef}from"react"

const READY_STATES=new Set(["limpia","inspeccionada","libre"])
const labelForStatus=status=>status==="inspeccionada"||status==="libre"?"Inspección completada":"Habitación lista"

export default function PmsLiveFeedbackBridge(){
  const roomTimers=useRef(new Map())

  useEffect(()=>{
    if(typeof window==="undefined")return
    let wasOffline=!navigator.onLine

    const toast=detail=>window.dispatchEvent(new CustomEvent("hl:pms-toast",{detail}))

    const onOffline=()=>{
      wasOffline=true
      toast({
        id:"pms-connectivity",
        tone:"warning",
        title:"Sin conexión",
        message:"Seguimos mostrando lo que ya tenías cargado. Cuando vuelva internet, el PMS retomará la actualización.",
        duration:6500,
      })
    }

    const onOnline=()=>{
      if(!wasOffline)return
      wasOffline=false
      toast({
        id:"pms-connectivity",
        tone:"success",
        title:"Conexión recuperada",
        message:"Volvimos a estar en línea. Las señales del hotel se están actualizando otra vez.",
        duration:4200,
      })
      window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{source:"connectivity"}}))
    }

    const onRoomStatus=event=>{
      const detail=event?.detail||{}
      const ids=(Array.isArray(detail.roomIds)?detail.roomIds:[]).map(Number).filter(Boolean)
      const status=String(detail.status||"").trim().toLowerCase()
      if(!ids.length)return
      const key=ids.slice().sort((a,b)=>a-b).join("-")
      const previous=roomTimers.current.get(key)
      if(previous)window.clearTimeout(previous)
      const timer=window.setTimeout(()=>{
        roomTimers.current.delete(key)
        if(!READY_STATES.has(status))return
        const inspected=status==="inspeccionada"||status==="libre"
        toast({
          id:`housekeeping-room-${key}`,
          tone:"success",
          title:ids.length===1?labelForStatus(status):`${ids.length} habitaciones actualizadas`,
          message:ids.length===1
            ? inspected?"Quedó inspeccionada y lista para la operación.":"La limpieza quedó registrada. Ya puede seguir a inspección."
            : inspected?"El grupo quedó inspeccionado y disponible para la operación.":"La limpieza quedó registrada para las habitaciones seleccionadas.",
          duration:3400,
        })
      },850)
      roomTimers.current.set(key,timer)
    }

    window.addEventListener("offline",onOffline)
    window.addEventListener("online",onOnline)
    window.addEventListener("hl:pms-room-status-updated",onRoomStatus)
    return()=>{
      window.removeEventListener("offline",onOffline)
      window.removeEventListener("online",onOnline)
      window.removeEventListener("hl:pms-room-status-updated",onRoomStatus)
      for(const timer of roomTimers.current.values())window.clearTimeout(timer)
      roomTimers.current.clear()
    }
  },[])

  return null
}
