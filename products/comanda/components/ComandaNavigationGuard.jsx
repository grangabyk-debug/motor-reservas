"use client";

import {useEffect} from "react";

const DIRECT={"Principal":"Venta","Caja activa":"Caja","Venta / Salón":"Venta","Menú":"Menú","Clientes":"Clientes","Reportes":"Reportes"};
const ADMIN={"Usuarios":"Usuarios","Funcionarios":"Funcionarios","Cajas":"Cajas","Puestos":"Puestos","Cocinas":"Cocinas","Impresión":"Impresoras","Configuración":"Config.","Mi cuenta":"Mi cuenta"};

function textOf(button){return button?.textContent?.replace(/\s+/g," ").trim()||""}
function isSidebar(button){return !!button?.closest?.('[class*="sidebar"]')}
function isVisualMenu(button){return !!button?.closest?.('[data-comanda-visual-menu="1"]')}

function candidates(label){
  return [...document.querySelectorAll("button")].filter(button=>
    !isSidebar(button)&&!isVisualMenu(button)&&textOf(button)===label
  );
}

function findLegacy(label){
  const all=candidates(label);
  return all.find(b=>b.closest('[class*="topbar"]'))||
    all.find(b=>b.closest('[class*="workspace"]'))||all[0]||null;
}

function trigger(label){
  const target=findLegacy(label);
  if(!target)return false;
  target.click();
  return true;
}

function openAdmin(target){
  const config=findLegacy("Config.")||findLegacy("Configuración")||findLegacy("Cuenta");
  if(!config)return false;
  config.click();
  if(target==="Config.")return true;
  window.setTimeout(()=>{
    const next=findLegacy(target);
    if(next)next.click();
  },160);
  return true;
}

function setSidebarActive(label){
  for(const button of document.querySelectorAll('[class*="sidebar"] button')){
    button.dataset.comandaSide="1";
    button.dataset.comandaActive=textOf(button)===label?"1":"0";
  }
}

export default function ComandaNavigationGuard(){
  useEffect(()=>{
    const style=document.createElement("style");
    style.dataset.comandaNavigation="1";
    style.textContent=`
      [class*="topbar"] [class*="topNav"]{display:none!important}
      [data-comanda-side="1"]{background:transparent!important;color:#392b23!important;box-shadow:none!important;transform:none!important}
      [data-comanda-side="1"][data-comanda-active="1"]{background:linear-gradient(135deg,#ff7a00,#ef5a17)!important;color:#fff!important;box-shadow:0 9px 24px rgba(249,115,22,.20)!important}
      [data-comanda-side="1"]:hover{background:#fff3e6!important;color:#c64d08!important}
      [data-comanda-side="1"][data-comanda-active="1"]:hover{color:#fff!important}
    `;
    document.head.appendChild(style);

    const normalize=()=>{
      for(const button of document.querySelectorAll('[class*="sidebar"] button'))button.dataset.comandaSide="1";
      for(const account of document.querySelectorAll('[class*="topbar"] [class*="accountButton"]')){
        if(textOf(account)!=="Cuenta")account.textContent="Cuenta";
      }
    };

    const capture=(event)=>{
      const button=event.target?.closest?.("button");
      if(!button||!isSidebar(button))return;
      const label=textOf(button);
      const target=DIRECT[label]||ADMIN[label];
      if(!target)return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      setSidebarActive(label);

      let ok=false;
      if(DIRECT[label])ok=trigger(DIRECT[label]);
      else ok=openAdmin(ADMIN[label]);

      if(!ok){
        window.setTimeout(()=>{
          if(DIRECT[label])trigger(DIRECT[label]); else openAdmin(ADMIN[label]);
        },80);
      }
    };

    normalize();
    setSidebarActive("Venta / Salón");
    document.addEventListener("click",capture,true);
    const observer=new MutationObserver(normalize);
    observer.observe(document.body,{subtree:true,childList:true});
    return()=>{
      observer.disconnect();
      document.removeEventListener("click",capture,true);
      style.remove();
    };
  },[]);
  return null;
}
