"use client"

import{useCallback,useEffect,useRef,useState}from"react"

const clamp=value=>Math.min(1.25,Math.max(.7,value))
const snap=value=>Math.round(clamp(value)*20)/20

export default function useReportViewport(columnCount){
  const shellRef=useRef(null),bottomRef=useRef(null)
  const[zoom,setZoom]=useState(1)
  const fitToWidth=useCallback(()=>{
    const width=shellRef.current?.clientWidth||0
    if(!width||!columnCount)return
    const target=(width-46)/(columnCount*138)
    setZoom(snap(Math.min(1,target)))
  },[columnCount])
  useEffect(()=>{
    const frame=requestAnimationFrame(fitToWidth)
    const resize=()=>fitToWidth()
    window.addEventListener("resize",resize)
    return()=>{cancelAnimationFrame(frame);window.removeEventListener("resize",resize)}
  },[fitToWidth])
  const onShellScroll=useCallback(event=>{const other=bottomRef.current;if(other&&Math.abs(other.scrollLeft-event.currentTarget.scrollLeft)>1)other.scrollLeft=event.currentTarget.scrollLeft},[])
  const onBottomScroll=useCallback(event=>{const other=shellRef.current;if(other&&Math.abs(other.scrollLeft-event.currentTarget.scrollLeft)>1)other.scrollLeft=event.currentTarget.scrollLeft},[])
  const zoomIn=useCallback(()=>setZoom(value=>snap(value+.1)),[])
  const zoomOut=useCallback(()=>setZoom(value=>snap(value-.1)),[])
  const cellWidth=Math.max(90,Math.round(128*zoom)),minWidth=Math.max(Math.round(660*zoom),Math.round(columnCount*138*zoom+38))
  return{shellRef,bottomRef,onShellScroll,onBottomScroll,zoom,zoomPercent:Math.round(zoom*100),zoomIn,zoomOut,fitToWidth,cellWidth,minWidth}
}
