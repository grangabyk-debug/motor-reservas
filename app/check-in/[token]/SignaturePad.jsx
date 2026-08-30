"use client"

import { useEffect,useRef,useState } from "react"
import ui from "./checkin.module.css"

export default function SignaturePad({onChange}){
  const canvasRef=useRef(null),drawing=useRef(false),[signed,setSigned]=useState(false)
  useEffect(()=>{const canvas=canvasRef.current;if(!canvas)return;const resize=()=>{const ratio=Math.max(1,window.devicePixelRatio||1),rect=canvas.getBoundingClientRect(),old=signed;canvas.width=Math.floor(rect.width*ratio);canvas.height=Math.floor(rect.height*ratio);const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);ctx.lineWidth=2;ctx.lineCap="round";ctx.strokeStyle="#193127";if(old)setSigned(false)};resize();window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize)},[])
  function point(e){const rect=canvasRef.current.getBoundingClientRect(),p=e.touches?.[0]||e;return{x:p.clientX-rect.left,y:p.clientY-rect.top}}
  function start(e){e.preventDefault();drawing.current=true;const p=point(e),ctx=canvasRef.current.getContext("2d");ctx.beginPath();ctx.moveTo(p.x,p.y)}
  function move(e){if(!drawing.current)return;e.preventDefault();const p=point(e),ctx=canvasRef.current.getContext("2d");ctx.lineTo(p.x,p.y);ctx.stroke();setSigned(true)}
  function end(){if(!drawing.current)return;drawing.current=false;if(signed||canvasRef.current){const data=canvasRef.current.toDataURL("image/png",.72);onChange?.(data);setSigned(true)}}
  function clear(){const canvas=canvasRef.current,ctx=canvas.getContext("2d");ctx.clearRect(0,0,canvas.width,canvas.height);setSigned(false);onChange?.("")}
  return <div className={ui.signature}><canvas ref={canvasRef} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}/><div><span>{signed?"Firma registrada":"Firmá con el dedo o mouse"}</span><button type="button" onClick={clear}>Limpiar</button></div></div>
}
