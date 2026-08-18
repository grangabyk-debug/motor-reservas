"use client";

import {useEffect} from "react";

const TOP_LABELS=new Set(["Caja","Venta","Menú","Clientes","Reportes"]);
const DIRECT={"Caja activa":"Caja","Venta / Salón":"Venta","Menú":"Menú","Clientes":"Clientes","Reportes":"Reportes"};
const ADMIN={"Usuarios":"Usuarios","Funcionarios":"Funcionarios","Cajas":"Cajas","Puestos":"Puestos","Cocinas":"Cocinas","Impresión":"Impresoras","Configuración":"Config.","Mi cuenta":"Mi cuenta"};

function isVisible(el){
  if(!el)return false;
  const s=getComputedStyle(el);
  return s.display!=="none"&&s.visibility!=="hidden"&&s.opacity!=="0"&&el.getClientRects().length>0;
}

function isChromeButton(button){
  return String(button?.className||"").includes("sideButton")||button?.dataset?.comandaChrome==="1";
}

export function findLegacyButton(root,label){
  const candidates=[...root.querySelectorAll("button")].filter(isVisible);
  return candidates.find(b=>!isChromeButton(b)&&b.textContent?.trim()===label)||null;
}

export function clickLegacyButton(root,label){
  const button=findLegacyButton(root,label);
  if(!button)return false;
  button.click();
  return true;
}

function openAdmin(root,target){
  const config=findLegacyButton(root,"Config.")||findLegacyButton(root,"Configuración");
  if(!config)return false;
  config.click();
  if(target==="Config.")return true;
  setTimeout(()=>{
    const next=findLegacyButton(root,target);
    if(next)next.click();
  },120);
  return true;
}

export default function ComandaNavigationGuard(){
  useEffect(()=>{
    const normalize=()=>{
      const topbars=[...document.querySelectorAll('[class*="topbar"]')];
      for(const topbar of topbars){
        const walker=document.createTreeWalker(topbar,NodeFilter.SHOW_TEXT);
        const nodes=[];let node;
        while((node=walker.nextNode()))nodes.push(node);
        for(const textNode of nodes){
          const value=textNode.nodeValue?.trim();
          if(value==="Configuración")textNode.nodeValue=textNode.nodeValue.replace("Configuración","Cuenta");
        }
        for(const button of topbar.querySelectorAll("button")){
          const text=button.textContent?.trim();
          if(TOP_LABELS.has(text))button.dataset.comandaLegacyNav="1";
        }
      }
    };

    const capture=(event)=>{
      const button=event.target?.closest?.("button");
      if(!button||!String(button.className||"").includes("sideButton"))return;
      const label=button.textContent?.trim();
      if(label==="Principal"){
        event.preventDefault();event.stopPropagation();
        clickLegacyButton(document,"Venta");
        return;
      }
      if(DIRECT[label]){
        event.preventDefault();event.stopPropagation();
        clickLegacyButton(document,DIRECT[label]);
        return;
      }
      if(ADMIN[label]){
        event.preventDefault();event.stopPropagation();
        openAdmin(document,ADMIN[label]);
      }
    };

    normalize();
    document.addEventListener("click",capture,true);
    const observer=new MutationObserver(normalize);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return()=>{observer.disconnect();document.removeEventListener("click",capture,true)};
  },[]);
  return null;
}
