"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import s from "../styles/comanda-staff.module.css";

const TYPES=[
  ["waiter","Mozo / Camarero"],["cook","Cocinero"],["cashier","Cajero"],["manager","Encargado"],["supervisor","Supervisor"],["delivery","Repartidor"],["bar","Bar"],["admin","Administrador"],["other","Otro"]
];
const typeLabel=(v)=>TYPES.find(x=>x[0]===v)?.[1]||v||"Sin tipo";

function Modal({title,onClose,onSave,saving,children}){
  return <div className={s.overlay} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className={s.modal} role="dialog" aria-modal="true">
      <header><h2>{title}</h2><button onClick={onClose}>×</button></header>
      <div className={s.modalBody}>{children}</div>
      <footer><button className={s.secondary} onClick={onClose}>Cancelar</button><button className={s.primary} disabled={saving} onClick={onSave}>{saving?"Guardando…":"Guardar cambios"}</button></footer>
    </section>
  </div>
}

export default function ComandaStaffManager(){
  const [open,setOpen]=useState(false),[rows,setRows]=useState([]),[turns,setTurns]=useState([]),[branch,setBranch]=useState(null),[loading,setLoading]=useState(false),[dialog,setDialog]=useState(null),[saving,setSaving]=useState(false),[query,setQuery]=useState("");
  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const access=typeof window!=="undefined"?sessionStorage.getItem("comanda_access_level"):null;
  const canAdmin=["owner","superadmin"].includes(access)||document?.documentElement?.dataset?.comandaRole==="principal";

  async function load(){
    if(!branchId)return;setLoading(true);
    const [{data:staff},{data:turnRows},{data:b}]=await Promise.all([
      supabase.from("comanda_staff").select("id,account_id,branch_id,name,staff_type,active,created_at,user_id,title,turn_id,updated_at").eq("branch_id",branchId).order("name"),
      supabase.from("comanda_turns").select("id,name,start_time,end_time,active").eq("branch_id",branchId).eq("active",true).order("sort_order"),
      supabase.from("comanda_branches").select("id,name,account_id").eq("id",branchId).maybeSingle()
    ]);
    setRows(staff||[]);setTurns(turnRows||[]);setBranch(b||null);setLoading(false);
  }

  useEffect(()=>{
    const onClick=(e)=>{
      const b=e.target?.closest?.("button");if(!b)return;
      const t=b.textContent?.replace(/\s+/g," ").trim();
      if(t==="Funcionarios"){setOpen(true);setTimeout(load,0)}
      if(open&&["Usuarios","Cajas","Puestos","Sectores","Cocinas","Impresoras","Tickets","Notificaciones","Módulos y pagos","Mi cuenta"].includes(t))setOpen(false);
    };
    document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true);
  },[open,branchId]);

  const filtered=useMemo(()=>{const q=query.toLowerCase().trim();return rows.filter(r=>!q||`${r.name} ${typeLabel(r.staff_type)} ${r.title||""}`.toLowerCase().includes(q))},[rows,query]);
  const newStaff=()=>setDialog({mode:"new",data:{name:"",staff_type:"waiter",title:"",turn_id:"",active:true}});
  const edit=(row)=>setDialog({mode:"edit",row,data:{name:row.name||"",staff_type:row.staff_type||"waiter",title:row.title||"",turn_id:row.turn_id||"",active:row.active!==false}});

  async function save(){
    if(!dialog?.data?.name?.trim()||!branch)return;setSaving(true);
    const d=dialog.data;const payload={account_id:branch.account_id,branch_id:branch.id,name:d.name.trim(),staff_type:d.staff_type,title:d.title?.trim()||null,turn_id:d.turn_id||null,active:d.active!==false,updated_at:new Date().toISOString()};
    const q=dialog.mode==="edit"?supabase.from("comanda_staff").update(payload).eq("id",dialog.row.id):supabase.from("comanda_staff").insert(payload);
    const {error}=await q;setSaving(false);if(error){alert(error.message);return}setDialog(null);await load();
  }
  async function remove(row){
    if(!confirm(`¿Desactivar a ${row.name}?`))return;
    await supabase.from("comanda_staff").update({active:false,updated_at:new Date().toISOString()}).eq("id",row.id);await load();
  }

  if(!open||!canAdmin)return null;
  return <main className={s.manager} data-staff-manager="1">
    <header className={s.header}><div><span>CONFIGURACIÓN</span><h1>Funcionarios</h1><p>Empleados reales de {branch?.name||"la sucursal"}. No son cuentas de acceso al sistema.</p></div><div className={s.actions}><button className={s.secondary} onClick={()=>setOpen(false)}>Volver a Configuración</button><button className={s.primary} onClick={newStaff}>Nuevo funcionario</button></div></header>
    <div className={s.toolbar}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por nombre o función…"/><div><strong>{rows.filter(x=>x.active).length}</strong><span> activos</span></div></div>
    <section className={s.card}>{loading?<div className={s.empty}>Cargando funcionarios…</div>:filtered.length?<div className={s.tableWrap}><table><thead><tr><th>Nombre</th><th>Tipo de funcionario</th><th>Turno</th><th>Estado</th><th>Fecha de alta</th><th></th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><strong>{r.name}</strong>{r.title&&<small>{r.title}</small>}</td><td>{typeLabel(r.staff_type)}</td><td>{turns.find(t=>t.id===r.turn_id)?.name||"Sin turno asignado"}</td><td><span className={r.active?s.active:s.inactive}>{r.active?"Activo":"Inactivo"}</span></td><td>{r.created_at?new Date(r.created_at).toLocaleDateString("es-AR"):"-"}</td><td><div className={s.rowActions}><button onClick={()=>edit(r)}>Editar</button><button className={s.danger} onClick={()=>remove(r)}>Eliminar</button></div></td></tr>)}</tbody></table></div>:<div className={s.empty}>No hay funcionarios cargados.</div>}</section>
    {dialog&&<Modal title={dialog.mode==="new"?"Nuevo funcionario":"Editar funcionario"} onClose={()=>setDialog(null)} onSave={save} saving={saving}><div className={s.formGrid}><label><span>Nombre del empleado</span><input value={dialog.data.name} onChange={e=>setDialog(d=>({...d,data:{...d.data,name:e.target.value}}))}/></label><label><span>Tipo de funcionario</span><select value={dialog.data.staff_type} onChange={e=>setDialog(d=>({...d,data:{...d.data,staff_type:e.target.value}}))}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label><span>Cargo / descripción</span><input value={dialog.data.title} onChange={e=>setDialog(d=>({...d,data:{...d.data,title:e.target.value}}))} placeholder="Opcional"/></label><label><span>Turno</span><select value={dialog.data.turn_id} onChange={e=>setDialog(d=>({...d,data:{...d.data,turn_id:e.target.value}}))}><option value="">Sin turno asignado</option>{turns.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className={s.check}><input type="checkbox" checked={dialog.data.active} onChange={e=>setDialog(d=>({...d,data:{...d.data,active:e.target.checked}}))}/><span>Funcionario activo</span></label></div></Modal>}
  </main>;
}
