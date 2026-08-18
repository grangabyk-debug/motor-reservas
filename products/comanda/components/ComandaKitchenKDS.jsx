"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {supabase} from "../../../lib/supabase";
import k from "../styles/comanda-kds.module.css";

const STATUS={pending:{label:"Recibida",next:"preparing"},preparing:{label:"En preparación",next:"ready"},ready:{label:"Lista",next:null}};

function age(ts){const mins=Math.max(0,Math.floor((Date.now()-new Date(ts).getTime())/60000));if(mins<1)return "Ahora";if(mins<60)return `${mins} min`;return `${Math.floor(mins/60)} h ${mins%60} min`;}
function beep(){try{const Ctx=window.AudioContext||window.webkitAudioContext;const ctx=new Ctx();const o=ctx.createOscillator();const g=ctx.createGain();o.type="sine";o.frequency.setValueAtTime(880,ctx.currentTime);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.22,ctx.currentTime+.02);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.45);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.46);}catch{}}

export default function ComandaKitchenKDS(){
  const [role,setRole]=useState(null);
  const [items,setItems]=useState([]);
  const [tables,setTables]=useState({});
  const [loading,setLoading]=useState(false);
  const [clock,setClock]=useState(new Date());
  const [meta,setMeta]=useState({branch:"",workstation:"Cocina",turn:"Turno único"});
  const known=useRef(new Set());
  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;

  async function load(){
    if(!branchId)return;setLoading(true);
    const {data:rows}=await supabase.from("comanda_order_items").select("id,order_id,product_name,quantity,notes,kitchen_status,sent_at,created_at,special_flags,options,kitchen_id").in("kitchen_status",["pending","preparing","ready"]).order("sent_at",{ascending:true,nullsFirst:true}).order("created_at",{ascending:true});
    const orderIds=[...new Set((rows||[]).map(x=>x.order_id))];
    let orderMap={};
    if(orderIds.length){
      const {data:orders}=await supabase.from("comanda_orders").select("id,branch_id,table_id,label,room_number,opened_at,status").eq("branch_id",branchId).in("id",orderIds).neq("status","cancelled");
      const tableIds=[...new Set((orders||[]).map(x=>x.table_id).filter(Boolean))];
      let tableMap={};
      if(tableIds.length){const {data:t}=await supabase.from("comanda_tables").select("id,number,room_number,table_type").in("id",tableIds);tableMap=Object.fromEntries((t||[]).map(x=>[x.id,x]));}
      orderMap=Object.fromEntries((orders||[]).map(o=>[o.id,{...o,table:tableMap[o.table_id]||null}]));
    }
    const filtered=(rows||[]).filter(x=>orderMap[x.order_id]);
    const fresh=filtered.filter(x=>!known.current.has(x.id)&&x.kitchen_status==="pending");
    if(known.current.size&&fresh.length)beep();
    filtered.forEach(x=>known.current.add(x.id));
    setItems(filtered);setTables(orderMap);setLoading(false);
  }

  useEffect(()=>{let alive=true;(async()=>{
    if(!workstationId){setRole("principal");return}
    const [{data:ws},{data:branch}]=await Promise.all([
      supabase.from("comanda_workstations").select("kind,name").eq("id",workstationId).maybeSingle(),
      branchId?supabase.from("comanda_branches").select("name").eq("id",branchId).maybeSingle():Promise.resolve({data:null})
    ]);
    if(alive){setRole(ws?.kind||"principal");setMeta(m=>({...m,workstation:ws?.name||"Cocina",branch:branch?.name||""}))}
  })();return()=>{alive=false}},[workstationId,branchId]);

  useEffect(()=>{const t=setInterval(()=>setClock(new Date()),1000);return()=>clearInterval(t)},[]);
  useEffect(()=>{
    if(role!=="kitchen")return;load();
    const ch=supabase.channel(`kds-${branchId}`).on("postgres_changes",{event:"*",schema:"public",table:"comanda_order_items"},()=>load()).on("postgres_changes",{event:"*",schema:"public",table:"comanda_orders",filter:`branch_id=eq.${branchId}`},()=>load()).subscribe();
    const timer=setInterval(()=>setItems(x=>[...x]),30000);return()=>{clearInterval(timer);supabase.removeChannel(ch)};
  },[role,branchId]);

  const tickets=useMemo(()=>{const map=new Map();for(const item of items){if(!map.has(item.order_id))map.set(item.order_id,[]);map.get(item.order_id).push(item)}return [...map.entries()].map(([orderId,rows])=>({order:tables[orderId],rows,status:rows.every(x=>x.kitchen_status==="ready")?"ready":rows.some(x=>x.kitchen_status==="preparing")?"preparing":"pending"}));},[items,tables]);

  async function setTicketStatus(ticket,next){const ids=ticket.rows.filter(x=>x.kitchen_status!=="cancelled"&&x.kitchen_status!=="delivered").map(x=>x.id);if(!ids.length)return;const patch={kitchen_status:next,updated_at:new Date().toISOString()};if(next==="preparing")patch.started_at=new Date().toISOString();if(next==="ready")patch.prepared_at=new Date().toISOString();await supabase.from("comanda_order_items").update(patch).in("id",ids);await load();}

  if(role!=="kitchen")return null;
  return <main className={k.kds} data-kds="1">
    <header className={k.header}>
      <div><span>{meta.workstation.toUpperCase()}</span><h1>Monitoreo de cocina</h1><p>{meta.branch||"Sucursal"} · {tickets.length} comandas activas</p></div>
      <div className={k.legend}><i className={k.red}/>Recibida <i className={k.amber}/>En preparación <i className={k.green}/>Lista</div>
    </header>
    {loading&&!tickets.length?<div className={k.empty}>Cargando comandas…</div>:tickets.length?<div className={k.board}>{tickets.map(ticket=>{const o=ticket.order;const table=o?.table;const title=table?.table_type==="room"?`Room ${table.room_number||o.room_number}`:`Mesa ${table?.number||"-"}`;const cfg=STATUS[ticket.status];return <article key={o.id} className={`${k.ticket} ${k[ticket.status]}`}><div className={k.ticketHead}><div><strong>{title}</strong>{o.label&&<span>{o.label}</span>}</div><time>{age(ticket.rows[0]?.sent_at||ticket.rows[0]?.created_at)}</time></div><div className={k.status}>{cfg.label}</div><div className={k.items}>{ticket.rows.map(item=><div className={k.item} key={item.id}><b>{Number(item.quantity)}×</b><div><strong>{item.product_name}</strong>{item.notes&&<small>{item.notes}</small>}{Array.isArray(item.options)&&item.options.length>0&&<small>{item.options.map(x=>x.name||x.label||x).join(" · ")}</small>}{item.special_flags?.celiac&&<em>ALERTA CELÍACO</em>}</div></div>)}</div>{cfg.next?<button className={k.advance} onClick={()=>setTicketStatus(ticket,cfg.next)}>{cfg.next==="preparing"?"Comenzar preparación":"Marcar todo listo"}</button>:<div className={k.done}>Lista para entregar</div>}</article>})}</div>:<div className={k.empty}><strong>No hay comandas pendientes</strong><span>Las nuevas comandas aparecerán acá automáticamente.</span></div>}
    <footer className={k.bottomBar}><strong>{meta.workstation.toUpperCase()}</strong><span>{clock.toLocaleDateString("es-AR")}</span><span>{clock.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</span><span>{meta.turn}</span><span>Sin acceso a caja</span></footer>
  </main>;
}
