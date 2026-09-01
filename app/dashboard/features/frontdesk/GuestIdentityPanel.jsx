"use client"

import modal from"./reservation-modal.module.css"
import ws from"./reservation-workspace.module.css"

const DOC_TYPES=["DNI","Pasaporte","CUIL","Cédula","Otro"]

const documentValue=p=>p?.documento??p?.dni??p?.document_number??""
const documentType=p=>p?.tipo_documento??p?.document_type??""
const birthDate=p=>p?.fecha_nacimiento??p?.birth_date??""
const nationality=p=>p?.nacionalidad??p?.nationality??""
const relationship=p=>p?.relacion??p?.relationship??""

export function holderOptions(draft){
  return[
    {value:"primary",label:draft?.guest?`Titular · ${draft.guest}`:"Huésped titular"},
    ...(draft?.companions||[]).map((p,index)=>({value:`companion:${index}`,label:`Acompañante ${index+1}${p?.nombre?` · ${p.nombre}`:""}`})),
    {value:"reservation",label:"Documento general de la reserva"},
    {value:"company",label:"Empresa / agencia"},
  ]
}

export function holderPatch(value,draft){
  if(value==="primary")return{holderRole:"primary",holderName:draft?.guest||null,passengerIndex:null}
  if(value==="company")return{holderRole:"company",holderName:null,passengerIndex:null}
  if(String(value).startsWith("companion:")){
    const passengerIndex=Number(String(value).split(":")[1]),person=(draft?.companions||[])[passengerIndex]
    return{holderRole:"companion",holderName:person?.nombre||null,passengerIndex}
  }
  return{holderRole:"reservation",holderName:null,passengerIndex:null}
}

export default function GuestIdentityPanel({draft,set,addCompanion,updateCompanion,removeCompanion}){
  return <section className={modal.panel}>
    <div className={modal.subhead}><div><h3>Huésped e identidad</h3><p className={ws.identityHint}>La ficha queda reutilizable para futuras estadías y Web Check-in.</p></div></div>
    <div className={modal.grid}>
      <label className={modal.wide}><span>Nombre y apellido</span><input autoFocus value={draft.guest||""} onChange={e=>set("guest",e.target.value)}/></label>
      <label className={modal.wide}><span>Email</span><input type="email" value={draft.email||""} onChange={e=>set("email",e.target.value)}/></label>
      <label><span>Teléfono</span><input value={draft.phone||""} onChange={e=>set("phone",e.target.value)}/></label>
      <label><span>Tipo documento</span><select value={draft.documentType||""} onChange={e=>set("documentType",e.target.value)}><option value="">Elegir…</option>{DOC_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
      <label><span>Número documento</span><input value={draft.document||""} onChange={e=>set("document",e.target.value)}/></label>
      <label><span>Fecha de nacimiento</span><input type="date" value={draft.birthDate||""} onChange={e=>set("birthDate",e.target.value)}/></label>
      <label><span>Nacionalidad</span><input value={draft.nationality||""} onChange={e=>set("nationality",e.target.value)}/></label>
      <label><span>Idioma</span><input value={draft.language||""} onChange={e=>set("language",e.target.value)}/></label>
      <label><span>País</span><input value={draft.country||""} onChange={e=>set("country",e.target.value)}/></label>
      <label><span>Provincia</span><input value={draft.province||""} onChange={e=>set("province",e.target.value)}/></label>
      <label><span>Ciudad</span><input value={draft.city||""} onChange={e=>set("city",e.target.value)}/></label>
      <label className={modal.full}><span>Dirección</span><input value={draft.address||""} onChange={e=>set("address",e.target.value)}/></label>
    </div>

    <div className={modal.subhead}><div><h4>Acompañantes</h4><p className={ws.identityHint}>Cada pasajero puede tener documento, nacimiento, nacionalidad y relación con el titular.</p></div><button className={modal.miniButton} type="button" onClick={addCompanion}>＋ Agregar pasajero</button></div>
    <div className={ws.companionStack}>{(draft.companions||[]).map((p,index)=><article className={ws.companionCard} key={index}>
      <div className={ws.companionHead}><b>Pasajero {index+1}</b><button type="button" onClick={()=>removeCompanion(index)}>Quitar</button></div>
      <div className={modal.grid}>
        <label className={modal.wide}><span>Nombre y apellido</span><input value={p.nombre||p.name||""} onChange={e=>updateCompanion(index,"nombre",e.target.value)}/></label>
        <label><span>Tipo documento</span><select value={documentType(p)} onChange={e=>updateCompanion(index,"tipo_documento",e.target.value)}><option value="">Elegir…</option>{DOC_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
        <label><span>Número documento</span><input value={documentValue(p)} onChange={e=>updateCompanion(index,"documento",e.target.value)}/></label>
        <label><span>Fecha de nacimiento</span><input type="date" value={birthDate(p)} onChange={e=>updateCompanion(index,"fecha_nacimiento",e.target.value)}/></label>
        <label><span>Nacionalidad</span><input value={nationality(p)} onChange={e=>updateCompanion(index,"nacionalidad",e.target.value)}/></label>
        <label><span>Relación</span><input value={relationship(p)} onChange={e=>updateCompanion(index,"relacion",e.target.value)} placeholder="Pareja, hijo/a, colega…"/></label>
        <label><span>Menor</span><select value={p.es_menor?"yes":"no"} onChange={e=>updateCompanion(index,"es_menor",e.target.value==="yes")}><option value="no">No</option><option value="yes">Sí</option></select></label>
      </div>
    </article>)}{!(draft.companions||[]).length&&<div className={modal.message}>Sin acompañantes cargados.</div>}</div>
  </section>
}
