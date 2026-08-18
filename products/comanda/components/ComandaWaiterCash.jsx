"use client";

import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
import c from "../styles/comanda-waiter-cash.module.css";

export default function ComandaWaiterCash(){
  const [station,setStation]=useState(null),[open,setOpen]=useState(false),[registers,setRegisters]=useState([]),[session,setSession]=useState(null),[amount,setAmount]=useState("0"),[registerId,setRegisterId]=useState(""),[saving,setSaving]=useState(false),[userEmail,setUserEmail]=useState("");
  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;
  const canUseCash=station?.permissions?.all===true||station?.permissions?.cash_open_close===true||["waiter","cashier","counter","delivery","principal","support"].includes(station?.kind);
  const fullCash=station?.permissions?.all===true||station?.permissions?.cash_full===true||station?.permissions?.cash_audit===true||["principal","support"].includes(station?.kind);

  async function refresh(){
    if(!branchId)return;
    const {data:regs}=await supabase.from("comanda_cash_registers").select("id,account_id,name,register_number").eq("branch_id",branchId).eq("active",true).order("register_number");
    setRegisters(regs||[]);if(!registerId&&regs?.[0])setRegisterId(regs[0].id);
    const ids=(regs||[]).map(x=>x.id);if(ids.length){const {data:s}=await supabase.from("comanda_cash_sessions").select("*").in("register_id",ids).eq("status","open").order("opened_at",{ascending:false}).limit(1).maybeSingle();setSession(s||null)}else setSession(null);
    const {data:{user}}=await supabase.auth.getUser();setUserEmail(user?.email||"");
  }
  useEffect(()=>{let alive=true;(async()=>{if(!workstationId){if(alive)setStation({kind:"principal",permissions:{all:true}});return}const {data}=await supabase.from("comanda_workstations").select("kind,permissions,is_support").eq("id",workstationId).maybeSingle();if(alive)setStation({kind:data?.is_support?"support":data?.kind||"custom",permissions:data?.permissions||{}})})();return()=>{alive=false}},[workstationId]);
  useEffect(()=>{if(canUseCash)refresh()},[canUseCash,branchId]);

  async function queuePrint(trigger,cashSessionId,accountId,userId){
    const {data:templates}=await supabase.from("comanda_ticket_templates").select("*").eq("branch_id",branchId).eq("active",true);
    for(const t of templates||[]){const tr=Array.isArray(t.triggers)?t.triggers:[];const found=tr.find(x=>(typeof x==="string"?x:x?.event||x?.trigger)===trigger);if(!found)continue;const copies=Math.max(1,Number(typeof found==="object"?found.copies:t.copies||1));for(let n=0;n<copies;n++)await supabase.from("comanda_print_jobs").insert({account_id:accountId,branch_id:branchId,printer_id:t.printer_id||null,template_id:t.id,cash_session_id:cashSessionId,status:"queued",payload:{trigger,copy:n+1},created_by:userId})}
  }
  async function audit(accountId,userId,cashSessionId,action,metadata={}){await supabase.from("comanda_audit_log").insert({account_id:accountId,branch_id:branchId,user_id:userId,workstation_id:workstationId||null,action,entity_type:"cash_session",entity_id:cashSessionId,metadata})}

  async function submit(){
    setSaving(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sesión inválida");
      if(session){
        const reg=registers.find(x=>x.id===session.register_id);if(!reg)throw new Error("No se encontró la caja de esta sesión");
        const closedAt=new Date().toISOString();const {error}=await supabase.from("comanda_cash_sessions").update({status:"closed",closed_by:user.id,closed_at:closedAt,closing_amount:Number(amount||0)}).eq("id",session.id);if(error)throw error;
        await audit(reg.account_id,user.id,session.id,"cash_close",{closing_amount:Number(amount||0),register_id:reg.id});await queuePrint("cash_close",session.id,reg.account_id,user.id);
      }else{
        const reg=registers.find(x=>x.id===registerId);if(!reg)throw new Error("Seleccioná una caja");
        const {data:created,error}=await supabase.from("comanda_cash_sessions").insert({account_id:reg.account_id,register_id:reg.id,opened_by:user.id,opened_at:new Date().toISOString(),opening_amount:Number(amount||0),status:"open",workstation_id:workstationId||null,cashier_name:userEmail||user.email||"Usuario"}).select().single();if(error)throw error;
        await audit(reg.account_id,user.id,created.id,"cash_open",{opening_amount:Number(amount||0),register_id:reg.id});await queuePrint("cash_open",created.id,reg.account_id,user.id);
      }
      setOpen(false);setAmount("0");await refresh();
    }catch(e){alert(e.message||"No se pudo actualizar la caja")}finally{setSaving(false)}
  }

  if(!canUseCash||fullCash)return null;
  return <><button className={c.cashPill} onClick={()=>{refresh();setOpen(true)}}><span>Caja</span><strong>{session?"Activa":"Cerrada"}</strong></button>{open&&<div className={c.overlay} onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><section className={c.modal}><header><div><span>CAJA OPERATIVA</span><h2>{session?"Cerrar caja":"Abrir caja"}</h2></div><button onClick={()=>setOpen(false)}>×</button></header><div className={c.body}>{session?<><p>Este puesto sólo puede abrir o cerrar la caja. Cada acción queda auditada automáticamente.</p><div className={c.audit}><span>Abierta por</span><strong>{session.cashier_name||"Usuario"}</strong><span>Apertura</span><strong>{new Date(session.opened_at).toLocaleString("es-AR")}</strong></div></>:<><p>Seleccioná una caja y cargá el monto inicial.</p><label>Caja<select value={registerId} onChange={e=>setRegisterId(e.target.value)}>{registers.map(r=><option key={r.id} value={r.id}>{r.name} #{r.register_number}</option>)}</select></label></>}<label>{session?"Monto de cierre":"Monto inicial"}<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><small>Usuario auditado: {userEmail||"sesión actual"}</small></div><footer><button onClick={()=>setOpen(false)}>Cancelar</button><button className={c.primary} disabled={saving} onClick={submit}>{saving?"Guardando…":session?"Cerrar caja":"Abrir caja"}</button></footer></section></div>}</>;
}
