"use client"

import{useEffect}from"react"
import BookingEngine from"./BookingEngine"

function sessionId(){try{const key="hl:web-session",saved=sessionStorage.getItem(key);if(saved)return saved;const value=globalThis.crypto?.randomUUID?.()||`hl-${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem(key,value);return value}catch{return""}}
export default function BookingEngineTracked({slug,embedded,initialSearch,source="direct"}){useEffect(()=>{fetch(`/api/public/booking/${encodeURIComponent(slug)}/event`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({event:"engine_view",source,session:sessionId()})}).catch(()=>{})},[slug,source]);return <BookingEngine slug={slug} embedded={embedded} initialSearch={initialSearch}/>}
