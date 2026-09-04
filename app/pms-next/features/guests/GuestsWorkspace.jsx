"use client"

import{useMemo,useState}from"react"
import s from"./guests.module.css"

const INITIAL=[
  {id:"g1",name:"Elena Petrova",email:"elena@example.com",phone:"+54 11 5555 2101",country:"Rusia",stays:22,lastStay:"2026-09-04",spent:1284000,status:"vip",notes:"Prefiere habitación silenciosa y almohada extra."},
  {id:"g2",name:"Noah Brown",email:"noah@example.com",phone:"+54 11 5555 2102",country:"Estados Unidos",stays:21,lastStay:"2026-09-04",spent:1169000,status:"vip",notes:"Viaja por trabajo. Check-in rápido."},
  {id:"g3",name:"Yuki Tanaka",email:"yuki@example.com",phone:"+54 11 5555 2103",country:"Japón",stays:21,lastStay:"2026-09-04",spent:1095000,status:"vip",notes:"Desayuno temprano."},
  {id:"g4",name:"Lucas Müller",email:"lucas@example.com",phone:"+54 11 5555 2104",country:"Alemania",stays:21,lastStay:"2026-09-04",spent:980000,status:"vip",notes:"Prefiere piso alto."},
  {id:"g5",name:"Amara Okafor",email:"amara@example.com",phone:"+54 11 5555 2105",country:"Nigeria",stays:21,lastStay:"2026-09-04",spent:945000,status:"vip",notes:"Sin preferencias registradas."},
  {id:"g6",name:"Chen Wei",email:"chen@example.com",phone:"+54 11 5555 2106",country:"China",stays:21,lastStay:"2026-09-04",spent:912000,status:"vip",notes:"Solicita factura A cuando viaja por empresa."},
  {id:"g7",name:"Sofia Rossi",email:"sofia@example.com",phone:"+54 11 5555 2107",country:"Italia",stays:21,lastStay:"2026-09-04",spent:889000,status:"vip",notes:"Habitación alejada del ascensor."},
  {id:"g8",name:"Liam Smith",email:"liam@example.com",phone:"+54 11 5555 2108",country:"Reino Unido",stays:21,lastStay:"2026-09-04",spent:870000,status:"vip",notes:"Late checkout frecuente."},
  {id:"g9",name:"Martina Díaz",email:"martina@example.com",phone:"+54 11 5555 2109",country:"Argentina",stays:1,lastStay:"2026-09-02",spent:148000,status:"new",notes:"Primera estadía."},
]

const initials=name=>name.trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase()
const date=value=>new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00`)).replace(".","")
const money=value=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(value)

export default function GuestsWorkspace(){
  const[guests,setGuests]=useState(INITIAL)
  const[query,setQuery]=useState("")
  const[selected,setSelected]=useState(null)
  const[formOpen,setFormOpen]=useState(false)
  const[error,setError]=useState("")
  const[draft,setDraft]=useState({name:"",email:"",phone:"",country:"Argentina",status:"new",notes:""})

  const filtered=useMemo(()=>{
    const term=query.trim().toLowerCase()
    return guests.filter(item=>!term||`${item.name} ${item.email} ${item.phone} ${item.country}`.toLowerCase().includes(term))
  },[guests,query])
  const vip=guests.filter(item=>item.status==="vip").length
  const regular=guests.filter(item=>item.status==="regular").length
  const fresh=guests.filter(item=>item.status==="new").length

  function openNew(){setDraft({name:"",email:"",phone:"",country:"Argentina",status:"new",notes:""});setError("");setFormOpen(true)}
  function save(){
    if(!draft.name.trim())return setError("Ingresá el nombre del huésped.")
    const guest={...draft,id:`g${Date.now()}`,name:draft.name.trim(),stays:0,lastStay:"2026-09-04",spent:0}
    setGuests(list=>[guest,...list]);setFormOpen(false)
  }

  return <section className={s.page}>
    <header className={s.heading}><div><small>CRM DE HUÉSPEDES</small><h1>Huéspedes</h1><p>{guests.length} perfiles registrados.</p></div><button type="button" className={s.primary} onClick={openNew}>＋ Agregar huésped</button></header>
    <div className={s.metrics}><article className={s.metric} data-kind="vip"><small>VIP</small><b>{vip}</b></article><article className={s.metric}><small>Huéspedes habituales</small><b>{regular}</b></article><article className={s.metric} data-kind="new"><small>Nuevos huéspedes</small><b>{fresh}</b></article></div>
    <div className={s.toolbar}><label className={s.search}>⌕<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Buscar huésped, email o país"/></label></div>
    <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Huésped</th><th>Contacto</th><th>País</th><th>Estadías</th><th>Última estadía</th><th>Gasto total</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td><div className={s.guestCell}><span className={s.avatar}>{initials(item.name)}</span><span><b>{item.name}</b><small>ID {item.id}</small></span></div></td><td className={s.contact}><b>{item.email||"—"}</b><small>{item.phone||"Sin teléfono"}</small></td><td>{item.country||"—"}</td><td>{item.stays}</td><td>{date(item.lastStay)}</td><td>{item.spent?money(item.spent):"—"}</td><td><span className={`${s.status} ${item.status==="regular"?s.statusRegular:item.status==="new"?s.statusNew:""}`}>{item.status==="vip"?"VIP":item.status==="new"?"Nuevo":"Habitual"}</span></td><td><button type="button" className={s.view} onClick={()=>setSelected(item)}>Ver</button></td></tr>)}</tbody></table>{!filtered.length&&<div className={s.empty}>No encontramos huéspedes con esa búsqueda.</div>}</div>

    {selected&&<div className={s.drawerShade} onMouseDown={event=>event.target===event.currentTarget&&setSelected(null)}><aside className={s.drawer}><header className={s.profileHead}><div className={s.profileIdentity}><span className={s.avatar}>{initials(selected.name)}</span><div><small>PERFIL DE HUÉSPED</small><h2>{selected.name}</h2><p>{selected.country} · {selected.status==="vip"?"VIP":selected.status==="new"?"Nuevo":"Habitual"}</p></div></div><button className={s.close} onClick={()=>setSelected(null)}>×</button></header><div className={s.profileMetrics}><div><small>Estadías</small><b>{selected.stays}</b></div><div><small>Última</small><b>{date(selected.lastStay)}</b></div><div><small>Valor</small><b>{selected.spent?money(selected.spent):"—"}</b></div></div><section className={s.section}><small>CONTACTO</small><h3>Datos del huésped</h3><div className={s.meta}><div><span>Email</span><b>{selected.email||"—"}</b></div><div><span>Teléfono</span><b>{selected.phone||"—"}</b></div><div><span>País</span><b>{selected.country||"—"}</b></div></div></section><section className={s.section}><small>PREFERENCIAS</small><h3>Notas operativas</h3><div className={s.notes}>{selected.notes||"Todavía no hay preferencias cargadas."}</div></section></aside></div>}

    {formOpen&&<div className={s.modalShade} onMouseDown={event=>event.target===event.currentTarget&&setFormOpen(false)}><div className={s.modal}><header><h2>Agregar huésped</h2><button className={s.close} onClick={()=>setFormOpen(false)}>×</button></header><div className={s.form}><label className={s.wide}>Nombre<input value={draft.name} onChange={event=>setDraft(value=>({...value,name:event.target.value}))} autoFocus/></label><label>Email<input type="email" value={draft.email} onChange={event=>setDraft(value=>({...value,email:event.target.value}))}/></label><label>Teléfono<input value={draft.phone} onChange={event=>setDraft(value=>({...value,phone:event.target.value}))}/></label><label>País<input value={draft.country} onChange={event=>setDraft(value=>({...value,country:event.target.value}))}/></label><label>Estado<select value={draft.status} onChange={event=>setDraft(value=>({...value,status:event.target.value}))}><option value="new">Nuevo</option><option value="regular">Habitual</option><option value="vip">VIP</option></select></label><label className={s.wide}>Notas<textarea value={draft.notes} onChange={event=>setDraft(value=>({...value,notes:event.target.value}))}/></label></div>{error&&<div className={s.error}>{error}</div>}<footer><button onClick={()=>setFormOpen(false)}>Cancelar</button><button onClick={save}>Guardar huésped</button></footer></div></div>}
  </section>
}
