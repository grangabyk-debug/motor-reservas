"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {supabase} from "../../../lib/supabase";
import {COMANDA_INSPECTOR_MANUAL} from "../inspector/manual";
import ui from "../styles/comanda-mobile-inspector.module.css";

const STORAGE_KEY="comanda_inspector_chat_v1";
const welcome={id:"welcome",role:"assistant",text:"Hola. Soy Inspector, la IA que revisa Comanda Llena con el manual operativo del sistema. Podés preguntarme cómo está funcionando, pedirme que inspeccione la configuración actual o contarme un problema como se lo contarías a una persona."};

const quickPrompts=["Inspeccioná Comanda ahora","¿Hay algo importante que deba revisar?","¿Cómo está cocina y el salón?"];

function uid(){return `${Date.now()}-${Math.random().toString(36).slice(2)}`}
function statusLabel(status){return status==="pass"?"Correcto":status==="fail"?"Problema":"Revisar"}

export default function ComandaMobileInspector(){
  const [messages,setMessages]=useState([welcome]);
  const [input,setInput]=useState("");
  const [sending,setSending]=useState(false);
  const [inspecting,setInspecting]=useState(false);
  const [recording,setRecording]=useState(false);
  const [transcribing,setTranscribing]=useState(false);
  const [report,setReport]=useState(null);
  const [notice,setNotice]=useState("");
  const [notifications,setNotifications]=useState(typeof Notification!=="undefined"?Notification.permission:"default");
  const mediaRef=useRef(null),chunksRef=useRef([]),bottomRef=useRef(null);

  useEffect(()=>{
    try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||"null");if(Array.isArray(saved)&&saved.length)setMessages(saved.slice(-50))}catch{}
  },[]);
  useEffect(()=>{
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(messages.slice(-50)))}catch{}
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages,sending,transcribing]);

  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;

  async function token(){
    const {data}=await supabase.auth.getSession();
    return data?.session?.access_token||null;
  }

  async function countTable(table,filters=[]){
    try{
      let q=supabase.from(table).select("id",{count:"exact",head:true});
      for(const [column,value] of filters)if(value)q=q.eq(column,value);
      const {count,error}=await q;
      if(error)return {ok:false,error:error.message};
      return {ok:true,count:Number(count||0)};
    }catch(error){return {ok:false,error:error?.message||"No disponible"}}
  }

  async function collectContext(){
    const [{data:{user}},{data:workstation},{data:branch}]=await Promise.all([
      supabase.auth.getUser(),
      workstationId?supabase.from("comanda_workstations").select("id,name,kind,active").eq("id",workstationId).maybeSingle():Promise.resolve({data:null}),
      branchId?supabase.from("comanda_branches").select("id,name,active").eq("id",branchId).maybeSingle():Promise.resolve({data:null})
    ]);
    return {authenticated:!!user,branch:branch?{name:branch.name,active:branch.active}:null,workstation:workstation?{name:workstation.name,kind:workstation.kind,active:workstation.active}:null,viewport:{width:window.innerWidth,height:window.innerHeight},online:navigator.onLine};
  }

  async function runInspection(){
    if(inspecting)return;
    setInspecting(true);setReport(null);setNotice("");
    const checks=[];
    try{
      const [{data:{user}},appResponse]=await Promise.all([
        supabase.auth.getUser(),
        fetch("/comanda/app",{method:"GET",cache:"no-store",credentials:"same-origin"}).catch(()=>null)
      ]);
      checks.push({id:"auth",label:"Sesión autenticada",status:user?"pass":"fail",detail:user?"La sesión está activa.":"No hay una sesión válida."});
      checks.push({id:"route",label:"Aplicación principal",status:appResponse?.ok?"pass":"fail",detail:appResponse?.ok?"La ruta principal responde.":"La aplicación principal no respondió correctamente."});
      checks.push({id:"branch",label:"Sucursal seleccionada",status:branchId?"pass":"warn",detail:branchId?"Hay una sucursal activa para esta sesión.":"Todavía no hay sucursal seleccionada."});
      checks.push({id:"workstation",label:"Puesto seleccionado",status:workstationId?"pass":"warn",detail:workstationId?"Hay un puesto activo para esta sesión.":"Todavía no hay puesto seleccionado."});

      const specs=[
        ["comanda_sectors","Sectores",branchId?[["branch_id",branchId]]:[]],
        ["comanda_tables","Mesas",branchId?[["branch_id",branchId]]:[]],
        ["comanda_categories","Categorías",branchId?[["branch_id",branchId]]:[]],
        ["comanda_products","Productos",branchId?[["branch_id",branchId]]:[]],
        ["comanda_kitchens","Cocinas",branchId?[["branch_id",branchId]]:[]],
        ["comanda_cash_registers","Cajas",branchId?[["branch_id",branchId]]:[]],
        ["comanda_printers","Impresoras",branchId?[["branch_id",branchId]]:[]]
      ];
      const results=await Promise.all(specs.map(async ([table,label,filters])=>({table,label,result:await countTable(table,filters)})));
      for(const item of results){
        if(!item.result.ok)checks.push({id:item.table,label:item.label,status:"warn",detail:"No pude verificar este módulo con la lectura automática."});
        else checks.push({id:item.table,label:item.label,status:item.result.count>0?"pass":"warn",detail:item.result.count>0?`${item.result.count} registros disponibles.`:"No encontré configuración activa para este módulo."});
      }

      const failed=checks.filter(x=>x.status==="fail").length,warnings=checks.filter(x=>x.status==="warn").length,passed=checks.filter(x=>x.status==="pass").length;
      const score=Math.round((passed/Math.max(1,checks.length))*100);
      const next={at:new Date().toISOString(),score,failed,warnings,passed,checks};
      setReport(next);
      const access=await token();
      let summary=`Inspección terminada: ${passed} controles correctos, ${warnings} para revisar y ${failed} problemas.`;
      if(access){
        const response=await fetch("/api/comanda/inspector",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({action:"inspection",report:next,context:await collectContext(),manual:COMANDA_INSPECTOR_MANUAL})});
        const data=await response.json().catch(()=>({}));
        if(response.ok&&data.answer)summary=data.answer;
      }
      setMessages(prev=>[...prev,{id:uid(),role:"assistant",text:summary,kind:"inspection"}]);
      if(typeof Notification!=="undefined"&&Notification.permission==="granted")new Notification("Inspector · Comanda Llena",{body:failed?`Encontré ${failed} problema${failed===1?"":"s"} y ${warnings} punto${warnings===1?"":"s"} para revisar.`:`Inspección terminada: ${warnings?`${warnings} punto${warnings===1?"":"s"} para revisar.`:"sin problemas detectados en los controles disponibles."}`});
    }catch(error){
      setMessages(prev=>[...prev,{id:uid(),role:"assistant",text:"No pude completar toda la inspección. No voy a marcar el sistema como aprobado hasta poder verificar los controles que faltaron."}]);
      setNotice(error?.message||"No se pudo completar la inspección.");
    }finally{setInspecting(false)}
  }

  async function send(text=input){
    const question=String(text||"").trim();if(!question||sending)return;
    if(question.toLowerCase().includes("inspeccion")&&question.toLowerCase().includes("ahora")){setInput("");await runInspection();return}
    const userMessage={id:uid(),role:"user",text:question};
    setMessages(prev=>[...prev,userMessage]);setInput("");setSending(true);setNotice("");
    try{
      const access=await token();if(!access)throw new Error("Tu sesión venció. Volvé a ingresar.");
      const response=await fetch("/api/comanda/inspector",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`},body:JSON.stringify({action:"chat",question,context:await collectContext(),report,history:messages.slice(-10).map(m=>({role:m.role,text:m.text})),manual:COMANDA_INSPECTOR_MANUAL})});
      const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"No pude consultar al Inspector.");
      setMessages(prev=>[...prev,{id:uid(),role:"assistant",text:data.answer||"No pude generar una respuesta."}]);
    }catch(error){setMessages(prev=>[...prev,{id:uid(),role:"assistant",text:error?.message||"No pude responder en este momento."}])}finally{setSending(false)}
  }

  async function enableNotifications(){
    if(typeof Notification==="undefined"){setNotice("Este navegador no permite notificaciones web.");return}
    const permission=await Notification.requestPermission();setNotifications(permission);
    if(permission==="granted")setNotice("Notificaciones activadas en este dispositivo.");
  }

  async function toggleRecording(){
    if(recording){mediaRef.current?.stop();return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const recorder=new MediaRecorder(stream);chunksRef.current=[];mediaRef.current=recorder;
      recorder.ondataavailable=e=>{if(e.data?.size)chunksRef.current.push(e.data)};
      recorder.onstop=async()=>{
        setRecording(false);stream.getTracks().forEach(t=>t.stop());
        const blob=new Blob(chunksRef.current,{type:recorder.mimeType||"audio/webm"});
        if(!blob.size)return;setTranscribing(true);
        try{
          const access=await token();if(!access)throw new Error("Tu sesión venció.");
          const form=new FormData();form.append("file",blob,"mensaje.webm");
          const response=await fetch("/api/comanda/voice",{method:"POST",headers:{Authorization:`Bearer ${access}`},body:form});
          const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||"No pude transcribir el audio.");
          setInput(data.text||"");
        }catch(error){setNotice(error?.message||"No pude procesar el audio.")}finally{setTranscribing(false)}
      };
      recorder.start();setRecording(true);setNotice("");
    }catch{setNotice("Necesito permiso del micrófono para grabar audio.")}
  }

  function clearChat(){setMessages([welcome]);setReport(null);try{localStorage.removeItem(STORAGE_KEY)}catch{}}

  const headline=useMemo(()=>report?`${report.score}% verificado`:(inspecting?"Inspeccionando…":"Inspector disponible"),[report,inspecting]);

  return <main className={ui.page}>
    <div className={ui.ambient}/>
    <header className={ui.header}>
      <div><span className={ui.kicker}>COMANDA LLENA</span><h1>Inspector</h1><p>{headline}</p></div>
      <button className={ui.smallButton} onClick={enableNotifications}>{notifications==="granted"?"Avisos activos":"Activar avisos"}</button>
    </header>

    {report&&<section className={ui.reportStrip}>
      <div><strong>{report.score}%</strong><span>controles verificados</span></div>
      <div><strong>{report.passed}</strong><span>correctos</span></div>
      <div><strong>{report.warnings}</strong><span>revisar</span></div>
      <div><strong>{report.failed}</strong><span>problemas</span></div>
    </section>}

    <section className={ui.chat} aria-label="Chat con Inspector">
      <div className={ui.messages}>
        {messages.map(message=><div key={message.id} className={message.role==="user"?ui.userRow:ui.assistantRow}><div className={message.role==="user"?ui.userBubble:ui.assistantBubble}>{message.text}</div></div>)}
        {(sending||transcribing)&&<div className={ui.assistantRow}><div className={`${ui.assistantBubble} ${ui.typing}`}>{transcribing?"Estoy pasando tu audio a texto…":"Estoy revisando…"}</div></div>}
        {report&&<details className={ui.details}><summary>Ver controles de la última inspección</summary><div className={ui.checks}>{report.checks.map(check=><div key={check.id} className={ui.check}><span className={`${ui.dot} ${ui[check.status]}`}/><div><strong>{check.label}</strong><p>{check.detail}</p></div><small>{statusLabel(check.status)}</small></div>)}</div></details>}
        <div ref={bottomRef}/>
      </div>
    </section>

    {!messages.some(m=>m.role==="user")&&<div className={ui.quick}>{quickPrompts.map(text=><button key={text} onClick={()=>send(text)}>{text}</button>)}</div>}

    {notice&&<div className={ui.notice}>{notice}</div>}

    <footer className={ui.composer}>
      <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Hablale al Inspector…" rows={1}/>
      <div className={ui.actions}>
        <button className={`${ui.actionButton} ${recording?ui.recording:""}`} onClick={toggleRecording} disabled={transcribing}>{recording?"Detener":"Hablar"}</button>
        <button className={ui.actionButton} onClick={runInspection} disabled={inspecting}>{inspecting?"Revisando…":"Inspeccionar"}</button>
        <button className={ui.sendButton} onClick={()=>send()} disabled={!input.trim()||sending}>Enviar</button>
      </div>
      <button className={ui.clear} onClick={clearChat}>Nueva conversación</button>
    </footer>
  </main>;
}
