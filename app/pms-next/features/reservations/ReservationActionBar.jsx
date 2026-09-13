"use client"

import{useMemo,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import ReservationActionBarLegacy from"./ReservationActionBarLegacy"

const QR_VERSION=8,QR_SIZE=49,QR_DATA_CODEWORDS=194,QR_EC_PER_BLOCK=24
const cleanPhone=value=>String(value||"").replace(/\D/g,"").replace(/^0+/,"")
const firstName=value=>String(value||"huésped").trim().split(/\s+/)[0]||"huésped"
const fmtDateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)).replace(".",""):"fin de la estadía"

function pushBits(target,value,length){for(let i=length-1;i>=0;i--)target.push((value>>>i)&1)}
function gfMul(x,y){let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11d);z^=((y>>>i)&1)*x}return z&255}
function rsDivisor(degree){const out=Array(degree).fill(0);out[degree-1]=1;let root=1;for(let i=0;i<degree;i++){for(let j=0;j<degree;j++){out[j]=gfMul(out[j],root);if(j+1<degree)out[j]^=out[j+1]}root=gfMul(root,2)}return out}
function rsRemainder(data,divisor){const out=Array(divisor.length).fill(0);for(const byte of data){const factor=byte^out.shift();out.push(0);for(let i=0;i<out.length;i++)out[i]^=gfMul(divisor[i],factor)}return out}
function bchRemainder(data,poly){let value=data,polyDegree=31-Math.clz32(poly);while(value&&(31-Math.clz32(value))>=polyDegree)value^=poly<<((31-Math.clz32(value))-polyDegree);return value}

function qrMatrix(text){
  const bytes=[...new TextEncoder().encode(String(text||""))]
  if(!bytes.length||bytes.length>192)return null
  const bits=[];pushBits(bits,4,4);pushBits(bits,bytes.length,8);bytes.forEach(byte=>pushBits(bits,byte,8))
  const capacity=QR_DATA_CODEWORDS*8
  for(let i=0;i<Math.min(4,capacity-bits.length);i++)bits.push(0)
  while(bits.length%8)bits.push(0)
  const data=[]
  for(let i=0;i<bits.length;i+=8){let byte=0;for(let j=0;j<8;j++)byte=(byte<<1)|(bits[i+j]||0);data.push(byte)}
  let pad=true;while(data.length<QR_DATA_CODEWORDS){data.push(pad?0xec:0x11);pad=!pad}
  const divisor=rsDivisor(QR_EC_PER_BLOCK),blocks=[data.slice(0,97),data.slice(97,194)],ecc=blocks.map(block=>rsRemainder(block,divisor)),code=[]
  for(let i=0;i<97;i++)blocks.forEach(block=>code.push(block[i]))
  for(let i=0;i<QR_EC_PER_BLOCK;i++)ecc.forEach(block=>code.push(block[i]))

  const modules=Array.from({length:QR_SIZE},()=>Array(QR_SIZE).fill(false)),reserved=Array.from({length:QR_SIZE},()=>Array(QR_SIZE).fill(false))
  const set=(x,y,value)=>{if(x>=0&&y>=0&&x<QR_SIZE&&y<QR_SIZE){modules[y][x]=Boolean(value);reserved[y][x]=true}}
  const finder=(x,y)=>{for(let dy=-1;dy<=7;dy++)for(let dx=-1;dx<=7;dx++){const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=QR_SIZE||yy>=QR_SIZE)continue;const inside=dx>=0&&dx<=6&&dy>=0&&dy<=6,black=inside&&(dx===0||dx===6||dy===0||dy===6||(dx>=2&&dx<=4&&dy>=2&&dy<=4));set(xx,yy,black)}}
  finder(0,0);finder(QR_SIZE-7,0);finder(0,QR_SIZE-7)
  for(const cy of[6,24,42])for(const cx of[6,24,42]){if(reserved[cy][cx])continue;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}
  for(let i=8;i<QR_SIZE-8;i++){if(!reserved[6][i])set(i,6,i%2===0);if(!reserved[i][6])set(6,i,i%2===0)}

  const formatData=1<<3,formatRaw=formatData<<10,format=((formatRaw^bchRemainder(formatRaw,0x537))^0x5412)&0x7fff,formatBit=i=>((format>>>i)&1)!==0
  for(let i=0;i<=5;i++)set(8,i,formatBit(i));set(8,7,formatBit(6));set(8,8,formatBit(7));set(7,8,formatBit(8));for(let i=9;i<15;i++)set(14-i,8,formatBit(i));for(let i=0;i<8;i++)set(QR_SIZE-1-i,8,formatBit(i));for(let i=8;i<15;i++)set(8,QR_SIZE-15+i,formatBit(i));set(8,QR_SIZE-8,true)
  const versionRaw=QR_VERSION<<12,version=(versionRaw^bchRemainder(versionRaw,0x1f25))&0x3ffff
  for(let i=0;i<18;i++){const bit=((version>>>i)&1)!==0,a=QR_SIZE-11+(i%3),b=Math.floor(i/3);set(a,b,bit);set(b,a,bit)}

  let bitIndex=0
  for(let right=QR_SIZE-1;right>=1;right-=2){if(right===6)right--;const upward=((right+1)&2)===0;for(let vert=0;vert<QR_SIZE;vert++){const y=upward?QR_SIZE-1-vert:vert;for(let j=0;j<2;j++){const x=right-j;if(reserved[y][x])continue;const bit=bitIndex<code.length*8?((code[bitIndex>>>3]>>>(7-(bitIndex&7)))&1):0;modules[y][x]=Boolean(bit^(((x+y)&1)===0));bitIndex++}}}
  return modules
}

function QrCode({value}){
  const matrix=useMemo(()=>qrMatrix(value),[value])
  if(!matrix)return <div style={{padding:18,textAlign:"center",fontSize:11,color:"var(--muted)"}}>El enlace es demasiado largo para generar el QR local.</div>
  const quiet=4,size=QR_SIZE+quiet*2,path=matrix.flatMap((row,y)=>row.map((dark,x)=>dark?`M${x+quiet} ${y+quiet}h1v1h-1z`:"")).join("")
  return <svg role="img" aria-label="Código QR del Portal del huésped" viewBox={`0 0 ${size} ${size}`} width="190" height="190" style={{display:"block",maxWidth:"100%",height:"auto",background:"#fff",borderRadius:18}} shapeRendering="crispEdges"><rect width={size} height={size} fill="#fff"/><path d={path} fill="#111827"/></svg>
}

function GuestStayPortalShare({url,guestName,roomLabel,validUntil,phone,email,onClose}){
  const[status,setStatus]=useState("")
  const name=firstName(guestName),message=`Hola ${name} 👋 Te compartimos tu Portal del huésped para esta estadía. Desde acá podés consultar Wi‑Fi, información del hotel y solicitar servicios.\n\n${url}`
  const phoneDigits=cleanPhone(phone),international=phoneDigits?(phoneDigits.startsWith("54")?phoneDigits:`54${phoneDigits}`):""
  async function copy(){try{await navigator.clipboard.writeText(url);setStatus("Enlace copiado al portapapeles.")}catch{setStatus("No se pudo copiar automáticamente. Podés seleccionar el enlace manualmente.")}}
  function open(){window.open(url,"_blank","noopener,noreferrer")}
  function whatsapp(){if(!international)return;window.open(`https://wa.me/${international}?text=${encodeURIComponent(message)}`,"_blank","noopener,noreferrer")}
  function mail(){const target=String(email||"").trim(),subject="Tu Portal del huésped",body=message;window.location.href=`mailto:${encodeURIComponent(target)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
  async function share(){if(!navigator.share)return copy();try{await navigator.share({title:"Portal del huésped",text:`Portal de estadía de ${name}`,url})}catch{}}
  const button={minHeight:44,border:"1px solid var(--line)",borderRadius:12,padding:"0 13px",background:"color-mix(in srgb,var(--panelSolid) 84%,transparent)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:850,cursor:"pointer"}
  return <div style={{position:"fixed",inset:0,zIndex:310,display:"grid",placeItems:"center",padding:16,background:"rgba(12,20,38,.32)",backdropFilter:"blur(10px)"}} onMouseDown={event=>event.target===event.currentTarget&&onClose?.()}>
    <section style={{width:"min(720px,calc(100vw - 28px))",maxHeight:"90dvh",overflow:"auto",padding:20,border:"1px solid color-mix(in srgb,#fff 38%,var(--line))",borderRadius:24,background:"color-mix(in srgb,var(--panelSolid) 94%,transparent)",boxShadow:"0 30px 90px rgba(20,30,55,.3)",backdropFilter:"blur(30px) saturate(1.4)"}}>
      <header style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start"}}><div><small style={{fontSize:10,fontWeight:900,letterSpacing:".1em",color:"var(--accent)"}}>PORTAL DEL HUÉSPED</small><h2 style={{margin:"4px 0 4px",fontSize:22}}>Compartir acceso con {name}</h2><p style={{margin:0,fontSize:11,lineHeight:1.5,color:"var(--muted)"}}>{roomLabel||"Reserva"} · acceso privado hasta {fmtDateTime(validUntil)}</p></div><button type="button" aria-label="Cerrar" onClick={onClose} style={{width:38,height:38,border:"1px solid var(--line)",borderRadius:12,background:"var(--panel)",color:"var(--text)",fontSize:20,cursor:"pointer"}}>×</button></header>
      <div data-guest-portal-share-grid style={{display:"grid",gridTemplateColumns:"210px minmax(0,1fr)",gap:18,marginTop:18,alignItems:"start"}}>
        <div style={{display:"grid",placeItems:"center",padding:10,border:"1px solid var(--line)",borderRadius:21,background:"#fff"}}><QrCode value={url}/><small style={{marginTop:7,fontSize:10,color:"#667085",textAlign:"center"}}>El huésped puede escanearlo directamente desde su celular.</small></div>
        <div style={{display:"grid",gap:11}}>
          <div style={{padding:13,border:"1px solid var(--line)",borderRadius:14,background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))"}}><small style={{display:"block",fontSize:10,fontWeight:850,color:"var(--muted)"}}>ENLACE PRIVADO</small><div style={{marginTop:5,fontSize:11,lineHeight:1.45,overflowWrap:"anywhere",fontWeight:750}}>{url}</div></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
            <button type="button" style={{...button,border:0,color:"#fff",background:"linear-gradient(145deg,var(--accent),var(--accent2))"}} onClick={open}>↗ Abrir portal</button>
            <button type="button" style={button} onClick={copy}>⧉ Copiar enlace</button>
            <button type="button" style={{...button,color:international?"#177d4a":"var(--muted)"}} disabled={!international} onClick={whatsapp}>◉ WhatsApp</button>
            <button type="button" style={{...button,color:String(email||"").trim()?"var(--accent)":"var(--muted)"}} disabled={!String(email||"").trim()} onClick={mail}>✉ Email</button>
          </div>
          {typeof navigator!=="undefined"&&navigator.share?<button type="button" style={button} onClick={share}>⌁ Compartir desde este dispositivo</button>:null}
          {status?<div style={{padding:"9px 10px",borderRadius:11,background:"color-mix(in srgb,#2f9b61 8%,var(--panelSolid))",color:"#277a4d",fontSize:10.5,fontWeight:750}}>{status}</div>:null}
          <div style={{padding:"11px 12px",borderRadius:12,background:"color-mix(in srgb,#d99b2b 8%,var(--panelSolid))",border:"1px solid color-mix(in srgb,#d99b2b 22%,var(--line))",fontSize:10.5,lineHeight:1.5,color:"var(--muted)"}}><b style={{color:"var(--text)"}}>Acceso temporal y privado.</b> El enlace corresponde únicamente a esta estadía y deja de funcionar cuando vence o se revoca el portal.</div>
        </div>
      </div>
      <style>{`@media(max-width:640px){[data-guest-portal-share-grid]{grid-template-columns:1fr!important}}`}</style>
    </section>
  </div>
}

const roomNames=rooms=>(rooms||[]).map(room=>room?.nombre).filter(Boolean).join(", ")||"—"

export default function ReservationActionBar(props){
  const{item,rooms=[],propertyId}=props
  const[portalShare,setPortalShare]=useState(null),[portalError,setPortalError]=useState(""),[busy,setBusy]=useState(false)

  async function capturePortalClick(event){
    const button=event.target?.closest?.('button[aria-label="Web app del huésped"]')
    if(!button)return
    event.preventDefault();event.stopPropagation();event.nativeEvent?.stopImmediatePropagation?.()
    if(busy)return
    setBusy(true);setPortalError("")
    try{
      const{data,error}=await supabase.rpc("hl_guest_stay_portal_issue",{p_reservation_id:Number(item.id)})
      if(error)throw error
      if(!data?.ok||!data?.token)throw new Error("No se pudo generar el acceso temporal.")
      const path=data.path||`/stay/${encodeURIComponent(data.token)}`,url=`${window.location.origin}${path}`
      setPortalShare({url,validUntil:data.valid_until||null})
    }catch(error){setPortalError(error?.message||"No se pudo generar el Portal del huésped.")}
    finally{setBusy(false)}
  }

  return <div style={{display:"contents"}} onClickCapture={capturePortalClick}>
    <ReservationActionBarLegacy {...props}/>
    {portalShare?<GuestStayPortalShare url={portalShare.url} guestName={item.nombre_huesped} roomLabel={roomNames(rooms)==="—"?"Reserva":`Habitación ${roomNames(rooms)}`} validUntil={portalShare.validUntil} phone={item.telefono_huesped} email={item.email_huesped||item.email||""} onClose={()=>setPortalShare(null)}/>:null}
    {portalError?<div role="alert" style={{position:"fixed",right:18,top:76,zIndex:330,maxWidth:360,padding:"12px 38px 12px 13px",border:"1px solid color-mix(in srgb,var(--red) 30%,var(--line))",borderRadius:13,background:"color-mix(in srgb,var(--panelSolid) 96%,transparent)",boxShadow:"0 14px 38px rgba(20,30,55,.16)",color:"var(--red)",fontSize:11,fontWeight:760}}>{portalError}<button type="button" aria-label="Cerrar error" onClick={()=>setPortalError("")} style={{position:"absolute",right:8,top:7,width:26,height:26,border:0,borderRadius:8,background:"transparent",color:"var(--muted)",fontSize:17,cursor:"pointer"}}>×</button></div>:null}
  </div>
}
