"use client"

const VOID_STATUSES=new Set(["void","cancelled","cancelada","anulado","anulada"])
const EPS=.009
const positive=value=>Math.max(0,Number(value)||0)
const itemTotal=item=>positive(item?.total)

function documentPhase(doc){
  const status=String(doc?.status||"").trim().toLowerCase()
  if(VOID_STATUSES.has(status)||doc?.document_type!=="invoice")return null
  return status==="draft"?"draft":"issued"
}

function distribute(map,candidates,amount,phase,mode){
  const available=candidates.map(item=>{
    const total=itemTotal(item),current=map.get(item.id)||{issued:0,draft:0,documents:[]}
    return{item,current,remaining:Math.max(0,total-current.issued-current.draft)}
  }).filter(entry=>entry.remaining>EPS)
  if(!available.length||amount<=EPS)return
  const totalRemaining=available.reduce((sum,entry)=>sum+entry.remaining,0)
  if(totalRemaining<=EPS)return
  let left=Math.min(amount,totalRemaining)
  for(let index=0;index<available.length;index++){
    const entry=available[index]
    const share=index===available.length-1?left:Math.min(entry.remaining,amount*(entry.remaining/totalRemaining))
    if(share<=EPS)continue
    const next={...entry.current,[phase]:entry.current[phase]+share,documents:[...entry.current.documents,{phase,mode,amount:share}]}
    map.set(entry.item.id,next)
    left-=share
  }
}

export function buildFolioInvoiceCoverage({items=[],documents=[],folioId}={}){
  const folioItems=items.filter(item=>item?.status==="active"&&item?.folio_id===folioId)
  const map=new Map(folioItems.map(item=>[item.id,{issued:0,draft:0,documents:[]}]))
  for(const item of folioItems){
    if(item?.invoice_document_id){
      const total=itemTotal(item)
      map.set(item.id,{issued:total,draft:0,documents:[{phase:"issued",mode:"direct",amount:total}]})
    }
  }
  const docs=documents.filter(doc=>doc?.folio_id===folioId&&documentPhase(doc))
  const ordered=[...docs].sort((a,b)=>{
    const pa=documentPhase(a)==="issued"?0:1,pb=documentPhase(b)==="issued"?0:1
    if(pa!==pb)return pa-pb
    return new Date(a.created_at||0)-new Date(b.created_at||0)
  })
  for(const doc of ordered){
    const phase=documentPhase(doc)
    if(!phase)continue
    const amount=positive(doc.total)
    if(amount<=EPS)continue
    const ids=Array.isArray(doc.folio_item_ids)?doc.folio_item_ids.filter(Boolean):[]
    const direct=ids.length?folioItems.filter(item=>ids.includes(item.id)):[]
    const candidates=direct.length?direct:doc.billing_mode==="payment"?folioItems:[]
    if(!candidates.length)continue
    distribute(map,candidates,amount,phase,direct.length?"items":"payment")
  }
  return map
}

export function folioItemBillingState(item,coverage){
  const total=itemTotal(item)
  if(total<=EPS)return{key:"pending",label:"Pendiente de facturar",issued:0,draft:0,covered:0,remaining:0}
  const issued=Math.min(total,positive(coverage?.issued))
  const draft=Math.min(Math.max(0,total-issued),positive(coverage?.draft))
  const covered=Math.min(total,issued+draft)
  const remaining=Math.max(0,total-covered)
  if(issued>=total-EPS)return{key:"invoiced",label:"Facturado",issued,draft,covered,remaining}
  if(draft>EPS)return{key:"draft",label:"Factura en borrador",issued,draft,covered,remaining}
  if(issued>EPS)return{key:"partial",label:"Facturación parcial",issued,draft,covered,remaining}
  return{key:"pending",label:"Pendiente de facturar",issued,draft,covered,remaining}
}

export function remainingInvoiceGross(item,coverage){
  const total=itemTotal(item)
  if(total<=EPS)return Number(item?.total)||0
  return Math.max(0,total-positive(coverage?.issued)-positive(coverage?.draft))
}
