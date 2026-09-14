"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import s from"./websiteAiStudio.module.css"

const QUICK=["Hacelo más elegante","Dale una onda más moderna","Quiero algo más cálido","Ordenalo para vender mejor","Mejorá los textos","Probá una dirección distinta"]
const STATUS={proposed:"Propuesta",applied:"Aplicada",dismissed:"Descartada",reverted:"Deshecha"}

export default function WebsiteAiStudio({engineId,draft,setDraft,websiteDraft,setWebsiteDraft,description,setDescription}){
  const[prompt,setPrompt]=useState(""),[busy,setBusy]=useState(false),[proposal,setProposal]=useState(null),[actionId,setActionId]=useState(""),[history,setHistory]=useState([]),[error,setError]=useState(""),[lastApplied,setLastApplied]=useState(null)
  async function authHeaders(){const{data:{session}}=await supabase.auth.getSession();return{"Content-Type":"application/json",...(session?.access_token?{Authorization:`Bearer ${session.access_token}`}:{})}}
  async function loadHistory(){if(!engineId)return;try{const headers=await authHeaders(),response=await fetch(`/api/pms/website-ai?engine_id=${encodeURIComponent(engineId)}`,{headers,cache:"no-store"}),json=await response.json();if(response.ok)setHistory(json.history||[])}catch{}}
  useEffect(()=>{loadHistory()},[engineId])
  async function ask(value=prompt){const request=String(value||"").trim();if(!request||busy)return;setBusy(true);setError("");setProposal(null);try{const headers=await authHeaders(),response=await fetch("/api/pms/website-ai",{method:"POST",headers,body:JSON.stringify({engine_id:engineId,prompt:request,current:{engine:draft,website:websiteDraft,description}})}),json=await response.json();if(!response.ok)throw new Error(json.error||"No se pudo preparar la propuesta.");setProposal(json.proposal);setActionId(json.action_id);setPrompt(request);await loadHistory()}catch(err){setError(err.message||"No se pudo preparar la propuesta.")}finally{setBusy(false)}}
  async function mark(id,status){try{const headers=await authHeaders();await fetch("/api/pms/website-ai",{method:"PATCH",headers,body:JSON.stringify({id,status})});await loadHistory()}catch{}}
  function apply(){if(!proposal)return;const before={engine:{...draft},website:{...websiteDraft},description};setLastApplied({id:actionId,before});if(proposal.engine&&Object.keys(proposal.engine).length)setDraft(current=>({...current,...proposal.engine}));if(proposal.website&&Object.keys(proposal.website).length)setWebsiteDraft(current=>({...current,...proposal.website}));if(typeof proposal.description==="string")setDescription(proposal.description);mark(actionId,"applied");setProposal(null);setActionId("")}
  function discard(){if(actionId)mark(actionId,"dismissed");setProposal(null);setActionId("")}
  function undo(){if(!lastApplied)return;setDraft(current=>({...current,...lastApplied.before.engine}));setWebsiteDraft(current=>({...current,...lastApplied.before.website}));setDescription(lastApplied.before.description||"");mark(lastApplied.id,"reverted");setLastApplied(null)}
  return <section className={s.aiCard}>
    <header className={s.aiHeader}><div className={s.aiOrb}>✦</div><div><span>OlivIA · DISEÑO WEB</span><h3>Decile cómo querés que se vea</h3><p>Te propone cambios sobre el borrador. Vos los revisás y decidís si aplicarlos; nunca publica sola.</p></div><i className={s.safeLight}><b/>Modo seguro</i></header>
    <div className={s.composer}><textarea rows="3" value={prompt} onChange={event=>setPrompt(event.target.value)} placeholder="Ej.: Quiero una web boutique más cálida, elegante y enfocada en reservas directas."/><button type="button" disabled={busy||!prompt.trim()} onClick={()=>ask()}>{busy?"Pensando…":"Crear propuesta ✦"}</button></div>
    <div className={s.quick}>{QUICK.map(item=><button type="button" key={item} disabled={busy} onClick={()=>{setPrompt(item);ask(item)}}>{item}</button>)}</div>
    {error?<div className={s.error}>{error}</div>:null}
    {proposal?<div className={s.proposal}><div className={s.proposalTitle}><div><span>PROPUESTA LISTA</span><h4>{proposal.summary}</h4></div><i><b/>Sólo borrador</i></div><div className={s.changeList}>{(proposal.changes||[]).map((item,index)=><div key={`${item}-${index}`}><span>{index+1}</span><p>{item}</p></div>)}</div><div className={s.proposalActions}><button type="button" onClick={discard}>Descartar</button><button type="button" className={s.apply} onClick={apply}>Aplicar a la vista previa</button></div></div>:null}
    <div className={s.bottomRow}><div><b>La IA no puede tocar</b><span>Tarifas · inventario · reservas · pagos · dominio · publicación</span></div>{lastApplied?<button type="button" onClick={undo}>↶ Deshacer último cambio IA</button>:null}</div>
    {history.length?<details className={s.history}><summary>Historial de IA <span>{history.length}</span></summary><div>{history.map(item=><article key={item.id}><div><b>{item.prompt}</b><p>{item.summary||"Propuesta de diseño"}</p></div><span data-status={item.status}>{STATUS[item.status]||item.status}</span></article>)}</div></details>:null}
  </section>
}
