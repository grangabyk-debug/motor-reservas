"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const normalizeAmount=value=>Number(String(value??"").trim().replace(/\./g,"").replace(",","."))
const checkoutUrl=row=>row?.init_point||row?.sandbox_init_point||""
const statusInfo=value=>({approved:{label:"Pagado",tone:"ok"},requested:{label:"Enviado",tone:"wait"},pending:{label:"Pendiente",tone:"wait"},draft:{label:"Preparando",tone:"wait"},failed:{label:"Rechazado",tone:"bad"},expired:{label:"Vencido",tone:"muted"},cancelled:{label:"Cancelado",tone:"muted"}}[String(value||"").toLowerCase()]||{label:value||"Pendiente",tone:"wait"})

function Icon({kind,size=16}){
  if(kind==="close")return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>
  if(kind==="copy")return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.8"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" stroke="currentColor" strokeWidth="1.8"/></svg>
  if(kind==="refresh")return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M6.1 8.2A7 7 0 0 1 18.5 7M17.9 15.8A7 7 0 0 1 5.5 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M3 10h18M7 15h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
}

async function apiFetch(path,options={}){
  const{data:{session}}=await supabase.auth.getSession()
  if(!session?.access_token)throw new Error("La sesión venció. Volvé a iniciar sesión.")
  const response=await fetch(path,{...options,headers:{Authorization:`Bearer ${session.access_token}`,...(options.body?{"Content-Type":"application/json"}:{}),...(options.headers||{})},cache:"no-store"})
  const payload=await response.json().catch(()=>({}))
  if(!response.ok)throw new Error(payload?.error||"No se pudo completar la operación.")
  return payload
}

function SmallButton({children,onClick,disabled=false,primary=false,title}){return <button type="button" onClick={onClick} disabled={disabled} title={title} style={{minHeight:35,padding:"0 11px",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,border:`1px solid ${primary?"color-mix(in srgb,var(--accent) 75%,var(--line))":"var(--line)"}`,borderRadius:10,background:primary?"var(--accent)":"var(--panelSolid)",color:primary?"#fff":"var(--text)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1,whiteSpace:"nowrap"}}>{children}</button>}

export default function ReservationPaymentRequestPanel({item,propertyId,onChanged}){
  const[open,setOpen]=useState(false),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[verifying,setVerifying]=useState("")
  const[error,setError]=useState(""),[notice,setNotice]=useState(""),[requests,setRequests]=useState([]),[finance,setFinance]=useState(null),[config,setConfig]=useState(null)
  const[amount,setAmount]=useState(""),[expiresHours,setExpiresHours]=useState("72"),[message,setMessage]=useState("")
  const approvedRef=useRef(new Set())
  const connected=Boolean(config?.platform_ready&&config?.connection?.connected),currency=finance?.currency||item?.moneda||"ARS",balance=Number(finance?.balance||0)
  const pendingCount=useMemo(()=>requests.filter(row=>["requested","pending","draft"].includes(String(row.status))).length,[requests])

  async function load({quiet=false}={}){
    if(!item?.id||!propertyId)return
    if(!quiet)setLoading(true)
    try{
      const query=`property_id=${encodeURIComponent(propertyId)}&reservation_id=${encodeURIComponent(item.id)}`
      const[data,cfg]=await Promise.all([apiFetch(`/api/hotel/mercadopago/payment-request?${query}`),apiFetch(`/api/hotel/mercadopago/config?property_id=${encodeURIComponent(propertyId)}`)])
      const rows=data?.requests||[],nowApproved=new Set(rows.filter(row=>row.status==="approved").map(row=>row.id)),hadNew=[...nowApproved].some(id=>!approvedRef.current.has(id)&&approvedRef.current.size>0)
      approvedRef.current=nowApproved;setRequests(rows);setFinance(data?.finance||null);setConfig(cfg)
      const freshBalance=Number(data?.finance?.balance||0)
      if(!amount&&freshBalance>0)setAmount(String(freshBalance).replace(".",","))
      if(hadNew){setNotice("Pago confirmado y conciliado automáticamente en la reserva.");onChanged?.()}
      setError("")
    }catch(err){if(!quiet)setError(err?.message||"No se pudieron cargar los enlaces de pago.")}
    finally{if(!quiet)setLoading(false)}
  }

  useEffect(()=>{if(!open)return;approvedRef.current=new Set();setNotice("");setError("");setAmount("");load();const timer=setInterval(()=>load({quiet:true}),8000);return()=>clearInterval(timer)},[open,item?.id,propertyId])
  useEffect(()=>{setOpen(false);setRequests([]);setFinance(null);setConfig(null);setAmount("");approvedRef.current=new Set()},[item?.id,propertyId])

  async function createRequest(){
    if(saving)return
    const parsed=normalizeAmount(amount)
    if(!Number.isFinite(parsed)||parsed<=0)return setError("Ingresá un importe válido.")
    if(parsed>balance+.01)return setError(`El importe supera el saldo pendiente de ${money(balance,currency)}.`)
    if(currency!=="ARS")return setError("Mercado Pago emite este enlace en ARS. Esta reserva está expresada en otra moneda.")
    setSaving(true);setError("");setNotice("")
    try{
      const data=await apiFetch("/api/hotel/mercadopago/payment-request",{method:"POST",body:JSON.stringify({property_id:propertyId,reservation_id:Number(item.id),amount:parsed,currency:"ARS",expires_hours:Number(expiresHours),message:message.trim()||null})})
      setRequests(current=>[data.request,...current.filter(row=>row.id!==data.request?.id)]);setNotice("Enlace creado. Podés copiarlo o compartirlo con el huésped.")
      await load({quiet:true})
    }catch(err){setError(err?.message||"No se pudo generar el enlace de pago.")}
    finally{setSaving(false)}
  }

  async function verify(row){
    if(verifying)return
    setVerifying(row.id);setError("");setNotice("")
    try{
      const data=await apiFetch("/api/hotel/mercadopago/payment-request",{method:"PATCH",body:JSON.stringify({property_id:propertyId,request_id:row.id,action:"verify"})})
      if(data?.approved){setNotice("Pago confirmado y registrado automáticamente en la reserva.");onChanged?.()}
      else setNotice("Mercado Pago todavía no informa un pago aprobado para este enlace.")
      await load({quiet:true})
    }catch(err){setError(err?.message||"No se pudo verificar el pago.")}
    finally{setVerifying("")}
  }

  async function copyLink(row){
    const link=checkoutUrl(row);if(!link)return
    try{await navigator.clipboard.writeText(link);setNotice("Enlace copiado al portapapeles.")}catch{setError("No se pudo copiar automáticamente. Abrí el enlace y copialo desde el navegador.")}
  }
  function shareWhatsApp(row){const link=checkoutUrl(row);if(!link)return;const text=`Hola ${finance?.guest_name||item?.nombre_huesped||""}. Te compartimos el enlace seguro de Mercado Pago por ${money(row.amount,row.currency)} para tu reserva ${finance?.reservation_number||item?.numero_reserva||item?.id}: ${link}`;window.open(`https://wa.me/?text=${encodeURIComponent(text)}`,"_blank","noopener,noreferrer")}
  function shareEmail(row){const link=checkoutUrl(row);if(!link)return;const subject=`Pago de reserva ${finance?.reservation_number||item?.numero_reserva||item?.id}`,body=`Hola ${finance?.guest_name||item?.nombre_huesped||""},\n\nTe compartimos el enlace seguro de Mercado Pago por ${money(row.amount,row.currency)}:\n${link}\n\nEl enlace vence el ${fmtDateTime(row.expires_at)}.`;window.location.href=`mailto:${encodeURIComponent(item?.email_huesped||"")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}

  const overlay={position:"fixed",inset:0,zIndex:310,display:"grid",placeItems:"center",padding:14,background:"rgba(10,18,34,.42)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}
  const panel={width:"min(760px,calc(100vw - 24px))",maxHeight:"90vh",overflow:"auto",padding:18,border:"1px solid color-mix(in srgb,#fff 30%,var(--line))",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 95%,transparent)",boxShadow:"0 30px 90px rgba(10,20,40,.32)"}
  const field={height:40,border:"1px solid var(--line)",borderRadius:10,padding:"0 11px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11.5,minWidth:0,width:"100%",boxSizing:"border-box"}

  return <>
    <button type="button" onClick={()=>setOpen(true)} title="Solicitar un pago por Mercado Pago" style={{position:"fixed",right:22,bottom:78,zIndex:245,minHeight:42,padding:"0 15px",display:"flex",alignItems:"center",gap:8,border:"1px solid color-mix(in srgb,var(--accent) 65%,var(--line))",borderRadius:999,background:"color-mix(in srgb,var(--accent) 94%,#111 6%)",color:"#fff",boxShadow:"0 12px 32px color-mix(in srgb,var(--accent) 23%,transparent)",font:"inherit",fontSize:11,fontWeight:900,cursor:"pointer"}}><Icon/>Solicitar pago{pendingCount?<span style={{minWidth:19,height:19,padding:"0 5px",display:"grid",placeItems:"center",borderRadius:999,background:"rgba(255,255,255,.18)",fontSize:9}}>{pendingCount}</span>:null}</button>
    {open?<div style={overlay} onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <section style={panel} role="dialog" aria-modal="true" aria-label="Solicitar pago">
        <header style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,marginBottom:15}}><div><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><h2 style={{margin:0,fontSize:19,letterSpacing:"-.02em"}}>Solicitar pago</h2><span style={{padding:"4px 8px",borderRadius:999,border:"1px solid var(--line)",background:connected?"color-mix(in srgb,#2e9d63 10%,var(--panelSolid))":"color-mix(in srgb,#d08b26 10%,var(--panelSolid))",color:connected?"#287a4e":"#9a681d",fontSize:9,fontWeight:900}}>{connected?"Mercado Pago conectado":"Mercado Pago sin conectar"}</span></div><p style={{margin:"5px 0 0",color:"var(--muted)",fontSize:10.5,lineHeight:1.45}}>Reserva {finance?.reservation_number||item?.numero_reserva||item?.id}. El pago aprobado se imputa al folio y actualiza el saldo automáticamente.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar" style={{width:36,height:36,display:"grid",placeItems:"center",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",cursor:"pointer"}}><Icon kind="close"/></button></header>

        {error?<div style={{marginBottom:11,padding:"10px 12px",border:"1px solid color-mix(in srgb,#d24a4a 35%,var(--line))",borderRadius:11,background:"color-mix(in srgb,#d24a4a 7%,var(--panelSolid))",color:"#b33a3a",fontSize:10.5,fontWeight:700}}>{error}</div>:null}
        {notice?<div style={{marginBottom:11,padding:"10px 12px",border:"1px solid color-mix(in srgb,#2e9d63 32%,var(--line))",borderRadius:11,background:"color-mix(in srgb,#2e9d63 7%,var(--panelSolid))",color:"#287a4e",fontSize:10.5,fontWeight:700}}>{notice}</div>:null}

        {loading?<div style={{padding:18,border:"1px solid var(--line)",borderRadius:14,color:"var(--muted)",fontSize:11}}>Cargando saldo y configuración…</div>:<>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:9,marginBottom:12}}>
            <div style={{padding:12,border:"1px solid var(--line)",borderRadius:13,background:"color-mix(in srgb,var(--bg) 35%,var(--panelSolid))"}}><small style={{display:"block",color:"var(--muted)",fontSize:9}}>Total reserva / folio</small><b style={{display:"block",marginTop:4,fontSize:15}}>{money(finance?.total||0,currency)}</b></div>
            <div style={{padding:12,border:"1px solid var(--line)",borderRadius:13,background:"color-mix(in srgb,#2e9d63 5%,var(--panelSolid))"}}><small style={{display:"block",color:"var(--muted)",fontSize:9}}>Pagado</small><b style={{display:"block",marginTop:4,fontSize:15,color:"#287a4e"}}>{money(finance?.paid||0,currency)}</b></div>
            <div style={{padding:12,border:"1px solid color-mix(in srgb,var(--accent) 24%,var(--line))",borderRadius:13,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))"}}><small style={{display:"block",color:"var(--muted)",fontSize:9}}>Saldo pendiente</small><b style={{display:"block",marginTop:4,fontSize:15,color:"var(--accent)"}}>{money(balance,currency)}</b></div>
          </div>

          {!connected?<div style={{marginBottom:12,padding:12,border:"1px solid color-mix(in srgb,#d08b26 30%,var(--line))",borderRadius:13,background:"color-mix(in srgb,#d08b26 6%,var(--panelSolid))"}}><b style={{fontSize:11}}>Falta conectar la cuenta del hotel</b><p style={{margin:"4px 0 0",fontSize:10.2,lineHeight:1.5,color:"var(--muted)"}}>Un propietario o administrador debe completar la conexión de Mercado Pago. Hasta entonces se mantiene disponible el registro manual de pagos.</p></div>:null}

          <div style={{padding:14,border:"1px solid var(--line)",borderRadius:15,background:"color-mix(in srgb,var(--bg) 24%,var(--panelSolid))",marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"minmax(150px,1fr) minmax(130px,.7fr)",gap:10}}>
              <label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>IMPORTE<div style={{display:"flex",gap:6}}><input value={amount} onChange={event=>setAmount(event.target.value)} inputMode="decimal" placeholder="0,00" style={field}/><button type="button" onClick={()=>setAmount(String(balance).replace(".",","))} disabled={balance<=0} style={{padding:"0 9px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--accent)",font:"inherit",fontSize:9.5,fontWeight:900,cursor:"pointer"}}>SALDO</button></div></label>
              <label style={{display:"grid",gap:5,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>VENCIMIENTO<select value={expiresHours} onChange={event=>setExpiresHours(event.target.value)} style={field}><option value="24">24 horas</option><option value="48">48 horas</option><option value="72">72 horas</option><option value="120">5 días</option><option value="168">7 días</option></select></label>
            </div>
            <label style={{display:"grid",gap:5,marginTop:10,fontSize:9.5,fontWeight:850,color:"var(--muted)"}}>MENSAJE INTERNO / REFERENCIA<input value={message} onChange={event=>setMessage(event.target.value)} maxLength={180} placeholder="Ej. Seña del 50%" style={field}/></label>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap",marginTop:12}}><small style={{color:"var(--muted)",fontSize:9.7}}>No se guardan datos de tarjeta. El huésped paga en el checkout seguro de Mercado Pago.</small><SmallButton primary disabled={!connected||saving||balance<=0||currency!=="ARS"} onClick={createRequest}>{saving?"Generando…":"Generar enlace"}</SmallButton></div>
          </div>

          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}><div><b style={{fontSize:12}}>Enlaces de esta reserva</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:9.5}}>Los estados se actualizan solos; “Verificar” queda como respaldo operativo.</small></div><button type="button" onClick={()=>load()} title="Actualizar" style={{width:34,height:34,display:"grid",placeItems:"center",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",cursor:"pointer"}}><Icon kind="refresh"/></button></div>
          {!requests.length?<div style={{padding:15,border:"1px dashed var(--line)",borderRadius:12,color:"var(--muted)",fontSize:10.5}}>Todavía no se generaron enlaces de pago para esta reserva.</div>:<div style={{display:"grid",gap:8}}>{requests.map(row=>{const info=statusInfo(row.status),link=checkoutUrl(row),isPending=["requested","pending","draft"].includes(String(row.status));return <article key={row.id} style={{padding:12,border:"1px solid var(--line)",borderRadius:13,background:"var(--panelSolid)"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,flexWrap:"wrap"}}><div><div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}><b style={{fontSize:12.5}}>{money(row.amount,row.currency)}</b><span style={{padding:"3px 7px",borderRadius:999,background:info.tone==="ok"?"color-mix(in srgb,#2e9d63 10%,var(--panelSolid))":info.tone==="bad"?"color-mix(in srgb,#d24a4a 9%,var(--panelSolid))":info.tone==="wait"?"color-mix(in srgb,#d08b26 9%,var(--panelSolid))":"color-mix(in srgb,var(--bg) 50%,var(--panelSolid))",color:info.tone==="ok"?"#287a4e":info.tone==="bad"?"#b33a3a":info.tone==="wait"?"#9a681d":"var(--muted)",fontSize:8.8,fontWeight:900}}>{info.label}</span></div><small style={{display:"block",marginTop:4,color:"var(--muted)",fontSize:9.5}}>Creado {fmtDateTime(row.created_at)} · vence {fmtDateTime(row.expires_at)}{row.message?` · ${row.message}`:""}</small>{row.status==="approved"?<small style={{display:"block",marginTop:3,color:"#287a4e",fontSize:9.5,fontWeight:750}}>Conciliado automáticamente{row.approved_at?` · ${fmtDateTime(row.approved_at)}`:""}</small>:null}</div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{link&&isPending?<><SmallButton onClick={()=>copyLink(row)} title="Copiar enlace"><Icon kind="copy" size={14}/>Copiar</SmallButton><SmallButton onClick={()=>shareWhatsApp(row)}>WhatsApp</SmallButton><SmallButton onClick={()=>shareEmail(row)}>Email</SmallButton></>:null}{isPending?<SmallButton disabled={verifying===row.id} onClick={()=>verify(row)}>{verifying===row.id?"Verificando…":"Verificar"}</SmallButton>:null}</div></div></article>})}</div>}
        </>}
      </section>
    </div>:null}
  </>
}
