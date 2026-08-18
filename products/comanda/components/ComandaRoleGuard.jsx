"use client";

import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";

const DEFAULTS={
  principal:{admin:true,salonEdit:true,cashMode:"full",sale:true,kds:false,print:true},
  support:{admin:true,salonEdit:true,cashMode:"full",sale:true,kds:false,print:true},
  waiter:{admin:false,salonEdit:false,cashMode:"open_close",sale:true,kds:false,print:true},
  cashier:{admin:false,salonEdit:false,cashMode:"full",sale:true,kds:false,print:true},
  kitchen:{admin:false,salonEdit:false,cashMode:"none",sale:false,kds:true,print:false},
  bar:{admin:false,salonEdit:false,cashMode:"none",sale:false,kds:true,print:false},
  printer:{admin:false,salonEdit:false,cashMode:"none",sale:false,kds:false,print:true},
  custom:{admin:false,salonEdit:false,cashMode:"none",sale:true,kds:false,print:false}
};

const ADMIN_LABELS=new Set(["Usuarios","Funcionarios","Cajas","Puestos","Sectores","Cocinas","Impresoras","Impresión","Tickets","Notificaciones","Módulos y pagos","Mi cuenta","Comercio","Sucursales"]);
const SALON_EDIT_LABELS=new Set(["Diagramar salón","Mantenimiento de sectores","Editar sector","Nuevo sector","Agregar sector","Configuración del salón"]);
const FULL_CASH_LABELS=new Set(["Movimiento de caja","Movimientos","Retiro","Retiros","Ticket de control","Enviar control por mail","Pagos","Propinas"]);
const MENU_EDIT_LABELS=new Set(["Nueva categoría","Nuevo producto","Editar categoría","Editar producto","Opciones","Combos","Ingredientes"]);
const REPORT_LABELS=new Set(["Reportes","Reporte","Exportar Excel","Exportar XLSX"]);
const CUSTOMER_ADMIN_LABELS=new Set(["Nuevo cliente","Eliminar cliente","Editar cliente","Incidentes"]);

function txt(el){return el?.textContent?.replace(/\s+/g," ").trim()||""}
function visible(el){if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden"}
function clickLegacy(labels){const all=[...document.querySelectorAll("button")].filter(b=>visible(b)&&!b.closest('[data-role-guard="1"]'));for(const l of labels){const b=all.find(x=>txt(x)===l);if(b){b.click();return true}}return false}
function resolveCfg(role,permissions={}){const base=DEFAULTS[role]||DEFAULTS.custom;const all=permissions?.all===true;return {admin:all||permissions?.settings===true||base.admin,salonEdit:all||permissions?.tables_layout===true,cashMode:all||permissions?.cash_full===true?"full":permissions?.cash_open_close===true?"open_close":base.cashMode,sale:all||permissions?.sale===true||base.sale,kds:permissions?.kds===true||permissions?.kds_view===true||base.kds,print:all||permissions?.print_queue===true||base.print,menuEdit:all||permissions?.menu_edit===true,reports:all||permissions?.reports===true||permissions?.reports_sales===true||permissions?.reports_cash===true,customers:all||permissions?.customers===true||permissions?.customer_read===true};}

export default function ComandaRoleGuard(){
  const [station,setStation]=useState(null);
  useEffect(()=>{let alive=true;(async()=>{const id=sessionStorage.getItem("comanda_workstation");if(!id){if(alive)setStation({role:"principal",permissions:{all:true}});return}const {data}=await supabase.from("comanda_workstations").select("kind,permissions,is_support").eq("id",id).maybeSingle();if(alive)setStation({role:data?.is_support?"support":data?.kind||"custom",permissions:data?.permissions||{}})})();return()=>{alive=false}},[]);
  useEffect(()=>{if(!station)return;const {role,permissions}=station,cfg=resolveCfg(role,permissions);document.documentElement.dataset.comandaRole=role;document.documentElement.dataset.comandaSalonEdit=cfg.salonEdit?"1":"0";document.documentElement.dataset.comandaCashMode=cfg.cashMode;document.documentElement.dataset.comandaPermissions=JSON.stringify(permissions||{});
    const forbiddenLabel=label=>(!cfg.admin&&ADMIN_LABELS.has(label))||(!cfg.salonEdit&&SALON_EDIT_LABELS.has(label))||(cfg.cashMode!=="full"&&FULL_CASH_LABELS.has(label))||(!cfg.menuEdit&&MENU_EDIT_LABELS.has(label))||(!cfg.reports&&REPORT_LABELS.has(label))||(!cfg.customers&&CUSTOMER_ADMIN_LABELS.has(label));
    const apply=()=>{for(const el of document.querySelectorAll("button,a,[role=button]")){const label=txt(el);if(forbiddenLabel(label)&&!el.closest('[data-session-ui="1"]'))el.style.display="none";}if(!cfg.salonEdit){for(const el of document.querySelectorAll('[data-sector-planner="1"]'))el.style.display="none";}};
    const deny=e=>{const el=e.target?.closest?.("button,a,[role=button]");if(!el||!forbiddenLabel(txt(el)))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();};
    apply();const mo=new MutationObserver(apply);mo.observe(document.body,{subtree:true,childList:true});document.addEventListener("click",deny,true);
    const t=setTimeout(()=>{if(role==="waiter"||role==="custom")clickLegacy(["Venta"]);else if(role==="cashier")clickLegacy(["Caja activa","Caja"]);else if(role==="kitchen")clickLegacy(["Cocina"]);else if(role==="bar")clickLegacy(["Bar"]);else if(role==="printer")clickLegacy(["Impresión","Impresoras"]);},180);
    return()=>{clearTimeout(t);mo.disconnect();document.removeEventListener("click",deny,true);delete document.documentElement.dataset.comandaRole;delete document.documentElement.dataset.comandaPermissions;};
  },[station]);
  return <span data-role-guard="1" style={{display:"none"}}/>;
}
