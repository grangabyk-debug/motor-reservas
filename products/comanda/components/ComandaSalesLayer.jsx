"use client";
import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ComandaSalesTerminal from "./ComandaSalesTerminal";

const SALE_LABELS=new Set(["Venta","Venta / Salón","Nueva venta","Realizar una venta"]);
const EXIT_LABELS=new Set(["Principal","Caja activa","Caja","Menú","Clientes","Reportes","Configuración","Usuarios","Funcionarios","Cajas","Puestos","Sectores","Cocinas","Impresión","Impresoras","Mi cuenta"]);
const clean=t=>String(t||"").replace(/\s+/g," ").trim();

export default function ComandaSalesLayer(){
 const [active,setActive]=useState(false),[role,setRole]=useState(null);
 useEffect(()=>{let alive=true;(async()=>{const id=sessionStorage.getItem("comanda_workstation");if(!id)return;const {data}=await supabase.from("comanda_workstations").select("kind,permissions").eq("id",id).maybeSingle();if(!alive)return;const r=data?.kind||null;setRole(r);if(["waiter","waiter_app"].includes(r))setActive(true)})();return()=>{alive=false}},[]);
 useEffect(()=>{const click=e=>{const b=e.target?.closest?.("button,a,[role=button]");if(!b)return;const t=clean(b.textContent);if(SALE_LABELS.has(t)||[...SALE_LABELS].some(x=>t.startsWith(x)))setActive(true);else if(EXIT_LABELS.has(t)||[...EXIT_LABELS].some(x=>t.startsWith(x)))setActive(false)};document.addEventListener("click",click,true);return()=>document.removeEventListener("click",click,true)},[]);
 if(!role||!active)return null;
 return <ComandaSalesTerminal/>;
}
