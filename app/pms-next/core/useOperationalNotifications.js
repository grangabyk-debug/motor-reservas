"use client"

import{useCallback,useEffect,useRef,useState}from"react"

const KEY_PREFIX="hl:ops-notifications:"

function playAlert(){
  if(typeof window==="undefined")return
  try{
    const AudioContext=window.AudioContext||window.webkitAudioContext
    if(!AudioContext)return
    const ctx=new AudioContext(),gain=ctx.createGain(),osc=ctx.createOscillator()
    osc.type="sine";osc.frequency.setValueAtTime(740,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(980,ctx.currentTime+.13)
    gain.gain.setValueAtTime(.0001,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.12,ctx.currentTime+.015);gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.24)
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.25);osc.onended=()=>ctx.close().catch(()=>{})
  }catch{}
}

export default function useOperationalNotifications({area}){
  const storageKey=`${KEY_PREFIX}${area}`,[enabled,setEnabled]=useState(false),enabledRef=useRef(false)
  useEffect(()=>{if(typeof window==="undefined")return;const next=window.localStorage.getItem(storageKey)==="1";enabledRef.current=next;setEnabled(next)},[storageKey])

  const toggle=useCallback(async()=>{
    const next=!enabledRef.current
    if(next&&typeof window!=="undefined"&&"Notification"in window&&Notification.permission==="default"){
      try{await Notification.requestPermission()}catch{}
    }
    enabledRef.current=next;setEnabled(next)
    if(typeof window!=="undefined"){
      window.localStorage.setItem(storageKey,next?"1":"0")
      window.dispatchEvent(new CustomEvent("hl:ops-notification-setting",{detail:{area,enabled:next}}))
    }
    if(next)playAlert()
  },[storageKey,area])

  return{enabled,toggle}
}
