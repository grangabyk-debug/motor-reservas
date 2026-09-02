"use client"

import{useEffect,useState}from"react"
import s from"./pwa-installer.module.css"

const standalone=()=>typeof window!=="undefined"&&(window.matchMedia?.("(display-mode: standalone)")?.matches||window.navigator?.standalone===true)

export default function PWAInstaller(){
  const[promptEvent,setPromptEvent]=useState(null)
  const[installed,setInstalled]=useState(false)

  useEffect(()=>{
    setInstalled(standalone())

    if("serviceWorker"in navigator){
      navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(()=>{})
    }

    const onPrompt=event=>{
      event.preventDefault()
      if(!standalone())setPromptEvent(event)
    }
    const onInstalled=()=>{
      setInstalled(true)
      setPromptEvent(null)
    }

    window.addEventListener("beforeinstallprompt",onPrompt)
    window.addEventListener("appinstalled",onInstalled)
    return()=>{
      window.removeEventListener("beforeinstallprompt",onPrompt)
      window.removeEventListener("appinstalled",onInstalled)
    }
  },[])

  if(installed||!promptEvent)return null

  async function install(){
    try{
      await promptEvent.prompt()
      const choice=await promptEvent.userChoice
      if(choice?.outcome==="accepted")setInstalled(true)
    }finally{
      setPromptEvent(null)
    }
  }

  return <button type="button" className={s.install} onClick={install} aria-label="Instalar Habitación Llena como aplicación" title="Instalar Habitación Llena"><span aria-hidden="true">⇩</span><b>Instalar app</b></button>
}
