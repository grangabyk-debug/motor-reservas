"use client"

import{useMemo,useState}from"react"
import s from"./reservations.module.css"

const INITIAL=[
  {id:"7463960",guest:"Ananya Rao",room:"155",arrival:"2026-09-16",departure:"2026-09-17",payment:"paid",channel:"Directa",email:"ananya@example.com",phone:"+54 11 5555 1201",status:"reserved"},
  {id:"7463899",guest:"Lucas Müller",room:"242",arrival:"2026-09-16",departure:"2026-09-19",payment:"paid",channel:"Directa",email:"lucas@example.com",phone:"+54 11 5555 1202",status:"reserved"},
  {id:"7463685",guest:"Noah Brown",room:"312",arrival:"2026-09-16",departure:"2026-09-19",payment:"paid",channel:"Booking",email:"noah@example.com",phone:"+54 11 5555 1203",status:"reserved"},
  {id:"7463633",guest:"Omar Haddad",room:"101",arrival:"2026-09-16",departure:"2026-09-18",payment:"pending",channel:"Directa",email:"omar@example.com",phone:"+54 11 5555 1204",status:"reserved"},
  {id:"7463842",guest:"Sofia Rossi",room:"117",arrival:"2026-09-15",departure:"2026-09-17",payment:"paid",channel:"Motor",email:"sofia@example.com",phone:"+54 11 5555 1205",status:"checked-in"},
  {id:"7463868",guest:"Clara Fontaine",room:"171",arrival:"2026-09-14",departure:"2026-09-18",payment:"due",channel:"Agencia",email:"clara@example.com",phone:"+54 11 5555 1206",status:"reserved"},
  {id:"7463849",guest:"Omar Haddad",room:"235",arrival:"2026-09-13",departure:"2026-09-14",payment:"paid",channel:"Directa",email:"omar2@example.com",phone:"+54 11 5555 1207",status:"no-show"},
  {id:"7463796",guest:"Clara Fontaine",room:"320",arrival:"2026-09-13",departure:"2026-09-16",payment:"paid",channel:"Booking",email:"clara2@example.com",phone:"+54 11 5555 1208",status:"reserved"},
  {id:"7463776",guest:"Elena Petrova",room:"119",arrival:"2026-09-13",departure:"2026-09-16",payment:"paid",channel:"Directa",email:"elena@example.com",phone:"+54 11 5555 1209",status:"reserved"},
]

const date=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(`${value}T12:00:00`))
const paymentLabel=value=>value==="paid"?"Pagado":value==="pending"?"Parcial":"Pendiente"

export default function ReservationsWorkspace({onNavigate}){
  const[items,setItems]=useState(INITIAL)
  const[query,setQuery]=useState("")
  const[mode,setMode]=useState("active")
  const[filterOpen,setFilterOpen]=useState(false)
  const[paymentFilter,setPaymentFilter]=useState("all")
  const[selected,setSelected]=useState(null)

  const visible=useMemo(()=>items.filter(item=>{
    if(mode==="trash"&&item.status!=="trash")return false
    if(mode==="noshow"&&item.status!=="no-show")return false
    if(mode==="active"&&["trash","no-show"].includes(item.status))return false
    if(paymentFilter!=="all"&&item.payment!==paymentFilter)return false
    const term=query.trim().toLowerCase()
    return !term||`${item.id} ${item.guest} ${item.room} ${item.channel}`.toLowerCase().includes(term)
  }),[items,mode,paymentFilter,query])

  function checkIn(id){
    setItems(list=>list.map(item=>item.id===id?{...item,status:item.status==="checked-in"?"reserved":"checked-in"}:item))
    setSelected(current=>current?.id===id?{...current,status:current.status==="checked-in"?"reserved":"checked-in"}:current)
  }
  function remove(id){
    setItems(list=>list.map(item=>item.id===id?{...item,status:"trash"}:item))
    if(selected?.id===id)setSelected(null)
  }
  function restore(id){setItems(list=>list.map(item=>item.id===id?{...item,status:"reserved"}:item))}

  return <section className={s.page}>
    <header className={s.heading}>
      <div><small>RESERVAS</small><h1>Reservas</h1><p>{items.filter(item=>item.status!=="trash").length} reservas visibles en este entorno de prueba.</p></div>
      <div className={s.tools}>
        <label className={s.search}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar reservas"/></label>
        <button type="button" className={`${s.tool} ${mode==="noshow"?s.toolActive:""}`} onClick={()=>setMode(current=>current==="noshow"?"active":"noshow")}>⊘ No-show</button>
        <button type="button" className={`${s.tool} ${mode==="trash"?s.toolActive:""}`} onClick={()=>setMode(current=>current==="trash"?"active":"trash")}>♲ Papelera</button>
        <button type="button" className={`${s.tool} ${filterOpen?s.toolActive:""}`} onClick={()=>setFilterOpen(value=>!value)}>≡ Filtrar</button>
        <button type="button" className={s.primary} onClick={()=>onNavigate?.("planning")}>＋ Nueva reserva</button>
      </div>
    </header>

    {filterOpen&&<div className={s.filterPanel}><span>Pago</span>{[["all","Todos"],["paid","Pagado"],["pending","Parcial"],["due","Pendiente"]].map(([value,label])=><button type="button" key={value} className={paymentFilter===value?s.selectedFilter:""} onClick={()=>setPaymentFilter(value)}>{label}</button>)}</div>}

    <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th>ID</th><th>Cliente</th><th>Habitación</th><th>Llegada</th><th>Salida</th><th>Pago</th><th>Acciones</th></tr></thead>
        <tbody>{visible.map(item=><tr key={item.id}>
          <td className={s.id}>{item.id}</td>
          <td className={s.client}><b>{item.guest}</b><small>{item.channel}</small></td>
          <td><span className={s.room}><span className={s.roomBadge}>{item.room}</span><i className={s.roomDot}/></span></td>
          <td>{date(item.arrival)}</td><td>{date(item.departure)}</td>
          <td><span className={`${s.payment} ${item.payment==="pending"?s.paymentPending:item.payment==="due"?s.paymentDue:""}`}>{paymentLabel(item.payment)}</span></td>
          <td><div className={s.actions}>{mode==="trash"?<button type="button" className={s.actionButton} onClick={()=>restore(item.id)} title="Restaurar">↺</button>:<><button type="button" className={`${s.actionButton} ${s.checkin} ${item.status==="checked-in"?s.checked:""}`} onClick={()=>checkIn(item.id)}>{item.status==="checked-in"?"✓ En hotel":"→ Check-in"}</button><button type="button" className={s.actionButton} onClick={()=>setSelected(item)} title="Ver detalle">◉</button><button type="button" className={s.actionButton} onClick={()=>remove(item.id)} title="Mover a papelera">⌫</button></>}</div></td>
        </tr>)}</tbody>
      </table>
      {!visible.length&&<div className={s.empty}>No hay reservas que coincidan con esta vista.</div>}
    </div>
    <div className={s.footer}><span>Mostrando {visible.length} de {items.length}</span><span>Las acciones de esta pantalla son locales hasta conectar el servicio multi-tenant.</span></div>

    {selected&&<div className={s.drawerShade} onMouseDown={event=>event.target===event.currentTarget&&setSelected(null)}><aside className={s.drawer}>
      <header><div><small>RESERVA {selected.id}</small><h2>{selected.guest}</h2><p>{selected.channel} · Habitación {selected.room}</p></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header>
      <div className={s.summary}><div><small>Llegada</small><b>{date(selected.arrival)}</b></div><div><small>Salida</small><b>{date(selected.departure)}</b></div><div><small>Pago</small><b>{paymentLabel(selected.payment)}</b></div><div><small>Estado</small><b>{selected.status==="checked-in"?"En hotel":"Reservada"}</b></div></div>
      <section className={s.drawerSection}><small>HUÉSPED</small><h3>Contacto</h3><div className={s.metaList}><div><span>Email</span><b>{selected.email}</b></div><div><span>Teléfono</span><b>{selected.phone}</b></div><div><span>Canal</span><b>{selected.channel}</b></div></div></section>
      <section className={s.drawerSection}><small>ESTADÍA</small><h3>Asignación</h3><div className={s.metaList}><div><span>Habitación</span><b>{selected.room}</b></div><div><span>Entrada</span><b>{date(selected.arrival)}</b></div><div><span>Salida</span><b>{date(selected.departure)}</b></div></div></section>
      <div className={s.drawerActions}><button type="button" onClick={()=>setSelected(null)}>Cerrar</button><button type="button" className={s.mainAction} onClick={()=>checkIn(selected.id)}>{selected.status==="checked-in"?"Deshacer check-in":"Hacer check-in"}</button></div>
    </aside></div>}
  </section>
}
