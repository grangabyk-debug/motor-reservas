"use client";

import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
import c from "../styles/comanda-waiter-cash.module.css";

export default function ComandaWaiterCash(){
  const [role,setRole]=useState(null),[open,setOpen]=useState(false),[registers,setRegisters]=useState([]),[session,setSession]=useState(null),[amount,setAmount]=useState("0"),[registerId,setRegisterId]=useState(""),[saving,setSaving]=useState(false),[userEmail,setUserEmail]=useState("");
  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;

  async function refresh(){
    if(!branchId)return;
    const {data:regs}=await supabase.from("comanda_cash_registers").select("id,account_id,name,register_number").eq("branch_id",branchId).eq("active",true).order("register_number");setRegisters(regs||[]);if(!registerId&&regs?.[0])setRegisterId(regs[0].id);
    const ids=(regs||[]).map(x=>x.id);if(ids.length){const {data:s}=await supabase.from("comanda_cash_sessions").select("*").in("register_id",ids).eq("status","open").order("opened_at",{ascending:false}).limit(1).maybeSingle();setSession(s||null)}else setSession(null);
    const {data:{user}}=await supabase.auth.getUser();setUserEmail(user?.email||"");
  }

  useEffect(()=>{let alive=true;(async()=>{if(!workstationId)return setRole("principal");const {data}=await supabase.from("comanda_workstations").select("kind").eq("id",workstationId).maybeSingle();if(alive)setRole(data?.kind||"principal")})();return()=>{alive=false}},[workstationId]);
  useEffect(()=>{if(role==="waiter")refresh()},[role,branchId]);

  async function submit(){
    setSaving(true);try{const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sesión inválida");
      if(session){const {error}=await supabase.from("comanda_cash_sessions").update({status:"closed",closed_by:user.id,closed_at:new Date().toISOString(),closing_amount:Number(amount||0)}).eq("id",session.id);if(error)throw error;}
      else{const reg=registers.find(x=>x.id===registerId);if(!reg)throw new Error("Seleccioná una caja");const {error}=await supabase.from("comanda_cash_sessions").insert({account_id:reg.account_id,register_id:reg.id,opened_by:user.id,opened_at:new Date().toISOString(),opening_amount:Number(amount||0),status:"open",workstation_id:workstationId||null,cashier_name:userEmail||user.email||"Camarero"});if(error)throw error;}
      setOpen(false);setAmount("0");await refresh();
    }catch(e){alert(e.message||"No se pudo actualizar la caja")}finally{setSaving(false)}
  }

  if(role!=="waiter")return null;
  return <>
    <button className={c.cashPill} onClick={()=>{refresh();setOpen(true)}}><span>Caja</span><strong>{session?"Activa":"Cerrada"}</strong></button>
    {open&&<div className={c.overlay} onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><section className={c.modal}>
      <header><div><span>CAJA</span><h2>{session?"Cerrar caja":"Abrir caja"}</h2></div><button onClick={()=>setOpen(false)}>×</button></header>
      <div className={c.body}>{session?<><p>Solo podés cerrar la caja activa. El usuario que realiza el cierre queda auditado.</p><div className={c.audit}><span>Abierta por</span><strong>{session.cashier_name||"Usuario"}</strong><span>Apertura</span><strong>{new Date(session.opened_at).toLocaleString("es-AR")}</strong></div></>:<><p>Seleccioná una caja y cargá el monto inicial.</p><label>Caja<select value={registerId} onChange={e=>setRegisterId(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name} #{r.register_number}</option>)}</select></label></>}<label>{session?"Monto de cierre":"Monto inicial"}<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><small>Usuario: {userEmail||"sesión actual"}</small></div>
      <footer><button onClick={()=>setOpen(false)}>Cancelar</button><button className={c.primary} disabled={saving} onClick={submit}>{saving?"Guardando…":session?"Cerrar caja":"Abrir caja"}</button></footer>
    </section></div>}
  </>;
}
