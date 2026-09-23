"use client"

import{useEffect,useMemo,useState}from"react"

const EVENT="hl:pms-dialog"

function openDialog(options={}){
  if(typeof window==="undefined")return Promise.resolve(false)
  return new Promise(resolve=>{
    window.dispatchEvent(new CustomEvent(EVENT,{detail:{...options,resolve}}))
  })
}

export function pmsConfirm({title="Confirmar acción",message="",detail="",confirmLabel="Confirmar",cancelLabel="Cancelar",tone="danger"}={}){
  return openDialog({kind:"confirm",title,message,detail,confirmLabel,cancelLabel,tone})
}

export function pmsAlert({title="Aviso",message="",detail="",confirmLabel="Entendido",tone="info"}={}){
  return openDialog({kind:"alert",title,message,detail,confirmLabel,tone})
}

export function pmsPrompt({title="Completar dato",message="",detail="",inputLabel="",defaultValue="",placeholder="",confirmLabel="Guardar",cancelLabel="Cancelar",tone="info",multiline=false}={}){
  return openDialog({kind:"prompt",title,message,detail,inputLabel,defaultValue,placeholder,confirmLabel,cancelLabel,tone,multiline})
}

export default function PmsDialogHost(){
  const[queue,setQueue]=useState([]),[inputValue,setInputValue]=useState("")
  const active=queue[0]||null

  useEffect(()=>{
    const handler=event=>{
      const detail=event?.detail||{}
      if(typeof detail.resolve!=="function")return
      setQueue(current=>[...current,{...detail,id:`pms-dialog-${Date.now()}-${Math.random().toString(36).slice(2)}`}])
    }
    window.addEventListener(EVENT,handler)
    return()=>window.removeEventListener(EVENT,handler)
  },[])

  useEffect(()=>{if(active?.kind==="prompt")setInputValue(String(active.defaultValue??""))},[active?.id])

  useEffect(()=>{
    if(!active)return
    const key=event=>{if(event.key==="Escape"){event.preventDefault();finish(active.kind==="alert"?true:active.kind==="prompt"?null:false)}}
    window.addEventListener("keydown",key)
    return()=>window.removeEventListener("keydown",key)
  },[active?.id])

  function finish(value){
    if(!active)return
    try{active.resolve(active.kind==="prompt"?value:Boolean(value))}catch{}
    setQueue(current=>current.slice(1))
  }

  const palette=useMemo(()=>{
    if(active?.tone==="danger")return{accent:"var(--red)",soft:"color-mix(in srgb,var(--red) 9%,var(--panelSolid))",line:"color-mix(in srgb,var(--red) 28%,var(--line))",icon:"!"}
    if(active?.tone==="warning")return{accent:"#a36d16",soft:"color-mix(in srgb,#d59a2c 10%,var(--panelSolid))",line:"color-mix(in srgb,#d59a2c 30%,var(--line))",icon:"!"}
    return{accent:"var(--accent)",soft:"color-mix(in srgb,var(--accent) 9%,var(--panelSolid))",line:"color-mix(in srgb,var(--accent) 24%,var(--line))",icon:active?.kind==="alert"?"i":"?"}
  },[active?.tone,active?.kind])

  if(!active)return null
  const alertOnly=active.kind==="alert",promptMode=active.kind==="prompt"
  return <div role="presentation" style={{position:"fixed",inset:0,zIndex:2000,display:"grid",placeItems:"center",padding:16,background:"rgba(12,20,38,.34)",backdropFilter:"blur(12px) saturate(1.12)",WebkitBackdropFilter:"blur(12px) saturate(1.12)"}}>
    <section role={alertOnly?"alertdialog":"dialog"} aria-modal="true" aria-label={active.title||"Confirmar acción"} style={{width:"min(440px,calc(100vw - 28px))",overflow:"hidden",border:"1px solid color-mix(in srgb,#fff 34%,var(--line))",borderRadius:20,background:"color-mix(in srgb,var(--panelSolid) 96%,transparent)",boxShadow:"inset 0 1px color-mix(in srgb,#fff 55%,transparent),0 28px 80px rgba(14,24,46,.3)",color:"var(--text)"}}>
      <div style={{padding:"18px 18px 14px",display:"grid",gridTemplateColumns:"42px 1fr",gap:12,alignItems:"start"}}>
        <span aria-hidden="true" style={{width:40,height:40,display:"grid",placeItems:"center",border:`1px solid ${palette.line}`,borderRadius:13,background:palette.soft,color:palette.accent,fontSize:18,fontWeight:950}}>{palette.icon}</span>
        <div><small style={{display:"block",marginBottom:4,fontSize:9,fontWeight:950,letterSpacing:".1em",color:palette.accent}}>{alertOnly?"AVISO":"CONFIRMAR ACCIÓN"}</small><h2 style={{margin:0,fontSize:17,lineHeight:1.2}}>{active.title}</h2>{active.message?<p style={{margin:"8px 0 0",fontSize:11.2,lineHeight:1.55,color:"var(--muted)"}}>{active.message}</p>:null}{active.detail?<p style={{margin:"7px 0 0",padding:"8px 9px",border:"1px solid var(--line)",borderRadius:9,background:"color-mix(in srgb,var(--bg) 45%,var(--panelSolid))",fontSize:10,lineHeight:1.45,color:"var(--muted)"}}>{active.detail}</p>:null}{promptMode?<label style={{display:"grid",gap:5,marginTop:12,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>{active.inputLabel||"Dato"}{active.multiline?<textarea autoFocus rows="3" value={inputValue} onChange={event=>setInputValue(event.target.value)} placeholder={active.placeholder||""} style={{width:"100%",boxSizing:"border-box",resize:"vertical",border:"1px solid var(--line)",borderRadius:10,padding:"9px 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,lineHeight:1.45,outline:"none"}}/>:<input autoFocus value={inputValue} onChange={event=>setInputValue(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();finish(inputValue)}}} placeholder={active.placeholder||""} style={{height:39,width:"100%",boxSizing:"border-box",border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,outline:"none"}}/>}</label>:null}</div>
      </div>
      <footer style={{padding:"12px 16px 16px",display:"flex",justifyContent:"flex-end",gap:8,borderTop:"1px solid var(--line)"}}>
        {!alertOnly?<button type="button" autoFocus={!promptMode} onClick={()=>finish(promptMode?null:false)} style={{height:39,padding:"0 14px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panel)",color:"var(--text)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:"pointer"}}>{active.cancelLabel||"Cancelar"}</button>:null}
        <button type="button" autoFocus={alertOnly} onClick={()=>finish(promptMode?inputValue:true)} style={{height:39,padding:"0 15px",border:0,borderRadius:10,background:active.tone==="danger"?"var(--red)":"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",font:"inherit",fontSize:10.5,fontWeight:900,cursor:"pointer",boxShadow:"0 8px 20px color-mix(in srgb,var(--accent) 20%,transparent)"}}>{active.confirmLabel||"Confirmar"}</button>
      </footer>
    </section>
  </div>
}
