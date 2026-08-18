"use client";

import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ComandaArt from "./ComandaArt";
import s from "../styles/comanda-reports.module.css";

const GROUPS=[
 {key:"sales",title:"Ventas",art:"sale",perm:"reports_sales",items:["Resumen","Detalle","Por concepto","Tiempos de demora"]},
 {key:"cash",title:"Cajas",art:"cash",perm:"reports_cash",items:["Detalle","Pagos","Movimientos"]},
 {key:"workday",title:"Días de trabajo",art:"computer",perm:"reports_workday",items:["Detalle"]},
 {key:"customers",title:"Clientes",art:"user",perm:"reports_customers",items:["Detalle","Registro de incidencias"]},
 {key:"kitchen",title:"Cocinas",art:"kitchen",perm:"reports_kitchen",items:["Ventas","Tiempos de preparación"]},
 {key:"stock",title:"Stock",art:"menu",perm:"reports_stock",items:["Movimientos","Stock actual"]},
 {key:"staff",title:"Funcionarios",art:"waiter",perm:"reports_staff",items:["Detalle","Ventas por funcionario"]},
];
function txt(el){return el?.textContent?.replace(/\s+/g," ").trim()||""}
function money(n){return new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(n||0))}

export default function ComandaReportsHub(){
 const [open,setOpen]=useState(false),[permissions,setPermissions]=useState({}),[summary,setSummary]=useState({sales:0,orders:0,cash:0,customers:0,kitchen:0,stock:0,staff:0,workday:0}),[branchName,setBranchName]=useState("");
 const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
 const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;
 async function load(){if(!branchId)return;const [{data:w},{data:b},{data:orders},{data:payments},{count:customers},{count:staff},{count:stock},{count:days},{count:kitchen}]=await Promise.all([supabase.from("comanda_workstations").select("permissions").eq("id",workstationId).maybeSingle(),supabase.from("comanda_branches").select("name").eq("id",branchId).maybeSingle(),supabase.from("comanda_orders").select("id,total,status").eq("branch_id",branchId),supabase.from("comanda_payments").select("amount").eq("branch_id",branchId),supabase.from("comanda_customers").select("id",{count:"exact",head:true}).eq("branch_id",branchId),supabase.from("comanda_staff").select("id",{count:"exact",head:true}).eq("branch_id",branchId).eq("active",true),supabase.from("comanda_inventory_items").select("id",{count:"exact",head:true}).eq("branch_id",branchId),supabase.from("comanda_business_days").select("id",{count:"exact",head:true}).eq("branch_id",branchId),supabase.from("comanda_kitchens").select("id",{count:"exact",head:true}).eq("branch_id",branchId).eq("active",true)]);const p=w?.permissions||{};setPermissions(p);setBranchName(b?.name||"");setSummary({sales:(orders||[]).reduce((a,o)=>a+Number(o.total||0),0),orders:(orders||[]).length,cash:(payments||[]).reduce((a,x)=>a+Number(x.amount||0),0),customers:customers||0,staff:staff||0,stock:stock||0,workday:days||0,kitchen:kitchen||0})}
 useEffect(()=>{const f=e=>{const el=e.target?.closest?.("button,a,[role=button]");if(!el)return;const t=txt(el);if(t==="Reportes"){setOpen(true);setTimeout(load,0)}if(open&&["Principal","Caja activa","Venta / Salón","Menú","Clientes","Configuración"].includes(t))setOpen(false)};document.addEventListener("click",f,true);return()=>document.removeEventListener("click",f,true)},[open,branchId,workstationId]);
 const all=permissions.all===true||permissions.reports===true;
 const groups=GROUPS.filter(g=>all||permissions[g.perm]===true);
 function exportXls(){const rows=[["Reporte","Valor"],["Ventas",summary.sales],["Comandas",summary.orders],["Caja",summary.cash],["Clientes",summary.customers],["Funcionarios",summary.staff],["Stock",summary.stock],["Días de trabajo",summary.workday],["Cocinas",summary.kitchen]];const blob=new Blob([rows.map(r=>r.join("\t")).join("\n")],{type:"application/vnd.ms-excel;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`comanda-reportes-${new Date().toISOString().slice(0,10)}.xls`;a.click();URL.revokeObjectURL(a.href)}
 if(!open)return null;
 return <main className={s.overlay}><header className={s.header}><div><span>REPORTES · {branchName||"SUCURSAL"}</span><h1>Reportes</h1><p>Información operativa y administrativa organizada por área.</p></div><button onClick={exportXls}>Exportar XLS</button></header><section className={s.kpis}><article><strong>{money(summary.sales)}</strong><span>Ventas registradas</span></article><article><strong>{summary.orders}</strong><span>Comandas</span></article><article><strong>{money(summary.cash)}</strong><span>Pagos registrados</span></article><article><strong>{summary.staff}</strong><span>Funcionarios activos</span></article></section><section className={s.grid}>{groups.map(g=><article key={g.key}><div className={s.art}><ComandaArt kind={g.art}/></div><h2>{g.title}</h2>{g.items.map(item=><button key={item}>{item}</button>)}</article>)}</section>{!groups.length&&<div className={s.empty}>Este puesto no tiene reportes habilitados.</div>}</main>
}
