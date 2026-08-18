"use client";

import {useEffect,useRef,useState} from "react";
import ComandaVisualMenu from "./ComandaVisualMenu";
import ui from "../styles/comanda-polish.module.css";
import v from "../styles/comanda-menu-visual.module.css";

function findMenuWorkspace(root){
  const heading=[...root.querySelectorAll("h1,h2,h3")].find(el=>el.textContent?.trim()==="Menú");
  return heading?.closest('[class*="workspace"]')||heading?.parentElement?.parentElement||null;
}

function productsTabActive(workspace){
  if(!workspace)return false;
  const buttons=[...workspace.querySelectorAll("button")];
  const product=buttons.find(b=>b.textContent?.trim()==="Productos");
  if(!product)return true;
  const cls=String(product.className||"");
  return cls.includes("active")||product.getAttribute("aria-selected")==="true";
}

export default function ComandaMenuLayer({children}){
  const rootRef=useRef(null);
  const [active,setActive]=useState(false);
  const [branchId,setBranchId]=useState(null);
  const [notice,setNotice]=useState("");

  useEffect(()=>{
    setBranchId(sessionStorage.getItem("comanda_branch"));
    const root=rootRef.current;if(!root)return;
    const update=()=>{
      const workspace=findMenuWorkspace(root);
      setActive(!!workspace&&productsTabActive(workspace));
    };
    update();
    const observer=new MutationObserver(update);
    observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:["class","aria-selected"]});
    return()=>observer.disconnect();
  },[]);

  return <div ref={rootRef} className={v.menuLayer}>
    {children}
    {active&&branchId&&<div className={v.overlay}><ComandaVisualMenu rootRef={rootRef} branchId={branchId} onNotice={setNotice}/></div>}
    {notice&&<div className={ui.notice} onAnimationEnd={()=>setNotice("")}>{notice}</div>}
  </div>;
}
