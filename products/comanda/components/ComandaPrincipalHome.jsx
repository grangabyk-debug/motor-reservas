"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ComandaArt from "./ComandaArt";
import s from "../styles/comanda-principal-home.module.css";

const sections=[
  ["sale","Venta / Salón","Abrir mesas y tomar comandas","Venta",null],
  ["cash","Caja activa","Abrir, controlar o cerrar caja","Caja activa",null],
  ["menu","Menú","Productos, categorías y opciones","Menú",null],
  ["reports","Reportes","Ventas, caja, cocina y gestión","Reportes",null],
  ["user","Clientes","Historial e incidencias de clientes","Clientes",null],
  ["branch","Sectores y mesas","Diseñar el salón y las mesas","Config.","Sectores"],
  ["user","Usuarios","Crear logins, accesos y permisos","Config.","Usuarios"],
  ["computer","Puestos de trabajo","Crear puestos y configurar permisos","Config.","Puestos"],
  ["kitchen","Cocinas","Configurar cocinas y destinos","Config.","Cocinas"],
  ["printer","Impresión","Impresoras, tickets y comandas","Config.","Impresoras"],
];

function text(el){return el?.textContent?.replace(/\s+/g," ").trim()||""}
function clickExact(label){
  const all=[...document.querySelectorAll("button,a,[role=button]")];
  const el=all.find(x=>text(x)===label&&getComputedStyle(x).display!=="none");
  if(!el)return false;
  el.click();
  return true;
}
function greeting(){const h=new Date().getHours();return h<12?"Buenos días":h<19?"Buenas tardes":"Buenas noches"}

export default function ComandaPrincipalHome(){
  const [show,setShow]=useState(false);
  const [business,setBusiness]=useState("tu restaurante");
  const [branch,setBranch]=useState("");
  const [counts,setCounts]=useState({tables:0,staff:0,products:0,orders:0});
  const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;
  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;

  useEffect(()=>{
    let alive=true;
    (async()=>{
      if(!workstationId)return;
      const {data:ws}=await supabase.from("comanda_workstations").select("kind").eq("id",workstationId).maybeSingle();
      if(!alive||ws?.kind!=="principal")return;
      setShow(true);
      if(!branchId)return;
      const {data:b}=await supabase.from("comanda_branches").select("name,account_id").eq("id",branchId).maybeSingle();
      if(!alive||!b)return;
      setBranch(b.name||"");
      const {data:a}=await supabase.from("comanda_accounts").select("name").eq("id",b.account_id).maybeSingle();
      if(alive&&a?.name)setBusiness(a.name);
      const [t,st,p,o]=await Promise.all([
        supabase.from("comanda_tables").select("id",{count:"exact",head:true}).eq("branch_id",branchId).eq("active",true),
        supabase.from("comanda_staff").select("id",{count:"exact",head:true}).eq("branch_id",branchId).eq("active",true),
        supabase.from("comanda_products").select("id",{count:"exact",head:true}).eq("active",true),
        supabase.from("comanda_orders").select("id",{count:"exact",head:true}).eq("branch_id",branchId).in("status",["open","pending","sent","preparing","ready"])
      ]);
      if(alive)setCounts({tables:t.count||0,staff:st.count||0,products:p.count||0,orders:o.count||0});
    })();
    return()=>{alive=false};
  },[workstationId,branchId]);

  useEffect(()=>{
    const handler=e=>{
      const el=e.target?.closest?.("button,a,[role=button]");
      if(!el)return;
      const label=text(el);
      if(label==="Principal"){
        setShow(true);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if(["Caja activa","Venta / Salón","Menú","Clientes","Reportes","Configuración"].includes(label))setShow(false);
    };
    document.addEventListener("click",handler,true);
    return()=>document.removeEventListener("click",handler,true);
  },[]);

  const stats=useMemo(()=>[
    [counts.orders,"Comandas activas"],
    [counts.tables,"Mesas configuradas"],
    [counts.staff,"Funcionarios"],
    [counts.products,"Productos"]
  ],[counts]);

  function open(target,sub){
    setShow(false);
    clickExact(target);
    if(sub)setTimeout(()=>clickExact(sub),140);
  }

  if(!show)return null;
  return <main className={s.overlay} data-principal-home="1">
    <section className={s.hero}>
      <div>
        <span className={s.eyebrow}>PUESTO PRINCIPAL · {branch||"SUCURSAL"}</span>
        <h1>{greeting()}, <strong>{business}</strong></h1>
        <p>Todo el restaurante desde un solo lugar. Configurá la operación y supervisá lo que está pasando ahora.</p>
      </div>
      <div className={s.live}><span></span>Operación conectada</div>
    </section>
    <section className={s.stats}>{stats.map(([n,l])=><article key={l}><strong>{n}</strong><span>{l}</span></article>)}</section>
    <div className={s.sectionTitle}><div><span>ACCESOS PRINCIPALES</span><h2>¿Qué querés hacer?</h2></div></div>
    <section className={s.grid}>{sections.map(([art,title,desc,target,sub])=><button key={title} onClick={()=>open(target,sub)}><div className={s.art}><ComandaArt kind={art}/></div><strong>{title}</strong><span>{desc}</span></button>)}</section>
  </main>;
}
