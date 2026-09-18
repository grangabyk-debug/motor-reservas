"use client"

import{useEffect,useMemo,useState}from"react"
import s from"./receptionReports.module.css"

const defaultColumns=source=>(source?.columns||[]).filter(column=>column.defaultVisible!==false).map(column=>column.key)

export default function ReceptionCustomReportBuilder({sources,customReports,onCreate,onDelete,onClose}){
  const[sourceKey,setSourceKey]=useState(sources[0]?.key||""),[name,setName]=useState(""),[selected,setSelected]=useState([])
  const source=useMemo(()=>sources.find(item=>item.key===sourceKey)||sources[0],[sources,sourceKey])
  useEffect(()=>{setSelected(defaultColumns(source))},[source?.key])
  function toggle(key){setSelected(current=>current.includes(key)?current.filter(value=>value!==key):[...current,key])}
  function submit(event){event.preventDefault();const title=name.trim();if(!title||!source||!selected.length)return;onCreate({name:title,baseKey:source.key,columnKeys:selected});setName("");setSelected(defaultColumns(source))}
  return <div className={s.builderPanel}>
    <div className={s.builderHead}><div><small>MIS INFORMES</small><h2>Crear informe personalizado</h2><p>Elegí una base del PMS y las columnas que querés ver. Después vas a poder reordenarlas, filtrarlas, imprimirlas y exportarlas igual que cualquier informe.</p></div><button type="button" onClick={onClose}>×</button></div>
    <form className={s.builderForm} onSubmit={submit}>
      <label><span>Nombre del informe</span><input value={name} onChange={event=>setName(event.target.value)} placeholder="Ej. Llegadas administración"/></label>
      <label><span>Base de datos</span><select value={sourceKey} onChange={event=>setSourceKey(event.target.value)}>{sources.map(item=><option value={item.key} key={item.key}>{item.title}</option>)}</select></label>
      <div className={s.builderColumns}><strong>Columnas iniciales</strong><div>{(source?.columns||[]).map(column=><label key={column.key}><input type="checkbox" checked={selected.includes(column.key)} onChange={()=>toggle(column.key)}/><span>{column.label}</span></label>)}</div></div>
      <div className={s.builderActions}><button type="button" onClick={onClose}>Cancelar</button><button type="submit" className={s.builderPrimary} disabled={!name.trim()||!selected.length}>Crear informe</button></div>
    </form>
    {customReports.length?<div className={s.customList}><strong>Informes personalizados</strong>{customReports.map(report=><div key={report.key}><span><b>{report.name}</b><small>Basado en {report.baseTitle}</small></span><button type="button" onClick={()=>onDelete(report.key)}>Eliminar</button></div>)}</div>:null}
  </div>
}
