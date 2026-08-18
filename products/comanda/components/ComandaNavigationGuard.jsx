"use client";

import {useEffect} from "react";

const TOP_LABELS=new Set(["Caja","Venta","Menú","Clientes","Reportes"]);

function isVisible(el){
  if(!el)return false;
  const s=getComputedStyle(el);
  return s.display!=="none"&&s.visibility!=="hidden"&&s.opacity!=="0"&&el.getClientRects().length>0;
}

export function findLegacyButton(root,label){
  const candidates=[...root.querySelectorAll("button")].filter(isVisible);
  return candidates.find(b=>b.dataset?.comandaChrome!=="1"&&b.textContent?.trim()===label)||null;
}

export function clickLegacyButton(root,label){
  const button=findLegacyButton(root,label);
  if(!button)return false;
  button.click();
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
    normalize();
    const observer=new MutationObserver(normalize);
    observer.observe(document.body,{subtree:true,childList:true,characterData:true});
    return()=>observer.disconnect();
  },[]);
  return null;
}
