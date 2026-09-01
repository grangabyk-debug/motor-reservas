"use client"
import{useEffect,useState}from"react"
import{completeMercadoPagoOAuth}from"../services/mercadoPagoOAuth"

export default function MercadoPagoOAuthBridge(){
  const[state,setState]=useState(null)
  useEffect(()=>{
    const url=new URL(window.location.href),code=url.searchParams.get("mp_code"),oauthState=url.searchParams.get("mp_state"),oauthError=url.searchParams.get("mp_error")
    if(!code&&!oauthError)return
    const clean=()=>{["mp_code","mp_state","mp_error"].forEach(k=>url.searchParams.delete(k));window.history.replaceState({},"",`${url.pathname}${url.search}${url.hash}`)}
    if(oauthError){setState({kind:"error",text:`Mercado Pago: ${oauthError}`});clean();return}
    if(!oauthState){setState({kind:"error",text:"No pudimos validar el regreso de Mercado Pago."});clean();return}
    let active=true;setState({kind:"loading",text:"Terminando la conexión segura con Mercado Pago…"})
    ;(async()=>{try{const data=await completeMercadoPagoOAuth({code,state:oauthState});if(active)setState({kind:"ok",text:"Mercado Pago quedó conectado a este hotel."});window.dispatchEvent(new CustomEvent("hl:mercadopago-connected",{detail:data}))}catch(error){if(active)setState({kind:"error",text:error.message})}finally{clean();setTimeout(()=>active&&setState(null),5000)}})()
    return()=>{active=false}
  },[])
  if(!state)return null
  return <div style={{position:"fixed",zIndex:250,right:18,top:18,maxWidth:420,padding:"13px 16px",borderRadius:14,background:state.kind==="error"?"#6e2924":"#173126",color:"#fff",boxShadow:"0 18px 50px rgba(0,0,0,.24)",font:"600 12px system-ui"}}>{state.text}</div>
}