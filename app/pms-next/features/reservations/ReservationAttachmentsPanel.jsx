"use client"

import{useEffect,useMemo,useRef,useState}from"react"
import{supabase}from"../../../../lib/supabase"

const BUCKET="hotel-reservation-documents"
const MAX_BYTES=12*1024*1024
const TYPES={contract:"Contrato",authorization:"Autorización",receipt:"Comprobante",guest_file:"Documento adicional",image:"Imagen",other:"Otro"}
const fmtDate=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"—"
const sizeLabel=value=>{const n=Number(value)||0;if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(n<10240?1:0)} KB`;return`${(n/1024/1024).toFixed(1)} MB`}
const safeName=value=>String(value||"archivo").trim().replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-").slice(0,120)||"archivo"

function Icon({kind,size=16}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none","aria-hidden":true}
  if(kind==="close")return <svg {...common}><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
  if(kind==="camera")return <svg {...common}><path d="M5 7h3l1.2-2h5.6L16 7h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7"/><circle cx="12" cy="13" r="3.3" stroke="currentColor" strokeWidth="1.7"/></svg>
  if(kind==="trash")return <svg {...common}><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  if(kind==="open")return <svg {...common}><path d="M14 5h5v5M19 5l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" strokeWidth="1.8"/></svg>
  if(kind==="upload")return <svg {...common}><path d="M12 16V4m0 0-4 4m4-4 4 4M5 15v4h14v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
  return <svg {...common}><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.7"/><path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function Button({children,onClick,primary=false,disabled=false,title}){return <button type="button" onClick={onClick} disabled={disabled} title={title} style={{minHeight:36,padding:"0 11px",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,border:`1px solid ${primary?"color-mix(in srgb,var(--accent) 70%,var(--line))":"var(--line)"}`,borderRadius:10,background:primary?"var(--accent)":"var(--panelSolid)",color:primary?"#fff":"var(--text)",font:"inherit",fontSize:10.5,fontWeight:850,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.55:1}}>{children}</button>}

export default function ReservationAttachmentsPanel({item,propertyId}){
  const[open,setOpen]=useState(false),[rows,setRows]=useState([]),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false),[removing,setRemoving]=useState("")
  const[error,setError]=useState(""),[notice,setNotice]=useState(""),[pending,setPending]=useState(null),[kind,setKind]=useState("guest_file"),[displayName,setDisplayName]=useState(""),[note,setNote]=useState("")
  const fileRef=useRef(null),cameraRef=useRef(null)
  const count=rows.length
  const sorted=useMemo(()=>[...rows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)),[rows])

  async function load({quiet=false}={}){
    if(!item?.id||!propertyId)return
    if(!quiet)setLoading(true)
    const result=await supabase.from("hotel_reservation_documents").select("id,property_id,reserva_id,kind,file_name,storage_path,mime_type,original_size_bytes,stored_size_bytes,uploaded_by,created_at,holder_role,holder_name,metadata").eq("property_id",propertyId).eq("reserva_id",Number(item.id)).order("created_at",{ascending:false})
    if(result.error){if(!quiet)setError(result.error.message)}else{setRows(result.data||[]);if(!quiet)setError("")}
    if(!quiet)setLoading(false)
  }
  useEffect(()=>{load({quiet:true})},[item?.id,propertyId])
  useEffect(()=>{if(!open)return;load();const channel=supabase.channel(`reservation-attachments-${propertyId}-${item?.id}`).on("postgres_changes",{event:"*",schema:"public",table:"hotel_reservation_documents",filter:`property_id=eq.${propertyId}`},payload=>{const row=payload.new||payload.old;if(Number(row?.reserva_id)===Number(item?.id))load({quiet:true})}).subscribe();return()=>{supabase.removeChannel(channel)}},[open,item?.id,propertyId])
  useEffect(()=>{setOpen(false);setRows([]);setPending(null);setKind("guest_file");setDisplayName("");setNote("");setError("");setNotice("");load({quiet:true})},[item?.id,propertyId])

  function choose(file){
    if(!file)return
    setError("");setNotice("")
    if(file.size>MAX_BYTES){setError("El archivo supera el máximo de 12 MB.");return}
    if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(file.type)){setError("Formato no admitido. Usá PDF, JPG, PNG o WebP.");return}
    setPending(file);setDisplayName(file.name.replace(/\.[^.]+$/,""));if(file.type.startsWith("image/"))setKind("image")
  }
  function clearPending(){setPending(null);setDisplayName("");setNote("");if(fileRef.current)fileRef.current.value="";if(cameraRef.current)cameraRef.current.value=""}
  async function upload(){
    if(!pending||saving)return
    const custom=displayName.trim();if(!custom)return setError("Poné un nombre para identificar el archivo.")
    setSaving(true);setError("");setNotice("")
    let storagePath=""
    try{
      const{data:userData,error:userError}=await supabase.auth.getUser();if(userError)throw userError
      const extension=(pending.name.split(".").pop()||pending.type.split("/").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"")
      const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`
      storagePath=`${propertyId}/${item.id}/attachments/${id}-${safeName(custom)}.${extension}`
      const stored=await supabase.storage.from(BUCKET).upload(storagePath,pending,{contentType:pending.type,upsert:false,cacheControl:"3600"});if(stored.error)throw stored.error
      const payload={property_id:propertyId,reserva_id:Number(item.id),kind,file_name:`${custom}.${extension}`,storage_path:storagePath,mime_type:pending.type,original_size_bytes:pending.size,stored_size_bytes:pending.size,uploaded_by:userData?.user?.id||null,holder_role:"reservation",holder_name:item.nombre_huesped||null,metadata:{label:custom,note:note.trim()||null,source:"pms_reservation_attachments"}}
      const inserted=await supabase.from("hotel_reservation_documents").insert(payload).select().single();if(inserted.error)throw inserted.error
      setRows(current=>[inserted.data,...current]);clearPending();setKind("guest_file");setNotice("Archivo guardado en la reserva.");window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_reservation_documents"]}}))
    }catch(err){if(storagePath)await supabase.storage.from(BUCKET).remove([storagePath]).catch(()=>{});setError(err?.message||"No se pudo cargar el archivo.")}
    finally{setSaving(false)}
  }
  async function signedUrl(row){const result=await supabase.storage.from(BUCKET).createSignedUrl(row.storage_path,180);if(result.error)throw result.error;return result.data.signedUrl}
  async function openFile(row){try{setError("");const url=await signedUrl(row);window.open(url,"_blank","noopener,noreferrer")}catch(err){setError(err?.message||"No se pudo abrir el archivo.")}}
  async function remove(row){
    if(removing||!window.confirm(`Eliminar “${row.file_name}” de esta reserva?`))return
    setRemoving(row.id);setError("");setNotice("")
    try{const deleted=await supabase.from("hotel_reservation_documents").delete().eq("id",row.id).eq("property_id",propertyId).eq("reserva_id",Number(item.id));if(deleted.error)throw deleted.error;await supabase.storage.from(BUCKET).remove([row.storage_path]);setRows(current=>current.filter(item=>item.id!==row.id));setNotice("Adjunto eliminado.");window.dispatchEvent(new CustomEvent("hl:pms-data-updated",{detail:{propertyId,tables:["hotel_reservation_documents"]}}))}catch(err){setError(err?.message||"No se pudo eliminar el archivo.")}finally{setRemoving("")}
  }

  const overlay={position:"fixed",inset:0,zIndex:315,display:"grid",placeItems:"center",padding:14,background:"rgba(10,18,34,.42)",backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)"}
  const panel={width:"min(820px,calc(100vw - 24px))",maxHeight:"90vh",overflow:"auto",padding:18,border:"1px solid color-mix(in srgb,#fff 30%,var(--line))",borderRadius:22,background:"color-mix(in srgb,var(--panelSolid) 95%,transparent)",boxShadow:"0 30px 90px rgba(10,20,40,.32)"}
  const field={height:39,width:"100%",boxSizing:"border-box",border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11}
  return <>
    <button type="button" onClick={()=>setOpen(true)} title="Archivos adjuntos de la reserva" style={{position:"fixed",right:22,bottom:128,zIndex:244,minHeight:40,padding:"0 13px",display:"flex",alignItems:"center",gap:7,border:"1px solid var(--line)",borderRadius:999,background:"color-mix(in srgb,var(--panelSolid) 94%,transparent)",color:"var(--text)",boxShadow:"0 10px 28px rgba(20,30,54,.13)",backdropFilter:"blur(14px)",font:"inherit",fontSize:10.5,fontWeight:900,cursor:"pointer"}}><Icon/>Adjuntos{count?<span style={{minWidth:19,height:19,padding:"0 5px",display:"grid",placeItems:"center",borderRadius:999,background:"color-mix(in srgb,var(--accent) 12%,var(--panelSolid))",color:"var(--accent)",fontSize:10}}>{count}</span>:null}</button>
    {open?<div style={overlay} onMouseDown={event=>event.target===event.currentTarget&&!saving&&setOpen(false)}><section style={panel} role="dialog" aria-modal="true" aria-label="Adjuntos de la reserva">
      <header style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:14,marginBottom:14}}><div><small style={{display:"block",fontSize:10,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>RESERVA {item.numero_reserva||item.id}</small><h2 style={{margin:"4px 0 0",fontSize:20,letterSpacing:"-.02em"}}>Adjuntos</h2><p style={{margin:"5px 0 0",fontSize:10.5,lineHeight:1.45,color:"var(--muted)"}}>Contratos, autorizaciones, comprobantes y otros archivos vinculados a esta estadía.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar" style={{width:36,height:36,display:"grid",placeItems:"center",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",color:"var(--text)",cursor:"pointer"}}><Icon kind="close"/></button></header>
      {error?<div style={{marginBottom:10,padding:"9px 11px",border:"1px solid color-mix(in srgb,#d24a4a 32%,var(--line))",borderRadius:10,background:"color-mix(in srgb,#d24a4a 6%,var(--panelSolid))",color:"#b33a3a",fontSize:10.5,fontWeight:750}}>{error}</div>:null}{notice?<div style={{marginBottom:10,padding:"9px 11px",border:"1px solid color-mix(in srgb,#2e9d63 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,#2e9d63 6%,var(--panelSolid))",color:"#287a4e",fontSize:10.5,fontWeight:750}}>{notice}</div>:null}
      <div style={{padding:13,border:"1px solid var(--line)",borderRadius:15,background:"color-mix(in srgb,var(--bg) 26%,var(--panelSolid))",marginBottom:14}}><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><div><b style={{fontSize:12}}>Agregar archivo</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:10}}>PDF, JPG, PNG o WebP · hasta 12 MB</small></div><div style={{display:"flex",gap:7,flexWrap:"wrap"}}><input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={event=>choose(event.target.files?.[0])}/><input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={event=>choose(event.target.files?.[0])}/><Button onClick={()=>fileRef.current?.click()}><Icon kind="upload"/>Elegir archivo</Button><Button onClick={()=>cameraRef.current?.click()}><Icon kind="camera"/>Tomar foto</Button></div></div>
        {pending?<div style={{display:"grid",gridTemplateColumns:"minmax(0,1.3fr) minmax(140px,.7fr)",gap:9,marginTop:12}}><label style={{display:"grid",gap:5,fontSize:10,fontWeight:850,color:"var(--muted)"}}>NOMBRE<input value={displayName} onChange={event=>setDisplayName(event.target.value)} maxLength={100} style={field}/></label><label style={{display:"grid",gap:5,fontSize:10,fontWeight:850,color:"var(--muted)"}}>TIPO<select value={kind} onChange={event=>setKind(event.target.value)} style={field}>{Object.entries(TYPES).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label style={{display:"grid",gap:5,gridColumn:"1/-1",fontSize:10,fontWeight:850,color:"var(--muted)"}}>NOTA OPCIONAL<input value={note} onChange={event=>setNote(event.target.value)} maxLength={180} placeholder="Ej. firmado al check-in" style={field}/></label><div style={{gridColumn:"1/-1",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",paddingTop:2}}><small style={{fontSize:10,color:"var(--muted)"}}>{pending.name} · {sizeLabel(pending.size)}</small><div style={{display:"flex",gap:7}}><Button onClick={clearPending} disabled={saving}>Cancelar</Button><Button primary onClick={upload} disabled={saving}>{saving?"Guardando…":"Guardar adjunto"}</Button></div></div></div>:null}</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:8}}><div><b style={{fontSize:12.5}}>Archivos de la reserva</b><small style={{display:"block",marginTop:2,color:"var(--muted)",fontSize:10}}>{count?`${count} archivo${count===1?"":"s"} guardado${count===1?"":"s"}`:"Todavía no hay adjuntos"}</small></div></div>
      {loading?<div style={{padding:18,border:"1px solid var(--line)",borderRadius:13,color:"var(--muted)",fontSize:10.5}}>Cargando adjuntos…</div>:!sorted.length?<div style={{padding:24,border:"1px dashed var(--line)",borderRadius:14,textAlign:"center",color:"var(--muted)",fontSize:10.5}}>No hay archivos adjuntos en esta reserva.</div>:<div style={{display:"grid",gap:8}}>{sorted.map(row=><article key={row.id} style={{display:"grid",gridTemplateColumns:"38px minmax(0,1fr) auto",alignItems:"center",gap:10,padding:10,border:"1px solid var(--line)",borderRadius:13,background:"var(--panelSolid)"}}><span style={{width:36,height:36,display:"grid",placeItems:"center",borderRadius:10,background:"color-mix(in srgb,var(--accent) 8%,var(--panelSolid))",color:"var(--accent)"}}><Icon/></span><span style={{minWidth:0}}><b style={{display:"block",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:11.5}}>{row.file_name}</b><small style={{display:"block",marginTop:3,color:"var(--muted)",fontSize:10,lineHeight:1.35}}>{TYPES[row.kind]||row.kind||"Archivo"} · {sizeLabel(row.stored_size_bytes||row.original_size_bytes)} · {fmtDate(row.created_at)}{row.metadata?.note?` · ${row.metadata.note}`:""}</small></span><span style={{display:"flex",gap:6}}><Button onClick={()=>openFile(row)} title="Abrir archivo"><Icon kind="open"/>Abrir</Button><button type="button" onClick={()=>remove(row)} disabled={removing===row.id} title="Eliminar adjunto" aria-label={`Eliminar ${row.file_name}`} style={{width:36,height:36,display:"grid",placeItems:"center",border:"1px solid color-mix(in srgb,#d24a4a 28%,var(--line))",borderRadius:10,background:"color-mix(in srgb,#d24a4a 5%,var(--panelSolid))",color:"#b33a3a",cursor:"pointer"}}><Icon kind="trash"/></button></span></article>)}</div>}
    </section></div>:null}
    <style>{`@media(max-width:640px){button[title="Archivos adjuntos de la reserva"]{right:14px!important;bottom:124px!important}.hl-attachment-panel-grid{grid-template-columns:1fr!important}}`}</style>
  </>
}
