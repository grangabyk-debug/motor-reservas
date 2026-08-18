"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import ui from "../styles/comanda-session.module.css";

const ICONS={
 bell:"M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
 help:"M9.5 9a3 3 0 1 1 4.3 2.7c-1.3.7-1.8 1.2-1.8 2.3M12 18h.01",
 support:"M4 13v-2a8 8 0 0 1 16 0v2M4 13h3v6H4zM17 13h3v6h-3zM17 19c0 2-2 3-5 3",
 full:"M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5",
 keyboard:"M3 6h18v12H3zM6 10h1M10 10h1M14 10h1M18 10h1M6 14h1M10 14h1M14 14h1M18 14h1M8 17h8",
 ai:"M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Zm6 12 .8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z",
 user:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21c1-5 4-7 8-7s7 2 8 7",
 chevron:"m8 10 4 4 4-4"
};
function Icon({name,size=18}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name]}/></svg>}

function text(el){return el?.textContent?.replace(/\s+/g," ").trim()||""}
function visible(el){if(!el)return false;const s=getComputedStyle(el);return s.display!=="none"&&s.visibility!=="hidden"&&el.getClientRects().length>0}
function legacyButton(labels){
 const all=[...document.querySelectorAll("button")].filter(b=>!b.closest('[data-session-ui="1"]')&&visible(b));
 for(const label of labels){
   const l=label.toLowerCase();
   const found=all.find(b=>text(b).toLowerCase()===l||String(b.getAttribute("aria-label")||"").toLowerCase().includes(l)||String(b.title||"").toLowerCase().includes(l));
   if(found)return found;
 }
 return null;
}
function clickLegacy(labels){const b=legacyButton(labels);if(b){b.click();return true}return false}

const ROLE_LABEL={principal:"Principal",waiter:"Camarero / Mozo",kitchen:"Cocina",bar:"Bar",printer:"Comandera",support:"Soporte técnico",custom:"Puesto de trabajo"};
const SIDEBAR_BY_ROLE={
 principal:new Set(["Principal","Caja activa","Venta / Salón","Menú","Clientes","Reportes","Configuración"]),
 support:new Set(["Principal","Caja activa","Venta / Salón","Menú","Clientes","Reportes","Configuración"]),
 waiter:new Set(["Venta / Salón"]),
 kitchen:new Set([]),bar:new Set([]),printer:new Set([]),custom:new Set(["Venta / Salón"])
};

export default function ComandaSessionUX(){
 const [workstation,setWorkstation]=useState(null);const [profileOpen,setProfileOpen]=useState(false);const [ready,setReady]=useState(false);
 const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;
 const role=workstation?.kind||"principal";
 const roleName=workstation?.name||ROLE_LABEL[role]||"Principal";
 const allowed=useMemo(()=>SIDEBAR_BY_ROLE[role]||SIDEBAR_BY_ROLE.custom,[role]);

 useEffect(()=>{let alive=true;(async()=>{if(!workstationId){setReady(true);return}const {data}=await supabase.from("comanda_workstations").select("id,name,kind,permissions,is_support").eq("id",workstationId).maybeSingle();if(alive){setWorkstation(data||null);setReady(true)}})();return()=>{alive=false}},[workstationId]);

 useEffect(()=>{
   if(!ready)return;
   const apply=()=>{
     const sidebar=document.querySelector('[class*="sidebar"]');
     if(sidebar){for(const b of sidebar.querySelectorAll("button")){const label=text(b);b.style.display=allowed.has(label)?"":"none"}}
     const topbar=document.querySelector('[class*="topbar"]');
     if(topbar){
       const util=topbar.querySelector('[class*="utility"]');if(util)util.style.visibility="hidden";
       const account=topbar.querySelector('[class*="accountWrap"]');if(account)account.style.visibility="hidden";
       const nav=topbar.querySelector('[class*="topNav"]');if(nav)nav.style.display="none";
     }
     const bottom=document.querySelector('[class*="bottomBar"]');if(bottom)bottom.dataset.sessionRole=role;
   };
   apply();const mo=new MutationObserver(apply);mo.observe(document.body,{subtree:true,childList:true});
   if(role==="waiter")setTimeout(()=>clickLegacy(["Venta"]),120);
   if(role==="kitchen")setTimeout(()=>clickLegacy(["Cocina"]),120);
   if(role==="bar")setTimeout(()=>clickLegacy(["Bar"]),120);
   return()=>mo.disconnect();
 },[ready,role,allowed]);

 async function fullScreen(){try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch{}}
 async function signOut(){await supabase.auth.signOut();location.href="/comanda/login"}
 function openAccount(){setProfileOpen(false);clickLegacy(["Config.","Configuración","Cuenta"]);setTimeout(()=>clickLegacy(["Mi cuenta"]),120)}

 return <div data-session-ui="1">
   {ready&&<div className={ui.utilityRail}>
     <button title="Notificaciones" aria-label="Notificaciones" onClick={()=>clickLegacy(["Notificaciones","notificación"])}><Icon name="bell"/></button>
     <button title="Ayuda" aria-label="Ayuda" onClick={()=>clickLegacy(["Ayuda"])}><Icon name="help"/></button>
     <button title="Soporte humano" aria-label="Soporte humano" onClick={()=>clickLegacy(["Soporte","Ayuda humana"])}><Icon name="support"/></button>
     <button title="Pantalla completa" aria-label="Pantalla completa" onClick={fullScreen}><Icon name="full"/></button>
     <button title="Teclado en pantalla" aria-label="Teclado en pantalla" onClick={()=>clickLegacy(["Teclado","teclado en pantalla"])}><Icon name="keyboard"/></button>
     <button title="Asistente IA" aria-label="Asistente IA" onClick={()=>clickLegacy(["IA","Asistente IA","Inteligencia artificial"])}><Icon name="ai"/></button>
     <div className={ui.profileWrap}>
       <button className={ui.profileButton} onClick={()=>setProfileOpen(v=>!v)}><span className={ui.avatar}><Icon name="user" size={17}/></span><span>Cuenta</span><Icon name="chevron" size={15}/></button>
       {profileOpen&&<div className={ui.profileMenu}><button onClick={openAccount}>Mi cuenta</button><button onClick={()=>{setProfileOpen(false);clickLegacy(["Soporte","Ayuda humana"])}}>Soporte</button><button onClick={signOut}>Cerrar sesión</button></div>}
     </div>
   </div>}
   {ready&&<div className={ui.stationBadge}><span>Puesto</span><strong>{roleName}</strong></div>}
 </div>
}
