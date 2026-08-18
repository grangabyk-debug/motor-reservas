"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ComandaArt from "./ComandaArt";

const wrap={minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 10% 0%,rgba(249,115,22,.12),transparent 34%),linear-gradient(180deg,#fffaf5,#fff)",fontFamily:"Inter,system-ui,sans-serif",color:"#34251d"};
const shell={width:"min(1100px,100%)"};
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14};
const card={border:"1px solid rgba(110,70,42,.14)",borderRadius:20,background:"rgba(255,255,255,.94)",padding:18,textAlign:"left",cursor:"pointer",color:"inherit",boxShadow:"0 12px 30px rgba(74,39,17,.08)"};
const muted={color:"#8a7567",fontSize:13,lineHeight:1.45};
const art={width:54,height:54,color:"#e45b0a",marginBottom:16};

const kindArt=(kind)=>({principal:"computer",waiter:"waiter",kitchen:"kitchen",bar:"bar",printer:"printer",support:"support"})[kind]||"computer";

export default function ComandaAccessGate({children}){
  const [loading,setLoading]=useState(true);
  const [user,setUser]=useState(null);
  const [owned,setOwned]=useState([]);
  const [staff,setStaff]=useState([]);
  const [branches,setBranches]=useState([]);
  const [branch,setBranch]=useState(null);
  const [workstations,setWorkstations]=useState([]);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState("");

  const ownerAccountIds=useMemo(()=>new Set(owned.map(a=>a.id)),[owned]);

  async function loadAllowedWorkstations(branchId,staffRows,owner){
    const {data:all,error:we}=await supabase.from("comanda_workstations").select("*").eq("branch_id",branchId).eq("active",true).order("name");
    if(we)throw we;
    if(owner)return all||[];
    const staffIds=(staffRows||[]).filter(s=>s.branch_id===branchId).map(s=>s.id);
    if(!staffIds.length)return [];
    const {data:links,error:le}=await supabase.from("comanda_staff_workstations").select("workstation_id,staff_id,is_default").in("staff_id",staffIds);
    if(le)throw le;
    const ids=new Set((links||[]).map(l=>l.workstation_id));
    return (all||[]).filter(w=>ids.has(w.id));
  }

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const {data:{user:u}}=await supabase.auth.getUser();
        if(!u){location.href="/comanda/login";return}
        const [{data:accounts,error:ae},{data:staffRows,error:se}]=await Promise.all([
          supabase.from("comanda_accounts").select("id,name,owner_id,status").eq("owner_id",u.id),
          supabase.from("comanda_staff").select("id,account_id,branch_id,name,user_id,active").eq("user_id",u.id).eq("active",true)
        ]);
        if(ae||se)throw ae||se;
        const ownerIds=new Set((accounts||[]).map(a=>a.id));
        const accountIds=[...new Set([...(accounts||[]).map(a=>a.id),...(staffRows||[]).map(s=>s.account_id)].filter(Boolean))];
        if(!accountIds.length){if(alive){setUser(u);setError("Este usuario todavía no tiene sucursales ni puestos asignados.");setLoading(false)}return}
        const {data:branchRows,error:be}=await supabase.from("comanda_branches").select("*").in("account_id",accountIds).eq("active",true).order("name");
        if(be)throw be;
        const allowed=(branchRows||[]).filter(b=>ownerIds.has(b.account_id)||(staffRows||[]).some(s=>s.branch_id===b.id));
        if(!alive)return;
        setUser(u);setOwned(accounts||[]);setStaff(staffRows||[]);setBranches(allowed);

        const savedBranch=sessionStorage.getItem("comanda_branch");
        const savedWs=sessionStorage.getItem("comanda_workstation");
        if(savedBranch&&savedWs&&allowed.some(b=>b.id===savedBranch)){
          const b=allowed.find(x=>x.id===savedBranch);
          const ws=await loadAllowedWorkstations(savedBranch,staffRows||[],ownerIds.has(b.account_id));
          if(ws.some(w=>w.id===savedWs)){setBranch(savedBranch);setWorkstations(ws);setReady(true);setLoading(false);return}
        }
        sessionStorage.removeItem("comanda_branch");sessionStorage.removeItem("comanda_workstation");
        setLoading(false);
      }catch(e){if(alive){setError(e?.message||"No se pudieron cargar tus accesos.");setLoading(false)}}
    })();
    return()=>{alive=false};
  },[]);

  async function chooseBranch(b){
    try{
      const ws=await loadAllowedWorkstations(b.id,staff,ownerAccountIds.has(b.account_id));
      sessionStorage.setItem("comanda_branch",b.id);sessionStorage.removeItem("comanda_workstation");
      setBranch(b.id);setWorkstations(ws);
    }catch(e){setError(e?.message||"No se pudieron cargar los puestos.")}
  }

  function chooseWorkstation(ws){sessionStorage.setItem("comanda_workstation",ws.id);location.reload()}

  if(loading)return <div style={wrap}><div style={{...card,cursor:"default",fontWeight:850}}>Cargando accesos…</div></div>;
  if(ready)return children;
  if(error&&!branches.length)return <div style={wrap}><div style={{...card,cursor:"default",maxWidth:520}}><h2 style={{marginTop:0}}>Acceso no configurado</h2><p style={muted}>{error}</p></div></div>;

  const selected=branches.find(b=>b.id===branch);
  return <div style={wrap}><main style={shell}>
    <div style={{marginBottom:28}}><h1 style={{margin:"0 0 6px",fontSize:30}}>Comanda Llena</h1><p style={muted}>{selected?"Elegí el puesto de trabajo":"Elegí la sucursal con la que vas a trabajar"}</p></div>
    {!selected?<div style={grid}>{branches.map(b=><button key={b.id} style={card} onClick={()=>chooseBranch(b)}><ComandaArt kind="branch" className=""/><div style={{...art,marginTop:-54,opacity:0}}/><strong style={{display:"block",fontSize:18,marginBottom:5}}>{b.name}</strong><span style={muted}>{ownerAccountIds.has(b.account_id)?"Propietario · acceso completo":"Sucursal asignada"}</span></button>)}</div>:
    <><button onClick={()=>{setBranch(null);setWorkstations([]);sessionStorage.removeItem("comanda_branch")}} style={{border:0,background:"transparent",padding:0,marginBottom:16,color:"#c8520a",fontWeight:850,cursor:"pointer"}}>← Cambiar sucursal</button><div style={grid}>{workstations.map(ws=><button key={ws.id} style={card} onClick={()=>chooseWorkstation(ws)}><ComandaArt kind={kindArt(ws.kind)} className=""/><div style={{...art,marginTop:-54,opacity:0}}/><strong style={{display:"block",fontSize:18,marginBottom:5}}>{ws.name}</strong><span style={muted}>{ws.kind==="principal"?"Administración total":ws.kind==="waiter"?"Venta y mesas":ws.kind==="kitchen"?"Monitoreo de cocina":ws.kind==="bar"?"Comandas de bar":ws.kind==="printer"?"Impresión":ws.is_support?"Soporte técnico":"Puesto operativo"}</span></button>)}</div>{!workstations.length&&<div style={{...card,cursor:"default",marginTop:14}}>No tenés puestos asignados en esta sucursal.</div>}</>}
  </main></div>;
}
