"use client";

import {useEffect,useState} from "react";
import {supabase} from "../../../lib/supabase";

const MATRIX={
  principal:{sections:new Set(["Principal","Caja","Venta","Menú","Clientes","Reportes","Config.","Configuración"]),admin:true,salonEdit:true,cashMode:"full",sale:true,kds:false,print:true},
  support:{sections:new Set(["Principal","Caja","Venta","Menú","Clientes","Reportes","Config.","Configuración"]),admin:true,salonEdit:true,cashMode:"full",sale:true,kds:false,print:true},
  waiter:{sections:new Set(["Venta"]),admin:false,salonEdit:false,cashMode:"open_close",sale:true,kds:false,print:true},
  kitchen:{sections:new Set(["Cocina"]),admin:false,salonEdit:false,cashMode:"none",sale:false,kds:true,print:false},
  bar:{sections:new Set(["Bar"]),admin:false,salonEdit:false,cashMode:"none",sale:false,kds:true,print:false},
  printer:{sections:new Set(["Impresoras","Impresión"]),admin:false,salonEdit:false,cashMode:"none",sale:false,kds:false,print:true},
  custom:{sections:new Set(["Venta"]),admin:false,salonEdit:false,cashMode:"none",sale:true,kds:false,print:false}
};

const ADMIN_LABELS=new Set(["Usuarios","Funcionarios","Cajas","Puestos","Sectores","Cocinas","Impresoras","Impresión","Tickets","Notificaciones","Módulos y pagos","Mi cuenta","Comercio","Sucursales"]);
const SALON_EDIT_LABELS=new Set(["Diagramar salón","Mantenimiento de sectores","Editar sector","Nuevo sector","Agregar sector","Configuración del salón"]);
const FULL_CASH_LABELS=new Set(["Movimiento de caja","Movimientos","Retiro","Retiros","Ticket de control","Enviar control por mail","Pagos","Propinas"]);

function txt(el){return el?.textContent?.replace(/\s+/g," ").trim()||""}
function visible(el){if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden"}
function clickLegacy(labels){
  const all=[...document.querySelectorAll("button")].filter(b=>visible(b)&&!b.closest('[data-role-guard="1"]'));
  for(const l of labels){const b=all.find(x=>txt(x)===l);if(b){b.click();return true}}
  return false;
}

export default function ComandaRoleGuard(){
  const [role,setRole]=useState(null);
  useEffect(()=>{
    let alive=true;
    (async()=>{
      const id=sessionStorage.getItem("comanda_workstation");
      if(!id){if(alive)setRole("principal");return}
      const {data}=await supabase.from("comanda_workstations").select("kind,permissions,is_support").eq("id",id).maybeSingle();
      if(alive)setRole(data?.is_support?"support":data?.kind||"custom");
    })();
    return()=>{alive=false};
  },[]);

  useEffect(()=>{
    if(!role)return;
    const cfg=MATRIX[role]||MATRIX.custom;
    document.documentElement.dataset.comandaRole=role;
    document.documentElement.dataset.comandaSalonEdit=cfg.salonEdit?"1":"0";
    document.documentElement.dataset.comandaCashMode=cfg.cashMode;

    const apply=()=>{
      // Hide administrative controls from operational workstations.
      for(const b of document.querySelectorAll("button")){
        const label=txt(b);
        if(!cfg.admin&&ADMIN_LABELS.has(label)&&!b.closest('[data-session-ui="1"]')) b.style.display="none";
        if(!cfg.salonEdit&&SALON_EDIT_LABELS.has(label)) b.style.display="none";
        if(cfg.cashMode!=="full"&&FULL_CASH_LABELS.has(label)) b.style.display="none";
      }
      // Hide obvious admin panels/links in configuration if a stale view is still mounted.
      if(!cfg.admin){
        for(const el of document.querySelectorAll("a,[role=button]")){
          if(ADMIN_LABELS.has(txt(el)))el.style.display="none";
        }
      }
    };

    const deny=(e)=>{
      const el=e.target?.closest?.("button,a,[role=button]");if(!el)return;
      const label=txt(el);
      const forbidden=(!cfg.admin&&ADMIN_LABELS.has(label))||(!cfg.salonEdit&&SALON_EDIT_LABELS.has(label))||(cfg.cashMode!=="full"&&FULL_CASH_LABELS.has(label));
      if(!forbidden)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();
    };

    apply();
    const mo=new MutationObserver(apply);mo.observe(document.body,{subtree:true,childList:true});
    document.addEventListener("click",deny,true);

    // Force operational workstations into their allowed surface even if a stale admin view was left open.
    const t=setTimeout(()=>{
      if(role==="waiter"||role==="custom")clickLegacy(["Venta"]);
      else if(role==="kitchen")clickLegacy(["Cocina"]);
      else if(role==="bar")clickLegacy(["Bar"]);
    },180);

    return()=>{clearTimeout(t);mo.disconnect();document.removeEventListener("click",deny,true);delete document.documentElement.dataset.comandaRole;};
  },[role]);

  return <span data-role-guard="1" style={{display:"none"}}/>;
}
