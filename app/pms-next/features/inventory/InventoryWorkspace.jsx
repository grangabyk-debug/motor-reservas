"use client"

import{useMemo,useState}from"react"
import s from"./inventory.module.css"

const roomSeed=[
  {room:"101",missing:2,items:["2 vasos","1 toalla de mano"],last:"Nunca"},
  {room:"102",missing:0,items:[],last:"Hoy 10:15"},
  {room:"117",missing:1,items:["1 percha"],last:"Hoy 09:42"},
  {room:"204",missing:3,items:["2 vasos","1 control remoto"],last:"Ayer"},
  {room:"242",missing:0,items:[],last:"Hoy 11:20"},
  {room:"305",missing:1,items:["1 toalla de baño"],last:"03 Sep"},
]

const stockSeed=[
  {id:1,name:"Toalla de baño",category:"Blanquería",stock:48,min:30,unit:"u."},
  {id:2,name:"Toalla de mano",category:"Blanquería",stock:21,min:24,unit:"u."},
  {id:3,name:"Shampoo 30 ml",category:"Amenities",stock:186,min:120,unit:"u."},
  {id:4,name:"Vasos",category:"Habitación",stock:17,min:20,unit:"u."},
  {id:5,name:"Papel higiénico",category:"Limpieza",stock:96,min:60,unit:"rollos"},
  {id:6,name:"Pilas AAA",category:"Mantenimiento",stock:8,min:12,unit:"u."},
]

export default function InventoryWorkspace(){
  const[mode,setMode]=useState("rooms")
  const[rooms,setRooms]=useState(roomSeed)
  const[stock,setStock]=useState(stockSeed)
  const[query,setQuery]=useState("")
  const[selected,setSelected]=useState(null)

  const visibleStock=useMemo(()=>stock.filter(item=>!query||`${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase())),[stock,query])
  const low=stock.filter(item=>item.stock<item.min).length
  const missing=rooms.reduce((sum,room)=>sum+room.missing,0)

  function resolveRoom(roomNo){setRooms(current=>current.map(room=>room.room===roomNo?{...room,missing:0,items:[],last:"Ahora"}:room));setSelected(null)}
  function adjustStock(id,delta){setStock(current=>current.map(item=>item.id===id?{...item,stock:Math.max(0,item.stock+delta)}:item))}

  return <section className={s.page}>
    <header className={s.header}>
      <div><small>INVENTARIO</small><h1>Control de inventario</h1><p>Revisión por habitación y stock central del hotel.</p></div>
      <div className={s.switch}><button className={mode==="rooms"?s.active:""} onClick={()=>setMode("rooms")}>Habitaciones</button><button className={mode==="stock"?s.active:""} onClick={()=>setMode("stock")}>Stock central</button></div>
    </header>

    <div className={s.summary}><article><span>Faltantes en habitaciones</span><b>{missing}</b></article><article><span>Productos bajo mínimo</span><b>{low}</b></article><article><span>Habitaciones revisadas</span><b>{rooms.filter(r=>r.last!=="Nunca").length}/{rooms.length}</b></article></div>

    {mode==="rooms"?<div className={s.rooms}>
      {rooms.map(room=><button className={`${s.room} ${room.missing?s.roomWarn:""}`} key={room.room} onClick={()=>setSelected(room)}><div><small>Habitación</small><b>{room.room}</b></div><span>{room.missing?`${room.missing} faltante${room.missing>1?"s":""}`:"Completa"}</span><em>{room.last}</em></button>)}
      {selected&&<div className={s.drawerBackdrop} onClick={()=>setSelected(null)}><aside className={s.drawer} onClick={e=>e.stopPropagation()}><button className={s.close} onClick={()=>setSelected(null)}>×</button><small>HABITACIÓN</small><h2>{selected.room}</h2><p>Último control: {selected.last}</p><h3>Faltantes detectados</h3>{selected.items.length?<ul>{selected.items.map(item=><li key={item}>{item}</li>)}</ul>:<div className={s.ok}>Sin faltantes.</div>}<button className={s.primary} onClick={()=>resolveRoom(selected.room)}>Marcar inventario completo</button></aside></div>}
    </div>:<>
      <div className={s.toolbar}><label>⌕<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto o categoría"/></label><button onClick={()=>setQuery("")}>Limpiar</button></div>
      <div className={s.stockTable}><div className={s.stockHead}><span>Producto</span><span>Categoría</span><span>Actual</span><span>Mínimo</span><span>Estado</span><span>Ajustar</span></div>{visibleStock.map(item=>{const isLow=item.stock<item.min;return <article key={item.id}><div><b>{item.name}</b><small>{item.unit}</small></div><span>{item.category}</span><strong>{item.stock}</strong><span>{item.min}</span><span className={isLow?s.low:s.good}>{isLow?"Reponer":"OK"}</span><div className={s.adjust}><button onClick={()=>adjustStock(item.id,-1)}>−</button><button onClick={()=>adjustStock(item.id,1)}>+</button></div></article>})}</div>
    </>}
  </section>
}
