"use client"

import{useEffect,useMemo,useState}from"react"

const THEME_KEY="hl-pms-theme"

export default function DashboardChrome({children}){
  const[theme,setTheme]=useState("light"),[clock,setClock]=useState(null)

  useEffect(()=>{
    try{
      const saved=localStorage.getItem(THEME_KEY)
      if(saved==="dark"||saved==="light")setTheme(saved)
      else if(window.matchMedia?.("(prefers-color-scheme: dark)").matches)setTheme("dark")
    }catch{}
  },[])

  useEffect(()=>{
    try{localStorage.setItem(THEME_KEY,theme)}catch{}
    const root=document.querySelector(".hlHotelgest")
    if(!root)return
    root.classList.toggle("hlThemeDark",theme==="dark")
    root.classList.toggle("hlThemeLight",theme!=="dark")
    root.dataset.hlTheme=theme
    return()=>{root.classList.remove("hlThemeDark","hlThemeLight");delete root.dataset.hlTheme}
  },[theme])

  useEffect(()=>{
    const tick=()=>setClock(new Date())
    tick()
    const id=setInterval(tick,30000)
    return()=>clearInterval(id)
  },[])

  const dateLabel=useMemo(()=>clock?new Intl.DateTimeFormat("es-AR",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}).format(clock):"",[clock])
  const timeLabel=useMemo(()=>clock?new Intl.DateTimeFormat("es-AR",{hour:"2-digit",minute:"2-digit"}).format(clock):"",[clock])
  const dark=theme==="dark"

  return <>
    <div className="hlUtilityBar" role="banner">
      <div className="hlUtilityRegion"><span className="hlUtilityFlag" aria-hidden="true">▰</span><span>Hecho en Argentina</span></div>
      <div className="hlUtilityRight">
        <time className="hlUtilityClock" dateTime={clock?.toISOString?.()||undefined}><span>{dateLabel}</span><strong>{timeLabel}</strong></time>
        <button type="button" className="hlThemeToggle" onClick={()=>setTheme(dark?"light":"dark")} aria-label={dark?"Activar modo claro":"Activar modo oscuro"} title={dark?"Modo claro":"Modo oscuro"}><span aria-hidden="true">{dark?"☀":"☾"}</span><em>{dark?"Claro":"Oscuro"}</em></button>
      </div>
    </div>
    {children}
  </>
}
