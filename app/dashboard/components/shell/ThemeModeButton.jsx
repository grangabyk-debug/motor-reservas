"use client"

import{useEffect,useState}from"react"
import ui from"./shell.module.css"

const STORAGE_KEY="habitacion-llena:interface-theme"
const EVENT_NAME="habitacion-llena:theme-change"

function normalizedTheme(value){return value==="dark"?"dark":"light"}

function systemTheme(){
  if(typeof window==="undefined")return"light"
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches?"dark":"light"
}

function storedTheme(){
  if(typeof window==="undefined")return"light"
  try{return normalizedTheme(window.localStorage.getItem(STORAGE_KEY)||systemTheme())}catch{return systemTheme()}
}

function applyTheme(theme){
  if(typeof document==="undefined")return
  const next=normalizedTheme(theme)
  document.documentElement.dataset.hlTheme=next
  document.documentElement.style.colorScheme=next
  const meta=document.querySelector('meta[name="theme-color"]')
  if(meta)meta.setAttribute("content",next==="dark"?"#0b1020":"#f4f6fb")
}

export default function ThemeModeButton({compact=false}){
  const[theme,setTheme]=useState("light")

  useEffect(()=>{
    const initial=storedTheme()
    setTheme(initial)
    applyTheme(initial)
    const sync=event=>{
      const next=normalizedTheme(event?.detail?.theme||storedTheme())
      setTheme(next)
      applyTheme(next)
    }
    window.addEventListener(EVENT_NAME,sync)
    return()=>window.removeEventListener(EVENT_NAME,sync)
  },[])

  function toggle(){
    const next=theme==="dark"?"light":"dark"
    setTheme(next)
    applyTheme(next)
    try{window.localStorage.setItem(STORAGE_KEY,next)}catch{}
    window.dispatchEvent(new CustomEvent(EVENT_NAME,{detail:{theme:next}}))
  }

  const dark=theme==="dark"
  return <button type="button" className={`${ui.themeToggle} ${compact?ui.themeToggleCompact:""}`} onClick={toggle} aria-label={dark?"Activar modo día":"Activar modo noche"} title={dark?"Modo día":"Modo noche"}>
    <span className={ui.themeGlyph} aria-hidden="true">{dark?"☀":"☾"}</span>
    {!compact&&<span>{dark?"Día":"Noche"}</span>}
  </button>
}
