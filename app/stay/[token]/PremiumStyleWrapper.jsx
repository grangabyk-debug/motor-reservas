"use client"

import{useEffect,useState}from"react"
import{useParams}from"next/navigation"
import{supabase}from"../../../lib/supabase"
import GuestPortalRuntime from"./GuestPortalRuntime"
import p from"./premium.module.css"

const VALID=new Set(["es","en","pt"])
function languageButton(button){const text=String(button?.textContent||"").replace(/\s+/g,"").toUpperCase();if(text.startsWith("ESESPAÑOL"))return"es";if(text.startsWith("ENENGLISH"))return"en";if(text.startsWith("PTPORTUGUÊS")||text.startsWith("PTPORTUGUES"))return"pt";return null}

export default function PremiumStyleWrapper(){
  const params=useParams(),token=String(params?.token||""),[ready,setReady]=useState(token==="demo")
  useEffect(()=>{
    let alive=true
    const key=`hl:stay-lang:${token}`
    async function bootstrap(){
      if(!token||token==="demo"){if(alive)setReady(true);return}
      try{
        const{data}=await supabase.rpc("hl_guest_stay_portal_snapshot",{p_token:token})
        if(!alive)return
        const allowed=(Array.isArray(data?.guide?.languages)&&data.guide.languages.length?data.guide.languages:["es"]).filter(code=>VALID.has(code))
        const stored=window.localStorage.getItem(key),configured=String(data?.guide?.default_language||"")
        const selected=stored&&allowed.includes(stored)?stored:allowed.includes(configured)?configured:allowed[0]||"es"
        window.localStorage.setItem("hl:stay-lang",selected)
        document.documentElement.lang=selected
      }catch{}finally{if(alive)setReady(true)}
    }
    const remember=event=>{const button=event.target?.closest?.("button"),selected=languageButton(button);if(!selected)return;try{window.localStorage.setItem(key,selected);window.localStorage.setItem("hl:stay-lang",selected);document.documentElement.lang=selected}catch{}}
    document.addEventListener("click",remember,true);bootstrap()
    return()=>{alive=false;document.removeEventListener("click",remember,true)}
  },[token])
  return <div className={p.premium}>{ready?<GuestPortalRuntime/>:null}</div>
}
