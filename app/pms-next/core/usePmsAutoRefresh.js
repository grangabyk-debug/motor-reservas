"use client"

import{useEffect,useRef,useState}from"react"

export default function usePmsAutoRefresh(propertyId,load,tables=[]){
  const timerRef=useRef(null),tablesKey=tables.join("|"),[generation,setGeneration]=useState(0)
  useEffect(()=>{
    if(!propertyId||typeof window==="undefined"||typeof load!=="function")return
    const wanted=new Set(tablesKey?tablesKey.split("|").filter(Boolean):[])
    const schedule=event=>{
      const detail=event?.detail||{}
      if(detail.propertyId&&String(detail.propertyId)!==String(propertyId))return
      const changed=Array.isArray(detail.tables)?detail.tables:detail.table?[detail.table]:[]
      if(wanted.size&&changed.length&&!changed.some(table=>wanted.has(table)||table==="resume"||table==="reconnected"))return
      if(timerRef.current)clearTimeout(timerRef.current)
      timerRef.current=setTimeout(()=>{timerRef.current=null;setGeneration(value=>value+1);load(true)},110)
    }
    window.addEventListener("hl:pms-data-updated",schedule)
    return()=>{if(timerRef.current)clearTimeout(timerRef.current);window.removeEventListener("hl:pms-data-updated",schedule)}
  },[propertyId,load,tablesKey])
  return generation
}
