"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ComandaArt from "./ComandaArt";

const wrap={minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 10% 0%,rgba(249,115,22,.12),transparent 34%),linear-gradient(180deg,#fffaf5,#fff)",fontFamily:"Inter,system-ui,sans-serif",color:"#34251d"};
const shell={width:"min(1100px,100%)"};
const grid={display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14};
const card={border:"1px solid rgba(110,70,42,.14)",borderRadius:20,background:"rgba(255,255,255,.94)",padding:18,textAlign:"left",cursor:"pointer",color:"inherit",boxShadow:"0 12px 30px rgba(74,39,17,.08)",minHeight:142,overflow:"hidden"};
const muted={color:"#8a7567",fontSize:13,lineHeight:1.45};
const elevatedLevels=new Set(["owner","propietario","principal","superadmin","super_admin","admin"]);
const kindArt=(kind)=>({principal:"computer",counter:"computer",waiter:"waiter",waiter_app:"waiter",cashier:"cash",kitchen:"kitchen",bar:"bar",printer:"printer",delivery:"branch",delivery_app:"branch",support:"support"})[kind]||"computer";
const kindLabel=(kind)=>({principal:"Administración total",counter:"Venta de mostrador",waiter:"Venta, mesas y caja limitada",waiter_app:"Operación móvil de mozos",cashier:"Caja y cobros",kitchen:"Monitoreo de cocina",bar:"Comandas de bar",printer:"Impresión",delivery:"Logística y delivery",delivery_app:"App de delivery",support:"Soporte técnico"})[kind]||"Puesto operativo";

export default function ComandaAccessGate({children}){
  const [loading,setLoading]=useState(true),[user,setUser]=useState(null),[owned,setOwned]=useState([]),[elevatedAccounts,setElevatedAccounts]=useState(new Set()),[branches,setBranches]=useState([]),[branch,setBranch]=useState(null),[workstations,setWorkstations]=useState([]),[userWsLinks,setUserWsLinks]=useState([]),[staff,setStaff]=useState([]),[ready,setReady]=useState(false),[error,setError]=useState("");
  const ownerAccountIds=useMemo(()=>new Set(owned.map(a=>a.id)),[owned]);

  async function fallbackStaffWorkstations(branchId,staffRows){
    const ids=(staffRows||[]).filter(s=>s.branch_id===branchId).map(s=>s.id);
    if(!ids.length)return [];
    const {data}=await supabase.from("comanda_staff_workstations").select("workstation_id").in("staff_id",ids);
    return (data||[]).map(x=>x.workstation_id);
  }

  async function allowedWorkstations(branchId,accountId,wsLinks=userWsLinks,staffRows=staff,ownerIds=ownerAccountIds,elevatedIds=elevatedAccounts){
    const {data:all,error:we}=await supabase.from("comanda_workstations").select("*").eq("branch_id",branchId).eq("active",true).order("name");
    if(we)throw we;
    if(ownerIds.has(accountId)||elevatedIds.has(accountId))return all||[];
    const directIds=(wsLinks||[]).filter(x=>x.active!==false).map(x=>x.workstation_id);
    const legacyIds=directIds.length?[]:await fallbackStaffWorkstations(branchId,staffRows);
    const ids=new Set([...directIds,...legacyIds]);
    return (all||[]).filter(w=>ids.has(w.id));
  }

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const {data:{user:u}}=await supabase.auth.getUser();
        if(!u){location.href="/comanda/login";return}
        const [{data:accounts,error:ae},{data:members},{data:profiles},{data:branchLinks},{data:wsLinks},{data:staffRows}]=await Promise.all([
          supabase.from("comanda_accounts").select("id,name,owner_id,status").eq("owner_id",u.id),
          supabase.from("comanda_members").select("account_id,user_id,role").eq("user_id",u.id),
          supabase.from("comanda_user_profiles").select("account_id,user_id,access_level,active").eq("user_id",u.id).eq("active",true),
          supabase.from("comanda_user_branches").select("account_id,user_id,branch_id,is_default,active").eq("user_id",u.id).eq("active",true),
          supabase.from("comanda_user_workstations").select("account_id,user_id,workstation_id,is_default,active").eq("user_id",u.id).eq("active",true),
          supabase.from("comanda_staff").select("id,account_id,branch_id,user_id,active").eq("user_id",u.id).eq("active",true)
        ]);
        if(ae)throw ae;

        const ownerIds=new Set((accounts||[]).map(a=>a.id));
        const elevated=new Set();
        for(const m of members||[])if(elevatedLevels.has(String(m.role||"").toLowerCase()))elevated.add(m.account_id);
        for(const p of profiles||[])if(elevatedLevels.has(String(p.access_level||"").toLowerCase()))elevated.add(p.account_id);
        ownerIds.forEach(id=>elevated.add(id));

        const accountIds=[...new Set([...(accounts||[]).map(a=>a.id),...(members||[]).map(m=>m.account_id),...(profiles||[]).map(p=>p.account_id),...(branchLinks||[]).map(x=>x.account_id),...(staffRows||[]).map(s=>s.account_id)].filter(Boolean))];
        if(!accountIds.length){if(alive){setUser(u);setError("Este usuario todavía no tiene accesos asignados.");setLoading(false)}return}

        const {data:branchRows,error:be}=await supabase.from("comanda_branches").select("*").in("account_id",accountIds).eq("active",true).order("name");
        if(be)throw be;
        const branchIds=new Set((branchLinks||[]).map(x=>x.branch_id));
        const allowed=(branchRows||[]).filter(b=>elevated.has(b.account_id)||branchIds.has(b.id)||(staffRows||[]).some(s=>s.branch_id===b.id));
        if(!alive)return;

        setUser(u);
        setOwned(accounts||[]);
        setElevatedAccounts(elevated);
        setBranches(allowed);
        setUserWsLinks(wsLinks||[]);
        setStaff(staffRows||[]);
        const globalLevel=ownerIds.size?"owner":([...elevated].length?"superadmin":"operator");
        sessionStorage.setItem("comanda_access_level",globalLevel);

        const savedBranch=sessionStorage.getItem("comanda_branch"),savedWs=sessionStorage.getItem("comanda_workstation");
        if(savedBranch&&savedWs&&allowed.some(b=>b.id===savedBranch)){
          const b=allowed.find(x=>x.id===savedBranch);
          const ws=await allowedWorkstations(savedBranch,b.account_id,wsLinks||[],staffRows||[],ownerIds,elevated);
          if(ws.some(w=>w.id===savedWs)){
            setBranch(savedBranch);
            setWorkstations(ws);
            setReady(true);
            setLoading(false);
            return;
          }
        }

        sessionStorage.removeItem("comanda_branch");
        sessionStorage.removeItem("comanda_workstation");
        setLoading(false);
      }catch(e){
        if(alive){setError(e?.message||"No se pudieron cargar tus accesos.");setLoading(false)}
      }
    })();
    return()=>{alive=false};
  },[]);

  async function chooseBranch(b){
    try{
      const ws=await allowedWorkstations(b.id,b.account_id);
      sessionStorage.setItem("comanda_branch",b.id);
      sessionStorage.removeItem("comanda_workstation");
      setBranch(b.id);
      setWorkstations(ws);
    }catch(e){setError(e?.message||"No se pudieron cargar los puestos.")}
  }

  function chooseWorkstation(ws){
    sessionStorage.setItem("comanda_workstation",ws.id);
    location.reload();
  }

  if(loading)return <div style={wrap}><div style={{...card,cursor:"default",fontWeight:850}}>Cargando accesos…</div></div>;
  if(ready)return children;
  if(error&&!branches.length)return <div style={wrap}><div style={{...card,cursor:"default",maxWidth:520}}><h2 style={{marginTop:0}}>Acceso no configurado</h2><p style={muted}>{error}</p></div></div>;

  const selected=branches.find(b=>b.id===branch);
  return <div style={wrap}><style>{`.comanda-access-art{width:54px!important;height:54px!important;max-width:54px!important;max-height:54px!important;display:block;color:#e45b0a;margin:0 0 16px;flex:none}`}</style><main style={shell}><div style={{marginBottom:28}}><h1 style={{margin:"0 0 6px",fontSize:30}}>Comanda Llena</h1><p style={muted}>{selected?"Elegí el puesto de trabajo":"Elegí la sucursal con la que vas a trabajar"}</p></div>{!selected?<div style={grid}>{branches.map(b=><button key={b.id} style={card} onClick={()=>chooseBranch(b)}><ComandaArt kind="branch" className="comanda-access-art"/><strong style={{display:"block",fontSize:18,marginBottom:5}}>{b.name}</strong><span style={muted}>{ownerAccountIds.has(b.account_id)?"Propietario · acceso completo":elevatedAccounts.has(b.account_id)?"Superadmin · acceso completo":"Sucursal asignada"}</span></button>)}</div>:<><button onClick={()=>{setBranch(null);setWorkstations([]);sessionStorage.removeItem("comanda_branch")}} style={{border:0,background:"transparent",padding:0,marginBottom:16,color:"#c8520a",fontWeight:850,cursor:"pointer"}}>← Cambiar sucursal</button><div style={grid}>{workstations.map(ws=><button key={ws.id} style={card} onClick={()=>chooseWorkstation(ws)}><ComandaArt kind={kindArt(ws.kind)} className="comanda-access-art"/><strong style={{display:"block",fontSize:18,marginBottom:5}}>{ws.name}</strong><span style={muted}>{kindLabel(ws.kind)}</span></button>)}</div>{!workstations.length&&<div style={{...card,cursor:"default",marginTop:14}}>No tenés puestos asignados en esta sucursal.</div>}</>}</main></div>;
}
