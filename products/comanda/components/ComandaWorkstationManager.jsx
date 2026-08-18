"use client";

import {useEffect,useMemo,useState} from "react";
import {supabase} from "../../../lib/supabase";
import w from "../styles/comanda-workstations.module.css";

const TYPES=[
  ["principal","Principal"],["waiter","Camareros Touch"],["cashier","Cajero"],["kitchen","Cocina"],["bar","Bar"],["printer","Comandera"],["support","Soporte técnico"],["custom","Personalizado"]
];
const GROUPS=[
  ["Ventas",[["sale_restaurant","Venta restaurante"],["sale_delivery","Venta delivery"],["sale_counter","Venta mostrador"],["external_platform_sales","Ventas por plataforma externa"],["open_tables","Abrir mesas"],["close_tables","Cerrar mesas"],["void_items","Anular productos"],["void_orders","Anular ventas"],["discounts","Aplicar descuentos"],["special_products","Productos especiales"]]],
  ["Caja",[["cash_open_close","Abrir / cerrar caja"],["cash_movements","Movimientos de caja"],["cash_withdrawals","Retiros"],["cash_audit","Auditoría de caja"],["payments","Cobros y medios de pago"]]],
  ["Clientes",[["customer_read","Consultar clientes"],["customer_edit","Editar clientes"],["customer_incidents","Incidentes de clientes"]]],
  ["Menú y productos",[["product_read","Ver productos"],["product_edit","Editar productos"],["options_edit","Editar opciones"],["combos_edit","Editar combos"],["ingredients_edit","Editar ingredientes"]]],
  ["Cocina y bar",[["kds_view","Ver monitoreo de cocina"],["kds_change_status","Cambiar estado de comandas"],["kitchen","Acceso cocina"],["bar","Acceso bar"]]],
  ["Impresión",[["partial_ticket","Ticket parcial"],["full_ticket","Ticket completo"],["print_queue","Cola de impresión"],["manage_printers","Configurar impresoras"]]],
  ["Reportes",[["reports_sales","Ventas"],["reports_cash","Caja"],["reports_workday","Días de trabajo"],["reports_customers","Clientes"],["reports_kitchen","Cocina"],["reports_stock","Stock"],["reports_staff","Funcionarios"]]],
  ["Administración",[["manage_users","Usuarios"],["manage_staff","Funcionarios"],["manage_cash_registers","Cajas"],["manage_workstations","Puestos"],["manage_sectors","Sectores y mesas"],["manage_kitchens","Cocinas"],["manage_notifications","Notificaciones"],["manage_modules","Módulos"],["suppliers","Proveedores"]]],
  ["Asistencia",[["ai_assistant","Asistente IA"],["human_support","Ayuda humana"]]]
];

const template=(kind)=>{
  const base={human_support:true};
  if(kind==="principal"||kind==="support")for(const [,items] of GROUPS)for(const [k] of items)base[k]=true;
  if(kind==="waiter")Object.assign(base,{sale_restaurant:true,open_tables:true,close_tables:true,void_items:true,void_orders:true,discounts:true,special_products:true,cash_open_close:true,payments:true,product_read:true,partial_ticket:true,full_ticket:true,ai_assistant:true});
  if(kind==="cashier")Object.assign(base,{sale_restaurant:true,payments:true,cash_open_close:true,cash_movements:true,cash_withdrawals:true,cash_audit:true,product_read:true,partial_ticket:true,full_ticket:true});
  if(kind==="kitchen")Object.assign(base,{product_read:true,kds_view:true,kds_change_status:true,kitchen:true});
  if(kind==="bar")Object.assign(base,{product_read:true,kds_view:true,kds_change_status:true,bar:true});
  if(kind==="printer")Object.assign(base,{product_read:true,partial_ticket:true,full_ticket:true,print_queue:true});
  return base;
};

function Modal({title,onClose,onSave,saving,children}){return <div className={w.overlay} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className={w.modal}><header><h2>{title}</h2><button onClick={onClose}>×</button></header><div className={w.body}>{children}</div><footer><button className={w.secondary} onClick={onClose}>Cancelar</button><button className={w.primary} disabled={saving} onClick={onSave}>{saving?"Guardando…":"Guardar cambios"}</button></footer></section></div>}

export default function ComandaWorkstationManager(){
  const [open,setOpen]=useState(false),[rows,setRows]=useState([]),[branch,setBranch]=useState(null),[dialog,setDialog]=useState(null),[saving,setSaving]=useState(false),[query,setQuery]=useState("");
  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const access=typeof window!=="undefined"?sessionStorage.getItem("comanda_access_level"):null;
  const canAdmin=["owner","superadmin"].includes(access)||document?.documentElement?.dataset?.comandaRole==="principal";

  async function load(){if(!branchId)return;const [{data:r},{data:b}]=await Promise.all([supabase.from("comanda_workstations").select("*").eq("branch_id",branchId).order("created_at"),supabase.from("comanda_branches").select("id,name,account_id").eq("id",branchId).maybeSingle()]);setRows(r||[]);setBranch(b||null)}
  useEffect(()=>{const onClick=e=>{const b=e.target?.closest?.("button");if(!b)return;const t=b.textContent?.replace(/\s+/g," ").trim();if(t==="Puestos"){setOpen(true);setTimeout(load,0)}if(open&&["Usuarios","Funcionarios","Cajas","Sectores","Cocinas","Impresoras","Tickets","Notificaciones","Módulos y pagos","Mi cuenta"].includes(t))setOpen(false)};document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true)},[open,branchId]);
  const filtered=useMemo(()=>{const q=query.toLowerCase().trim();return rows.filter(r=>!q||`${r.name} ${r.kind}`.toLowerCase().includes(q))},[rows,query]);
  const edit=(row)=>setDialog({mode:"edit",step:"general",row,data:{name:row.name||"",kind:row.kind||"custom",active:row.active!==false,description:row.permissions?.description||"",permissions:row.permissions||{}}});
  const create=()=>setDialog({mode:"new",step:"general",data:{name:"Nuevo puesto",kind:"custom",active:true,description:"",permissions:template("custom")}});
  const perms=(row)=>setDialog({mode:"edit",step:"permissions",row,data:{name:row.name,kind:row.kind,active:row.active!==false,description:row.permissions?.description||"",permissions:row.permissions||{}}});

  async function save(){if(!dialog||!branch)return;setSaving(true);const d=dialog.data;const permissions={...d.permissions,description:d.description||null};if(d.kind==="principal")permissions.all=true;if(d.kind!=="principal")delete permissions.all;const payload={account_id:branch.account_id,branch_id:branch.id,name:d.name.trim(),kind:d.kind,active:d.active,is_support:d.kind==="support",permissions,updated_at:new Date().toISOString()};const q=dialog.mode==="edit"?supabase.from("comanda_workstations").update(payload).eq("id",dialog.row.id):supabase.from("comanda_workstations").insert(payload);const {error}=await q;setSaving(false);if(error){alert(error.message);return}setDialog(null);await load()}
  async function remove(row){if(row.kind==="principal"){alert("El puesto Principal no se puede eliminar.");return}if(!confirm(`¿Desactivar ${row.name}?`))return;await supabase.from("comanda_workstations").update({active:false,updated_at:new Date().toISOString()}).eq("id",row.id);await load()}

  if(!open||!canAdmin)return null;
  return <main className={w.manager} data-workstation-manager="1"><header className={w.header}><div><span>CONFIGURACIÓN</span><h1>Puestos de trabajo</h1><p>Definí el tipo de terminal y después sus permisos.</p></div><div><button className={w.secondary} onClick={()=>setOpen(false)}>Volver a Configuración</button><button className={w.primary} onClick={create}>Nuevo puesto</button></div></header><div className={w.toolbar}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar puesto…"/><span>{rows.filter(x=>x.active).length} activos</span></div><section className={w.card}><table><thead><tr><th>Nombre</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><strong>{r.name}</strong><small>{r.permissions?.description||"Sin descripción"}</small></td><td>{TYPES.find(x=>x[0]===r.kind)?.[1]||r.kind}</td><td><span className={r.active?w.on:w.off}>{r.active?"Activo":"Inactivo"}</span></td><td><div className={w.rowActions}><button onClick={()=>edit(r)}>Editar</button><button onClick={()=>perms(r)}>Configuración</button><button className={w.danger} onClick={()=>remove(r)}>Eliminar</button></div></td></tr>)}</tbody></table></section>
  {dialog&&<Modal title={dialog.step==="permissions"?`Permisos · ${dialog.data.name}`:dialog.mode==="new"?"Nuevo puesto de trabajo":"Editar puesto de trabajo"} onClose={()=>setDialog(null)} onSave={save} saving={saving}>{dialog.step==="general"?<div className={w.formGrid}><label><span>Nombre</span><input value={dialog.data.name} onChange={e=>setDialog(d=>({...d,data:{...d.data,name:e.target.value}}))}/></label><label><span>Tipo de puesto</span><select value={dialog.data.kind} onChange={e=>{const kind=e.target.value;setDialog(d=>({...d,data:{...d.data,kind,permissions:d.mode==="new"?template(kind):d.data.permissions}}))}}>{TYPES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label className={w.span2}><span>Descripción</span><textarea value={dialog.data.description} onChange={e=>setDialog(d=>({...d,data:{...d.data,description:e.target.value}}))}/></label><label className={w.check}><input type="checkbox" checked={dialog.data.active} onChange={e=>setDialog(d=>({...d,data:{...d.data,active:e.target.checked}}))}/><span>Puesto activo</span></label>{dialog.mode==="edit"&&<button className={w.permissionsLink} onClick={()=>setDialog(d=>({...d,step:"permissions"}))}>Configurar permisos</button>}</div>:<div className={w.permissionGroups}>{GROUPS.map(([group,items])=><section key={group}><h3>{group}</h3><div>{items.map(([key,label])=><label key={key}><span>{label}</span><input type="checkbox" checked={dialog.data.kind==="principal"||!!dialog.data.permissions?.[key]} disabled={dialog.data.kind==="principal"} onChange={e=>setDialog(d=>({...d,data:{...d.data,permissions:{...d.data.permissions,[key]:e.target.checked}}}))}/></label>)}</div></section>)}</div>}</Modal>}
  </main>;
}
