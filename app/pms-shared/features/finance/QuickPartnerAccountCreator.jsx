"use client"

import{useState}from"react"
import{supabase}from"../../../../lib/supabase"

const empty=()=>({kind:"company",name:"",tax_id:"",contact_name:"",email:"",phone:"",credit_limit:"0",billing_terms:"30 días",negotiated_rate_label:"",notes:""})

export default function QuickPartnerAccountCreator({propertyId,onClose,onCreated}){
  const[draft,setDraft]=useState(empty),[saving,setSaving]=useState(false),[error,setError]=useState("")
  const set=(key,value)=>setDraft(current=>({...current,[key]:value}))
  async function save(){
    if(saving||!draft.name.trim())return
    setSaving(true);setError("")
    try{
      const payload={
        property_id:propertyId,
        kind:draft.kind||"company",
        name:draft.name.trim(),
        tax_id:draft.tax_id.trim()||null,
        contact_name:draft.contact_name.trim()||null,
        email:draft.email.trim()||null,
        phone:draft.phone.trim()||null,
        commission_percent:0,
        credit_limit:Math.max(0,Number(draft.credit_limit)||0),
        billing_terms:draft.billing_terms.trim()||null,
        negotiated_rate_label:draft.negotiated_rate_label.trim()||null,
        notes:draft.notes.trim()||null,
        active:true,
        updated_at:new Date().toISOString()
      }
      const{data,error:insertError}=await supabase.from("hotel_partners").insert(payload).select("id,kind,name,tax_id,contact_name,email,phone,credit_limit,billing_terms,negotiated_rate_label,active").single()
      if(insertError)throw insertError
      onCreated?.(data)
    }catch(err){setError(err?.message||"No se pudo crear la cuenta corriente.")}
    finally{setSaving(false)}
  }
  const field={display:"grid",gap:4,fontSize:10,fontWeight:850,color:"var(--muted)"}
  const control={height:38,border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"var(--panelSolid)",color:"var(--text)",font:"inherit",fontSize:11,fontWeight:750}
  return <div role="dialog" aria-modal="true" aria-label="Nueva cuenta corriente" style={{position:"fixed",inset:0,zIndex:380,display:"grid",placeItems:"center",padding:18,background:"rgba(8,14,28,.36)",backdropFilter:"blur(8px)"}} onClick={onClose}>
    <div style={{width:"min(720px,calc(100vw - 28px))",maxHeight:"90vh",overflow:"auto",padding:18,border:"1px solid color-mix(in srgb,#fff 32%,var(--line))",borderRadius:20,background:"var(--panelSolid)",boxShadow:"0 28px 80px rgba(0,0,0,.28)"}} onClick={event=>event.stopPropagation()}>
      <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><small style={{fontWeight:900,color:"var(--accent)"}}>CUENTA CORRIENTE</small><h2 style={{margin:"4px 0 0"}}>Nueva empresa o agencia</h2><p style={{margin:"6px 0 0",fontSize:10.5,color:"var(--muted)"}}>Se crea en Empresas y cuentas y queda seleccionada para este cobro.</p></div><button type="button" onClick={onClose} style={{width:36,height:36,border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",fontWeight:900}}>×</button></div>
      {error?<div style={{marginTop:12,padding:"9px 10px",border:"1px solid color-mix(in srgb,var(--red) 28%,var(--line))",borderRadius:10,color:"var(--red)",fontSize:10,fontWeight:800}}>{error}</div>:null}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginTop:14}}>
        <label style={field}>Tipo<select style={control} value={draft.kind} onChange={e=>set("kind",e.target.value)}><option value="company">Empresa</option><option value="agency">Agencia</option><option value="wholesaler">Mayorista</option><option value="corporate">Corporativa</option></select></label>
        <label style={field}>Razón social / nombre<input style={control} autoFocus value={draft.name} onChange={e=>set("name",e.target.value)}/></label>
        <label style={field}>CUIT / identificación fiscal<input style={control} value={draft.tax_id} onChange={e=>set("tax_id",e.target.value)}/></label>
        <label style={field}>Contacto<input style={control} value={draft.contact_name} onChange={e=>set("contact_name",e.target.value)}/></label>
        <label style={field}>Email<input style={control} type="email" value={draft.email} onChange={e=>set("email",e.target.value)}/></label>
        <label style={field}>Teléfono<input style={control} value={draft.phone} onChange={e=>set("phone",e.target.value)}/></label>
        <label style={field}>Límite de crédito<input style={control} type="number" min="0" step="0.01" value={draft.credit_limit} onChange={e=>set("credit_limit",e.target.value)}/></label>
        <label style={field}>Condición de pago<input style={control} placeholder="Ej. 30 días" value={draft.billing_terms} onChange={e=>set("billing_terms",e.target.value)}/></label>
        <label style={{...field,gridColumn:"1 / -1"}}>Tarifa negociada<input style={control} placeholder="Ej. Corporativa 2026" value={draft.negotiated_rate_label} onChange={e=>set("negotiated_rate_label",e.target.value)}/></label>
        <label style={{...field,gridColumn:"1 / -1"}}>Notas<textarea rows="3" style={{...control,height:"auto",padding:"9px 10px",resize:"vertical"}} value={draft.notes} onChange={e=>set("notes",e.target.value)}/></label>
      </div>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14,paddingTop:12,borderTop:"1px solid var(--line)"}}><button type="button" onClick={onClose} disabled={saving} style={{height:38,padding:"0 13px",border:"1px solid var(--line)",borderRadius:10,background:"var(--panelSolid)",fontWeight:850}}>Cancelar</button><button type="button" onClick={save} disabled={saving||!draft.name.trim()} style={{height:38,padding:"0 14px",border:0,borderRadius:10,background:"linear-gradient(145deg,var(--accent),var(--accent2))",color:"#fff",fontWeight:900}}>{saving?"Creando…":"Crear cuenta corriente"}</button></div>
    </div>
    <style>{`@media(max-width:620px){[aria-label="Nueva cuenta corriente"]>div>div:nth-of-type(2){grid-template-columns:1fr!important}}`}</style>
  </div>
}
