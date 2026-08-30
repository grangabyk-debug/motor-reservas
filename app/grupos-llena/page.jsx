'use client'

import {useEffect,useMemo,useState} from 'react'
import styles from './grupos.module.css'

const ARS=new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0})
const initialRooms=[{id:1,type:'Doble twin',qty:8,price:90000},{id:2,type:'Triple',qty:4,price:115000}]
const initialExtras=[
 {id:'breakfast',name:'Desayuno buffet',note:'incluido',price:0,on:true},
 {id:'dinner',name:'Cena para el grupo',note:'servicio único',price:280000,on:true},
 {id:'bus',name:'Cochera para micro',note:'por estadía',price:60000,on:true},
 {id:'meeting',name:'Salón de reunión',note:'hasta 3 horas',price:180000,on:false},
 {id:'laundry',name:'Lavandería deportiva',note:'servicio único',price:90000,on:false},
 {id:'late',name:'Late check-out',note:'según disponibilidad',price:110000,on:false},
]

function nights(a,b){if(!a||!b)return 1;return Math.max(1,Math.round((new Date(`${b}T12:00:00`)-new Date(`${a}T12:00:00`))/86400000))}
function dateLabel(value){if(!value)return 'A definir';return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'short',year:'numeric'}).format(new Date(`${value}T12:00:00`))}
function dateLong(value){if(!value)return 'A definir';return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(`${value}T12:00:00`))}
function encodeProposal(data){const bytes=new TextEncoder().encode(JSON.stringify(data));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
function decodeProposal(raw){try{const v=raw.replaceAll('-','+').replaceAll('_','/');const padded=v+'='.repeat((4-v.length%4)%4);const binary=atob(padded);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes))}catch{return null}}

export default function GruposLlenaPage(){
 const[publicProposal,setPublicProposal]=useState(undefined)
 useEffect(()=>{const raw=new URLSearchParams(window.location.search).get('p');setPublicProposal(raw?decodeProposal(raw):null)},[])
 if(publicProposal===undefined)return <main className={styles.loading}><span>GRUPOS LLENA</span></main>
 if(publicProposal)return <PublicProposal proposal={publicProposal}/>
 return <HotelDesk/>
}

function HotelDesk(){
 const[hotel,setHotel]=useState('Hotel Gran Vía')
 const[client,setClient]=useState('Club Atlético Central')
 const[kind,setKind]=useState('Equipo deportivo')
 const[guests,setGuests]=useState(32)
 const[checkIn,setCheckIn]=useState('2026-09-20')
 const[checkOut,setCheckOut]=useState('2026-09-24')
 const[rooms,setRooms]=useState(initialRooms)
 const[extras,setExtras]=useState(initialExtras)
 const[deposit,setDeposit]=useState(30)
 const[validity,setValidity]=useState(72)
 const[notes,setNotes]=useState('Tarifa especial para grupo. Horarios de comidas a coordinar según cronograma del contingente.')
 const[shareUrl,setShareUrl]=useState('')
 const[toast,setToast]=useState('')
 const n=nights(checkIn,checkOut)
 const roomTotal=useMemo(()=>rooms.reduce((s,r)=>s+(Number(r.qty)||0)*(Number(r.price)||0)*n,0),[rooms,n])
 const extrasTotal=useMemo(()=>extras.filter(x=>x.on).reduce((s,x)=>s+(Number(x.price)||0),0),[extras])
 const total=roomTotal+extrasTotal
 const roomCount=rooms.reduce((s,r)=>s+(Number(r.qty)||0),0)
 const proposal={hotel,client,kind,guests:Number(guests)||0,checkIn,checkOut,nights:n,rooms:rooms.map(r=>({...r,qty:Number(r.qty)||0,price:Number(r.price)||0})),extras:extras.filter(x=>x.on).map(x=>({...x,price:Number(x.price)||0})),deposit:Number(deposit)||0,validity:Number(validity)||0,notes,total,roomTotal,extrasTotal,roomCount,createdAt:new Date().toISOString()}
 const pulse=msg=>{setToast(msg);window.setTimeout(()=>setToast(''),1800)}
 const generate=()=>{const url=`${window.location.origin}/grupos-llena?p=${encodeProposal(proposal)}`;setShareUrl(url);pulse('Propuesta generada');return url}
 const openClient=()=>window.open(shareUrl||generate(),'_blank','noopener,noreferrer')
 const whatsapp=()=>{const url=shareUrl||generate();window.open(`https://wa.me/?text=${encodeURIComponent(`Hola, te envío la propuesta de ${hotel} para ${client}. Podés verla y responder acá: ${url}`)}`,'_blank','noopener,noreferrer')}
 const copy=async()=>{const url=shareUrl||generate();try{await navigator.clipboard.writeText(url);pulse('Link copiado')}catch{pulse('Abrí la propuesta y copiá la URL')}}
 const updateRoom=(id,key,value)=>setRooms(v=>v.map(r=>r.id===id?{...r,[key]:value}:r))

 return <main className={styles.shell}>
  <aside className={styles.rail}>
   <div className={styles.monogram}>GL</div>
   <div className={styles.railWord}>GRUPOS LLENA</div>
   <div className={styles.railLine}/>
   <span className={styles.railMeta}>MVP · 01</span>
  </aside>

  <div className={styles.app}>
   <header className={styles.header}>
    <div className={styles.brand}><b>Grupos llena</b><span>ventas de grupos para hoteles</span></div>
    <nav><button onClick={()=>window.location.reload()}>Nueva</button><button onClick={openClient}>Vista cliente</button><button className={styles.headerCta} onClick={generate}>Generar propuesta</button></nav>
   </header>

   <section className={styles.intro}>
    <div className={styles.issue}><span>COTIZACIÓN</span><b>GL—026</b></div>
    <div><h1>Una propuesta seria,<br/><em>antes que la competencia.</em></h1><p>Armá alojamiento, servicios y condiciones. Compartí un único link y seguí el grupo sin versiones de Excel.</p></div>
    <div className={styles.kpis}>
     <div><strong>04</strong><span>pendientes</span></div><div><strong>07</strong><span>aceptadas</span></div><div><strong>63%</strong><span>conversión demo</span></div>
    </div>
   </section>

   <section className={styles.editor}>
    <div className={styles.formSide}>
     <section className={styles.section}>
      <div className={styles.sectionTitle}><span>01</span><div><h2>Grupo & estadía</h2><p>Lo indispensable para cotizar.</p></div></div>
      <div className={styles.grid2}>
       <label><span>Hotel</span><input value={hotel} onChange={e=>setHotel(e.target.value)}/></label>
       <label><span>Organizador</span><input value={client} onChange={e=>setClient(e.target.value)}/></label>
       <label><span>Tipo de grupo</span><select value={kind} onChange={e=>setKind(e.target.value)}><option>Equipo deportivo</option><option>Empresa</option><option>Agencia / contingente</option><option>Colegio</option><option>Boda / evento</option><option>Otro</option></select></label>
       <label><span>Pasajeros</span><input type="number" min="1" value={guests} onChange={e=>setGuests(e.target.value)}/></label>
       <label><span>Check-in</span><input type="date" value={checkIn} onChange={e=>setCheckIn(e.target.value)}/></label>
       <label><span>Check-out</span><input type="date" value={checkOut} onChange={e=>setCheckOut(e.target.value)}/></label>
      </div>
      <div className={styles.inlineStat}><strong>{n}</strong> noches <i/> <strong>{roomCount}</strong> habitaciones <i/> <strong>{guests||0}</strong> pasajeros</div>
     </section>

     <section className={styles.section}>
      <div className={styles.sectionTitle}><span>02</span><div><h2>Habitaciones</h2><p>Precio por habitación y por noche.</p></div><button className={styles.plus} onClick={()=>setRooms(v=>[...v,{id:Date.now(),type:'Suite',qty:1,price:120000}])}>+ tipo</button></div>
      <div className={styles.roomHead}><span>Tipo</span><span>Cant.</span><span>Tarifa / noche</span><span>Subtotal</span><span/></div>
      {rooms.map(r=><div className={styles.roomLine} key={r.id}>
       <input value={r.type} onChange={e=>updateRoom(r.id,'type',e.target.value)}/>
       <input type="number" min="0" value={r.qty} onChange={e=>updateRoom(r.id,'qty',e.target.value)}/>
       <div className={styles.money}><i>$</i><input type="number" min="0" value={r.price} onChange={e=>updateRoom(r.id,'price',e.target.value)}/></div>
       <b>{ARS.format((Number(r.qty)||0)*(Number(r.price)||0)*n)}</b>
       <button onClick={()=>setRooms(v=>v.filter(x=>x.id!==r.id))}>×</button>
      </div>)}
     </section>

     <section className={styles.section}>
      <div className={styles.sectionTitle}><span>03</span><div><h2>Servicios</h2><p>Extras que hacen rentable al grupo.</p></div></div>
      <div className={styles.extras}>
       {extras.map(x=><button key={x.id} onClick={()=>setExtras(v=>v.map(y=>y.id===x.id?{...y,on:!y.on}:y))} className={x.on?styles.extraOn:''}>
        <i>{x.on?'✓':'+'}</i><div><b>{x.name}</b><span>{x.note}</span></div><strong>{x.price?ARS.format(x.price):'Incluido'}</strong>
       </button>)}
      </div>
     </section>

     <section className={styles.section}>
      <div className={styles.sectionTitle}><span>04</span><div><h2>Condiciones</h2><p>Lo que el cliente verá al aceptar.</p></div></div>
      <div className={styles.grid2}>
       <label className={styles.suffix}><span>Seña para confirmar</span><div><input type="number" min="0" max="100" value={deposit} onChange={e=>setDeposit(e.target.value)}/><i>%</i></div></label>
       <label className={styles.suffix}><span>Validez de la propuesta</span><div><input type="number" min="1" value={validity} onChange={e=>setValidity(e.target.value)}/><i>h</i></div></label>
      </div>
      <label className={styles.noteLabel}><span>Nota comercial</span><textarea rows="3" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
     </section>
    </div>

    <aside className={styles.folio}>
     <div className={styles.folioTop}><span>PREVIEW EN VIVO</span><b>GL—026</b></div>
     <div className={styles.folioHotel}><small>PROPUESTA DE</small><h3>{hotel||'Tu hotel'}</h3><p>Para {client||'organizador del grupo'}</p></div>
     <div className={styles.folioDates}><div><span>Entrada</span><b>{dateLabel(checkIn)}</b></div><i>→</i><div><span>Salida</span><b>{dateLabel(checkOut)}</b></div></div>
     <div className={styles.folioFacts}><div><b>{guests||0}</b><span>pasajeros</span></div><div><b>{roomCount}</b><span>habitaciones</span></div><div><b>{n}</b><span>noches</span></div></div>
     <div className={styles.folioList}><div><span>Alojamiento</span><b>{ARS.format(roomTotal)}</b></div><div><span>Servicios</span><b>{ARS.format(extrasTotal)}</b></div></div>
     <div className={styles.folioTotal}><span>TOTAL PROPUESTA</span><strong>{ARS.format(total)}</strong><small>Seña {deposit}% · {ARS.format(total*(Number(deposit)||0)/100)}</small></div>
     <button className={styles.make} onClick={generate}>GENERAR LINK <span>↗</span></button>
     <p className={styles.disclaimer}>El cliente no necesita cuenta. Abre, revisa, acepta o pide cambios.</p>
     {shareUrl&&<div className={styles.shareBox}><span>LISTA PARA ENVIAR</span><div><button onClick={openClient}>Ver</button><button onClick={whatsapp}>WhatsApp</button><button onClick={copy}>Copiar</button></div></div>}
    </aside>
   </section>
  </div>
  {toast&&<div className={styles.toast}>{toast}</div>}
 </main>
}

function PublicProposal({proposal}){
 const[accepted,setAccepted]=useState(false)
 const[change,setChange]=useState(false)
 const[message,setMessage]=useState('')
 const[people,setPeople]=useState([{name:'',doc:'',room:'',note:''},{name:'',doc:'',room:'',note:''},{name:'',doc:'',room:'',note:''}])
 const done=people.filter(p=>p.name.trim()).length
 const update=(idx,key,value)=>setPeople(v=>v.map((p,i)=>i===idx?{...p,[key]:value}:p))
 if(accepted)return <Rooming proposal={proposal} people={people} setPeople={setPeople} done={done} update={update}/>
 return <main className={styles.publicShell}>
  <div className={styles.publicRail}><span>GL</span><small>PROPUESTA PRIVADA</small></div>
  <article className={styles.paper}>
   <header className={styles.paperHead}><div><small>GRUPOS LLENA · PROPUESTA DIGITAL</small><h1>{proposal.hotel}</h1></div><div><span>REF.</span><b>GL—026</b></div></header>
   <div className={styles.paperRule}/>
   <section className={styles.paperIntro}><div><span>PREPARADA PARA</span><h2>{proposal.client}</h2><p>{proposal.kind} · {proposal.guests} pasajeros</p></div><div className={styles.paperPrice}><span>TOTAL</span><strong>{ARS.format(proposal.total)}</strong><small>impuestos incluidos</small></div></section>
   <section className={styles.paperDates}><div><span>CHECK-IN</span><b>{dateLong(proposal.checkIn)}</b></div><div><span>ESTADÍA</span><b>{proposal.nights} noches</b></div><div><span>CHECK-OUT</span><b>{dateLong(proposal.checkOut)}</b></div></section>

   <section className={styles.paperSection}><div className={styles.paperSectionHead}><span>01</span><h3>Alojamiento</h3></div><div className={styles.paperTable}>
    {proposal.rooms.map((r,i)=><div key={i}><span>{r.qty} × {r.type}</span><small>{ARS.format(r.price)} por noche</small><b>{ARS.format(r.qty*r.price*proposal.nights)}</b></div>)}
   </div></section>

   <section className={styles.paperSection}><div className={styles.paperSectionHead}><span>02</span><h3>Servicios incluidos</h3></div><div className={styles.paperExtras}>{proposal.extras.map((x,i)=><div key={i}><i>✓</i><span><b>{x.name}</b><small>{x.note}</small></span><strong>{x.price?ARS.format(x.price):'Incluido'}</strong></div>)}</div></section>

   <section className={styles.paperTerms}><div><span>CONDICIONES</span><p>{proposal.notes}</p></div><div><span>PARA CONFIRMAR</span><b>Seña del {proposal.deposit}% · {ARS.format(proposal.total*proposal.deposit/100)}</b><p>Propuesta válida durante {proposal.validity} horas.</p></div></section>

   {change?<section className={styles.changeBox}><label><span>¿Qué querés modificar?</span><textarea rows="3" placeholder="Ej. Necesitamos 2 habitaciones singles y cena más tarde..." value={message} onChange={e=>setMessage(e.target.value)}/></label><div><button onClick={()=>setChange(false)}>Cancelar</button><button onClick={()=>{alert('Demo: solicitud enviada al hotel.');setChange(false)}}>Enviar solicitud</button></div></section>:null}

   <footer className={styles.paperAction}><div><small>Un único link. Sin archivos adjuntos.</small><b>Podés aceptar ahora y completar los pasajeros después.</b></div><div><button onClick={()=>setChange(true)}>Pedir un cambio</button><button className={styles.accept} onClick={()=>setAccepted(true)}>Aceptar propuesta</button></div></footer>
  </article>
 </main>
}

function Rooming({proposal,people,setPeople,done,update}){
 return <main className={styles.roomingShell}>
  <header className={styles.roomingTop}><div><span>GL</span><div><b>Grupos llena</b><small>rooming list compartida</small></div></div><strong>✓ PROPUESTA ACEPTADA</strong></header>
  <section className={styles.roomingIntro}><div><span>{proposal.hotel}</span><h1>Ahora, una sola lista.<br/><em>Siempre la última versión.</em></h1><p>{proposal.client} · {proposal.guests} pasajeros · {dateLabel(proposal.checkIn)} → {dateLabel(proposal.checkOut)}</p></div><div className={styles.counter}><strong>{done}</strong><span>de {proposal.guests}<br/>pasajeros cargados</span></div></section>
  <section className={styles.roomingCard}>
   <div className={styles.progress}><i style={{width:`${Math.min(100,done/Math.max(1,proposal.guests)*100)}%`}}/></div>
   <div className={styles.roomingLabels}><span>Nombre y apellido</span><span>DNI / pasaporte</span><span>Habitación</span><span>Observaciones</span></div>
   {people.map((p,i)=><div className={styles.personLine} key={i}><input placeholder="Nombre completo" value={p.name} onChange={e=>update(i,'name',e.target.value)}/><input placeholder="Documento" value={p.doc} onChange={e=>update(i,'doc',e.target.value)}/><input placeholder="Ej. Doble 3" value={p.room} onChange={e=>update(i,'room',e.target.value)}/><input placeholder="Dieta, horario, nota..." value={p.note} onChange={e=>update(i,'note',e.target.value)}/></div>)}
   <button className={styles.addPerson} onClick={()=>setPeople(v=>[...v,{name:'',doc:'',room:'',note:''}])}>+ Agregar pasajero</button>
   <footer className={styles.roomingSave}><div><b>Demo funcional</b><span>La versión conectada guarda cada cambio y el hotel lo ve en vivo.</span></div><button onClick={()=>alert('Demo: rooming list guardada.')}>Guardar cambios</button></footer>
  </section>
 </main>
}
