"use client"

import{useEffect}from"react"

export default function DashboardWidgetEditBridge(){
  useEffect(()=>{
    if(typeof window==="undefined")return
    const url=new URL(window.location.href)
    if(url.searchParams.get("widgets")!=="1")return
    let tries=0
    const openEditor=()=>{
      tries++
      const button=document.querySelector('button[class*="customizeButton"]')
      if(button){
        button.click()
        url.searchParams.delete("widgets")
        window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`)
        clearInterval(timer)
      }else if(tries>=80){
        clearInterval(timer)
      }
    }
    const timer=setInterval(openEditor,125)
    openEditor()
    return()=>clearInterval(timer)
  },[])
  return null
}
