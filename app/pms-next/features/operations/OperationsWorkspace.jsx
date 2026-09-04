"use client"

import{useMemo,useState}from"react"
import s from"./operations.module.css"

const STATUSES=[
  ["new","Nueva"],["ongoing","En curso"],["done","Hecho"],["check","Para revisar"],["scheduled","Programado"],["info","Info necesaria"],
]

const seedTasks=[
  {id:1,title:"Revisar pérdida de agua",room:"204",area:"Baño",priority:"Alta",status:"new",assignee:"Nicolás",due:"Hoy 13:30"},
  {id:2,title:"Control de cerradura electrónica",room:"118",area:"Acceso",priority:"Media",status:"ongoing",assignee:"Marcos",due:"Hoy 15:00"},
  {id:3,title:"Cambiar lámpara cabecera",room:"305",area:"Habitación",priority:"Baja",status:"scheduled",assignee:"Lucía",due:"Mañana"},
  {id:4,title:"Verificar minibar",room:"110",area:"Habitación",priority:"Media",status:"check",assignee:"Camila",due:"Hoy 17:00"},
]

const checklistSeed=[
  {id:1,title:"Apertura de recepción",owner:"Recepción",done:6,total:8,time:"07:00"},
  {id:2,title:"Control de pisos",owner:"Housekeeping",done:14,total:18,time:"10:00"},
  {id:3,title:"Cierre de caja",owner:"Recepción",done:0,total:7,time:"23:00"},
]

const requestSeed=[
  {id:1,guest:"Sofía Rossi",room:"117",request:"2 almohadas extra",status:"Pendiente",time:"10:42"},
  {id:2,guest:"Lucas Müller",room:"242",request:"Late checkout",status:"En revisión",time:"11:08"},
  {id:3,guest:"Elena Petrova",room:"119",request:"Taxi 06:30",status:"Confirmado",time:"11:26"},
]

export default function OperationsWorkspace({initialTab="maintenance"}){
  const[tab,setTab]=useState(initialTab==="tasks"?"checklists":initialTab)
  const[tasks,setTasks]=useState(seedTasks)
  const[query,setQuery]=useState("")
  const[view,setView]=useState("kanban")
  const[archived,setArchived]=useState(false)
  const[checklists,setChecklists]=useState(checklistSeed)
  const[requests,setRequests]=useState(requestSeed)

  const visibleTasks=useMemo(()=>tasks.filter(t=>!query||`${t.title} ${t.room} ${t.area} ${t.assignee}`.toLowerCase().includes(query.toLowerCase())),[tasks,query])

  function addTask(){
    const id=Date.now()
    setTasks(current=>[{id,title:"Nueva tarea",room:"—",area:"General",priority:"Media",status:"new",assignee:"Sin asignar",due:"Sin fecha"},...current])
  }
  function moveTask(id,status){setTasks(current=>current.map(task=>task.id===id?{...task,status}:task))}
  function cycleChecklist(id){setChecklists(current=>current.map(item=>item.id===id?{...item,done:item.done>=item.total?0:Math.min(item.total,item.done+1)}:item))}
  function advanceRequest(id){setRequests(current=>current.map(item=>item.id===id?{...item,status:item.status==="Pendiente"?"En revisión":item.status==="En revisión"?"Confirmado":"Confirmado"}:item))}

  return <section className={s.page}>
    <header className={s.header}>
      <div><small>OPERACIONES</small><h1>Operación del hotel</h1><p>Mantenimiento, rutinas y pedidos del huésped en un mismo lugar.</p></div>
      <div className={s.tabs}>
        <button className={tab==="maintenance"?s.active:""} onClick={()=>setTab("maintenance")}>Mantenimiento</button>
        <button className={tab==="checklists"?s.active:""} onClick={()=>setTab("checklists")}>Check-lists</button>
        <button className={tab==="requests"?s.active:""} onClick={()=>setTab("requests")}>Solicitudes</button>
      </div>
    </header>

    {tab==="maintenance"&&<>
      <div className={s.toolbar}>
        <div className={s.segment}><button className={view==="kanban"?s.active:""} onClick={()=>setView("kanban")}>Kanban</button><button className={view==="table"?s.active:""} onClick={()=>setView("table")}>Tabla</button></div>
        <label className={s.search}>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar tarea, habitación o técnico"/></label>
        <button className={archived?s.active:""} onClick={()=>setArchived(v=>!v)}>Archivo</button>
        <button className={s.primary} onClick={addTask}>+ Nueva tarea</button>
      </div>
      {archived?<div className={s.empty}><b>Archivo de mantenimiento</b><span>No hay tareas archivadas en esta demo.</span></div>:view==="kanban"?<div className={s.board}>{STATUSES.map(([id,label])=><section className={s.column} key={id} onDragOver={e=>e.preventDefault()} onDrop={e=>moveTask(Number(e.dataTransfer.getData("task")),id)}><header><b>{label}</b><span>{visibleTasks.filter(t=>t.status===id).length}</span></header><div className={s.cards}>{visibleTasks.filter(t=>t.status===id).map(task=><article draggable onDragStart={e=>e.dataTransfer.setData("task",String(task.id))} className={s.card} key={task.id}><div className={s.cardTop}><span className={s.priority}>{task.priority}</span><em>Hab. {task.room}</em></div><h3>{task.title}</h3><p>{task.area}</p><footer><span>{task.assignee}</span><small>{task.due}</small></footer></article>)}<button className={s.addGhost} onClick={addTask}>+ Agregar tarea</button></div></section>)}</div>:<div className={s.tableWrap}><table><thead><tr><th>Tarea</th><th>Habitación</th><th>Área</th><th>Prioridad</th><th>Responsable</th><th>Estado</th><th>Vence</th></tr></thead><tbody>{visibleTasks.map(task=><tr key={task.id}><td><b>{task.title}</b></td><td>{task.room}</td><td>{task.area}</td><td>{task.priority}</td><td>{task.assignee}</td><td><select value={task.status} onChange={e=>moveTask(task.id,e.target.value)}>{STATUSES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></td><td>{task.due}</td></tr>)}</tbody></table></div>}
    </>}

    {tab==="checklists"&&<div className={s.checkGrid}>{checklists.map(item=>{const pct=Math.round(item.done/item.total*100);return <article className={s.checkCard} key={item.id}><div><small>{item.owner}</small><h3>{item.title}</h3><span>{item.time}</span></div><div className={s.progress}><i style={{width:`${pct}%`}}/></div><footer><b>{item.done}/{item.total}</b><span>{pct}% completado</span><button onClick={()=>cycleChecklist(item.id)}>Marcar paso</button></footer></article>})}</div>}

    {tab==="requests"&&<div className={s.requestList}>{requests.map(item=><article key={item.id}><div className={s.avatar}>{item.guest[0]}</div><div><b>{item.guest}</b><small>Hab. {item.room} · {item.time}</small></div><p>{item.request}</p><span className={s.requestStatus}>{item.status}</span><button onClick={()=>advanceRequest(item.id)}>Actualizar</button></article>)}</div>}
  </section>
}
