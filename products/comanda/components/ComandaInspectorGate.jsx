"use client";

import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";

const elevatedLevels=new Set(["owner","propietario","principal","superadmin","super_admin","admin"]);

export default function ComandaInspectorGate({children}){
  const [state,setState]=useState("loading");
  const [error,setError]=useState("");

  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const {data:{user},error:userError}=await supabase.auth.getUser();
        if(userError||!user){
          if(alive)setState("login");
          return;
        }

        const [{data:owned,error:ownedError},{data:members,error:membersError},{data:profiles,error:profilesError},{data:branchLinks,error:linksError}]=await Promise.all([
          supabase.from("comanda_accounts").select("id").eq("owner_id",user.id),
          supabase.from("comanda_members").select("account_id,role").eq("user_id",user.id),
          supabase.from("comanda_user_profiles").select("account_id,access_level,active").eq("user_id",user.id).eq("active",true),
          supabase.from("comanda_user_branches").select("account_id,branch_id,is_default,active").eq("user_id",user.id).eq("active",true)
        ]);
        if(ownedError||membersError||profilesError||linksError)throw ownedError||membersError||profilesError||linksError;

        const accountIds=new Set((owned||[]).map(x=>x.id));
        for(const row of members||[])if(elevatedLevels.has(String(row.role||"").toLowerCase()))accountIds.add(row.account_id);
        for(const row of profiles||[])if(elevatedLevels.has(String(row.access_level||"").toLowerCase()))accountIds.add(row.account_id);
        for(const row of branchLinks||[])accountIds.add(row.account_id);
        if(!accountIds.size)throw new Error("Este usuario no tiene acceso a Comanda Llena.");

        const {data:branches,error:branchError}=await supabase.from("comanda_branches").select("id,account_id,name,active").in("account_id",[...accountIds]).eq("active",true).order("name");
        if(branchError)throw branchError;
        if(!branches?.length)throw new Error("No encontré una sucursal activa para este usuario.");

        const saved=sessionStorage.getItem("comanda_branch");
        const linkedDefault=(branchLinks||[]).find(x=>x.is_default&&branches.some(b=>b.id===x.branch_id));
        const linkedAny=(branchLinks||[]).find(x=>branches.some(b=>b.id===x.branch_id));
        const branch=branches.find(b=>b.id===saved)||branches.find(b=>b.id===linkedDefault?.branch_id)||branches.find(b=>b.id===linkedAny?.branch_id)||branches[0];

        sessionStorage.setItem("comanda_branch",branch.id);
        sessionStorage.setItem("comanda_access_level","owner");
        if(alive)setState("ready");
      }catch(e){
        if(alive){setError(e?.message||"No pude validar tu acceso al Inspector.");setState("error")}
      }
    })();
    return()=>{alive=false};
  },[]);

  if(state==="ready")return children;

  if(state==="login")return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",padding:24,background:"#09090c",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"}}><section style={{width:"min(420px,100%)",padding:24,border:"1px solid rgba(255,255,255,.12)",borderRadius:24,background:"rgba(255,255,255,.06)",boxShadow:"0 24px 80px rgba(0,0,0,.35)"}}><span style={{fontSize:12,letterSpacing:2,color:"#b99cff"}}>COMANDA LLENA</span><h1 style={{fontSize:34,margin:"10px 0 8px"}}>Inspector</h1><p style={{color:"#aaa",lineHeight:1.5,margin:"0 0 20px"}}>Iniciá sesión una vez y volvés directo al chat del Inspector.</p><a href="/comanda/login" style={{display:"block",textAlign:"center",padding:"14px 18px",borderRadius:16,textDecoration:"none",fontWeight:800,color:"#0b0b0d",background:"#fff"}}>Ingresar</a></section></main>;

  if(state==="error")return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",padding:24,background:"#09090c",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"}}><section style={{width:"min(460px,100%)",padding:24,border:"1px solid rgba(255,255,255,.12)",borderRadius:24,background:"rgba(255,255,255,.06)"}}><h1 style={{marginTop:0}}>No pude abrir Inspector</h1><p style={{color:"#bbb",lineHeight:1.5}}>{error}</p></section></main>;

  return <main style={{minHeight:"100dvh",display:"grid",placeItems:"center",background:"#09090c",color:"#fff",fontFamily:"Inter,system-ui,sans-serif"}}><div style={{opacity:.72,fontWeight:700}}>Abriendo Inspector…</div></main>;
}
