"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../../lib/supabase";
import ui from "../styles/comanda-polish.module.css";

const ICONS = {
  principal:"M4 11 12 4l8 7v9H4v-9Zm5 9v-6h6v6",
  cash:"M4 7h16v12H4zM4 11h16M7 15h4",
  sale:"M4 20V8h16v12M7 8V5h10v3M8 12h8M8 16h5",
  menu:"M5 4v16M9 4v7a4 4 0 0 1-4 4M16 4v16M20 4v8h-4",
  clients:"M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 2a3 3 0 1 0 0-6M2 21c0-5 3-8 6-8s6 3 6 8M14 14c4 0 7 2 8 6",
  reports:"M5 20v-7M10 20V8M15 20V4M20 20v-10",
  users:"M7 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10 0a3 3 0 1 0 0-6M2 20c0-5 2-8 5-8s5 3 5 8M13 20c0-4 2-7 5-7 2 0 4 2 4 7",
  staff:"M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21c0-5 3-8 8-8s8 3 8 8M18 5l2-2 2 2-2 2",
  stations:"M5 4h6v6H5zM13 14h6v6h-6zM13 4h6v6h-6zM5 14h6v6H5z",
  kitchen:"M5 10c0-3 2-5 5-5 1-3 6-3 7 0 3 0 5 2 5 5 0 2-1 4-3 5H8c-2-1-3-3-3-5Zm3 5v6m8-6v6",
  printer:"M6 9V3h12v6M6 18H4V9h16v9h-2M7 14h10v7H7z",
  settings:"M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5 1 2 3 1 2-1 2 2-1 2 1 3 2 1v3l-2 1-1 3 1 2-2 2-2-1-3 1-1 2H9l-1-2-3-1-2 1-2-2 1-2-1-3-2-1v-3l2-1 1-3-1-2 2-2 2 1 3-1 1-2h3Z",
  account:"M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1-5 4-7 8-7s7 2 8 7",
  tables:"M4 8h16M7 8v10M17 8v10M3 18h18M8 4h8",
  close:"M6 6l12 12M18 6 6 18",
  edit:"M4 20h4L19 9l-4-4L4 16v4Zm9-13 4 4",
  plus:"M12 5v14M5 12h14"
};

function Icon({name,size=21}){
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]||ICONS.principal}/></svg>;
}

const MAIN_NAV=[
  ["principal","Principal","Venta"],
  ["cash","Caja activa","Caja activa"],
  ["sale","Venta / Salón","Venta"],
  ["menu","Menú","Menú"],
  ["clients","Clientes","Clientes"],
  ["reports","Reportes","Reportes"],
];
const ADMIN_NAV=[
  ["users","Usuarios","Usuarios"],
  ["staff","Funcionarios","Funcionarios"],
  ["cash","Cajas","Cajas"],
  ["stations","Puestos","Puestos"],
  ["kitchen","Cocinas","Cocinas"],
  ["printer","Impresión","Impresoras"],
  ["settings","Configuración","Config."],
  ["account","Mi cuenta","Mi cuenta"],
];

function byText(text){
  return [...document.querySelectorAll("button")].find(b=>b.textContent?.trim()===text);
}
function openMain(text){ byText(text)?.click(); }
function openSettings(text){
  const config=byText("Config.");
  if(config) config.click();
  setTimeout(()=>byText(text)?.click(),80);
}

function Modal({title,children,onClose,onSave,saveLabel="Guardar cambios",wide=false}){
  return <div className={ui.modalOverlay} onMouseDown={e=>e.target===e.currentTarget&&onClose()}>
    <section className={`${ui.modal} ${wide?ui.modalWide:""}`} role="dialog" aria-modal="true" aria-label={title}>
      <header className={ui.modalHeader}><h2>{title}</h2><button className={ui.iconButton} onClick={onClose} aria-label="Cerrar"><Icon name="close"/></button></header>
      <div className={ui.modalBody}>{children}</div>
      <footer className={ui.modalFooter}><button className={ui.secondaryButton} onClick={onClose}>Cancelar</button><button className={ui.primaryButton} onClick={onSave}>{saveLabel}</button></footer>
    </section>
  </div>
}

function Field({label,children,span=false}){ return <label className={`${ui.field} ${span?ui.span2:""}`}><span>{label}</span>{children}</label> }

function useDashboardPresence(rootRef){
  const [visible,setVisible]=useState(false);
  const [editor,setEditor]=useState(false);
  useEffect(()=>{
    const update=()=>{
      const root=rootRef.current;
      if(!root)return;
      setVisible(!!root.querySelector('[class*="topbar"]'));
      setEditor([...root.querySelectorAll("button")].some(b=>b.textContent?.trim()==="Salir del editor"));
    };
    update();
    const observer=new MutationObserver(update);
    if(rootRef.current) observer.observe(rootRef.current,{subtree:true,childList:true,characterData:true});
    return()=>observer.disconnect();
  },[rootRef]);
  return {visible,editor};
}

export default function ComandaDashboardChrome({children}){
  const rootRef=useRef(null);
  const bypass=useRef(false);
  const {visible,editor}=useDashboardPresence(rootRef);
  const [dialog,setDialog]=useState(null);
  const [sector,setSector]=useState(null);
  const [tables,setTables]=useState([]);
  const [cellSize,setCellSize]=useState(96);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState("");

  const branchId=typeof window!=="undefined"?sessionStorage.getItem("comanda_branch"):null;
  const workstationId=typeof window!=="undefined"?sessionStorage.getItem("comanda_workstation"):null;
  const workSessionId=typeof window!=="undefined"?sessionStorage.getItem("comanda_work_session"):null;

  const activeSectorName=()=>rootRef.current?.querySelector('[class*="sectorTabs"] button[class*="active"]')?.textContent?.trim()||null;

  async function loadActiveSector(){
    if(!branchId)return null;
    const name=activeSectorName();
    let q=supabase.from("comanda_sectors").select("*").eq("branch_id",branchId).eq("active",true);
    if(name) q=q.eq("name",name);
    const {data}=await q.order("sort_order").limit(1).maybeSingle();
    if(!data)return null;
    const {data:rows}=await supabase.from("comanda_tables").select("*").eq("sector_id",data.id).eq("active",true).order("number");
    setSector(data); setTables(rows||[]); setCellSize(Math.max(76,Number(data.cell_size||96)));
    return data;
  }

  useEffect(()=>{ if(editor) loadActiveSector(); },[editor,branchId]);

  useEffect(()=>{
    if(!editor||!sector)return;
    const canvas=rootRef.current?.querySelector('[class*="salonCanvas"]');
    if(canvas){
      canvas.style.height=`${Math.max(600,Number(sector.grid_rows||8)*cellSize+28)}px`;
      canvas.style.minWidth=`${Math.max(760,Number(sector.grid_cols||12)*cellSize+28)}px`;
      canvas.style.backgroundSize=`${cellSize}px ${cellSize}px`;
    }
    for(const row of tables){
      const el=[...rootRef.current?.querySelectorAll('[class*="floorTable"]')||[]].find(x=>{
        const txt=x.textContent||"";
        return txt.includes(row.table_type==="room"?`Hab. ${row.room_number||row.number}`:`Mesa ${row.number}`);
      });
      if(!el)continue;
      el.style.left=`${Number(row.pos_x||0)*cellSize+10}px`;
      el.style.top=`${Number(row.pos_y||0)*cellSize+10}px`;
      el.style.width=`${Math.max(78,Number(row.width||1)*cellSize-18)}px`;
      el.style.height=`${Math.max(78,Number(row.height||1)*cellSize-18)}px`;
    }
  },[cellSize,editor,sector,tables]);

  async function resolveTable(el){
    if(!branchId)return null;
    const txt=el.textContent||"";
    const room=txt.match(/Hab\.\s*([^\s]+)/i)?.[1];
    const number=txt.match(/Mesa\s*([^\s]+)/i)?.[1];
    let q=supabase.from("comanda_tables").select("*").eq("branch_id",branchId).eq("active",true);
    const s=await loadActiveSector(); if(s)q=q.eq("sector_id",s.id);
    if(room) q=q.eq("room_number",room); else if(number)q=q.eq("number",number);
    return (await q.limit(1).maybeSingle()).data;
  }

  async function openTableDialog(table){
    const {data:staff}=await supabase.from("comanda_staff").select("*").eq("branch_id",branchId).eq("active",true).order("name");
    setDialog({type:"openTable",table,staff:staff||[],diners:Number(table.seats||4),waiterId:(staff||[]).find(x=>["waiter","admin","manager"].includes(x.staff_type))?.id||"",label:""});
  }

  async function saveOpenTable(){
    const d=dialog;if(!d?.table||!d.diners||!d.waiterId)return;
    setSaving(true);
    try{
      const {data:{user}}=await supabase.auth.getUser();
      const {data:account}=await supabase.from("comanda_accounts").select("id").limit(1).single();
      const {data:registers}=await supabase.from("comanda_cash_registers").select("id").eq("branch_id",branchId).eq("active",true);
      let cashSession=null;
      if(registers?.length){ const ids=registers.map(x=>x.id); cashSession=(await supabase.from("comanda_cash_sessions").select("id").in("register_id",ids).eq("status","open").order("opened_at",{ascending:false}).limit(1).maybeSingle()).data; }
      const payload={account_id:account.id,branch_id:branchId,table_id:d.table.id,waiter_id:d.waiterId,opened_by:user.id,diners:Number(d.diners),label:d.label?.trim()||null,sale_type:d.table.table_type==="room"?"room_service":"restaurant",room_number:d.table.room_number||null,workstation_id:workstationId||null,work_session_id:workSessionId||null,cash_session_id:cashSession?.id||null};
      const {error}=await supabase.from("comanda_orders").insert(payload); if(error)throw error;
      const label=d.table.table_type==="room"?`Hab. ${d.table.room_number||d.table.number}`:`Mesa ${d.table.number}`;
      setDialog(null);setNotice("Mesa abierta correctamente");
      setTimeout(()=>{
        const target=[...rootRef.current?.querySelectorAll('[class*="floorTable"]')||[]].find(x=>(x.textContent||"").includes(label));
        if(target){bypass.current=true;target.click();}
      },800);
    }catch(e){setNotice(e.message||"No se pudo abrir la mesa")}finally{setSaving(false)}
  }

  function tableDefaults(table){return {number:table?.number||String((tables?.length||0)+1),seats:Number(table?.seats||4),shape:table?.shape||"square",width:Number(table?.width||1),height:Number(table?.height||1),table_type:table?.table_type||"table",room_number:table?.room_number||"",pos_x:Number(table?.pos_x||0),pos_y:Number(table?.pos_y||0)}}
  async function editTable(table=null){ if(!sector)await loadActiveSector(); setDialog({type:"table",table,data:tableDefaults(table)}); }
  async function saveTable(){
    const d=dialog;if(!d?.data||!sector)return;setSaving(true);
    try{
      const {data:account}=await supabase.from("comanda_accounts").select("id").limit(1).single();
      const v=d.data;const candidate={x:Number(v.pos_x),y:Number(v.pos_y),w:Number(v.width),h:Number(v.height)};
      const overlaps=tables.filter(x=>x.id!==d.table?.id).some(x=>candidate.x<Number(x.pos_x)+Number(x.width)&&candidate.x+candidate.w>Number(x.pos_x)&&candidate.y<Number(x.pos_y)+Number(x.height)&&candidate.y+candidate.h>Number(x.pos_y));
      if(overlaps)throw new Error("Esa posición se superpone con otra mesa.");
      const payload={account_id:account.id,branch_id:branchId,sector_id:sector.id,number:String(v.number),seats:Number(v.seats),shape:v.shape,width:Number(v.width),height:Number(v.height),table_type:v.table_type,room_number:v.table_type==="room"?v.room_number||null:null,pos_x:Number(v.pos_x),pos_y:Number(v.pos_y),active:true};
      const q=d.table?.id?supabase.from("comanda_tables").update(payload).eq("id",d.table.id):supabase.from("comanda_tables").insert(payload);
      const {error}=await q;if(error)throw error;setDialog(null);setNotice("Mesa guardada");setTimeout(()=>location.reload(),350);
    }catch(e){setNotice(e.message||"No se pudo guardar la mesa")}finally{setSaving(false)}
  }

  async function editSector(item=null){
    const current=item||sector||await loadActiveSector();
    setDialog({type:"sector",sector:current,data:{name:current?.name||"Nuevo sector",sector_type:current?.sector_type||"salon",grid_cols:Number(current?.grid_cols||14),grid_rows:Number(current?.grid_rows||9),cell_size:Number(current?.cell_size||96)}});
  }
  async function saveSector(){
    const d=dialog;if(!d?.data)return;setSaving(true);
    try{
      const {data:account}=await supabase.from("comanda_accounts").select("id").limit(1).single();
      const payload={account_id:account.id,branch_id:branchId,...d.data,cell_size:Number(d.data.cell_size),grid_cols:Number(d.data.grid_cols),grid_rows:Number(d.data.grid_rows),active:true};
      const q=d.sector?.id?supabase.from("comanda_sectors").update(payload).eq("id",d.sector.id):supabase.from("comanda_sectors").insert(payload);
      const {error}=await q;if(error)throw error;setDialog(null);setNotice("Sector guardado");setTimeout(()=>location.reload(),350);
    }catch(e){setNotice(e.message||"No se pudo guardar el sector")}finally{setSaving(false)}
  }
  async function saveCellSize(){ if(!sector)return;setSaving(true);const {error}=await supabase.from("comanda_sectors").update({cell_size:Number(cellSize)}).eq("id",sector.id);setSaving(false);setNotice(error?error.message:"Tamaño del salón guardado");if(!error)setSector({...sector,cell_size:Number(cellSize)}); }

  async function handleCapture(e){
    if(bypass.current){bypass.current=false;return;}
    const button=e.target.closest?.("button");if(!button)return;
    const text=button.textContent?.trim()||"";
    if(button.className?.toString().includes("floorTable")){
      const isOpen=button.className.toString().includes("busy")||button.className.toString().includes("ready");
      if(!editor&&isOpen)return;
      e.preventDefault();e.stopPropagation();
      const table=await resolveTable(button);if(!table)return;
      editor?editTable(table):openTableDialog(table);return;
    }
    if(editor&&text==="Editar sector"){e.preventDefault();e.stopPropagation();editSector();return;}
    if(editor&&text==="Nuevo sector"){e.preventDefault();e.stopPropagation();editSector(null);return;}
    if(editor&&text==="Nueva mesa"){e.preventDefault();e.stopPropagation();editTable(null);return;}
    if(editor&&text==="Tamaño de celdas"){e.preventDefault();e.stopPropagation();return;}
  }

  const nav=(item)=>{
    const [icon,label,target]=item;
    return <button key={label} className={ui.sideButton} onClick={()=>ADMIN_NAV.includes(item)?openSettings(target):openMain(target)}><Icon name={icon}/><span>{label}</span></button>
  };

  return <div ref={rootRef} className={`${ui.chrome} ${visible?ui.chromeActive:""}`} onClickCapture={handleCapture}>
    {visible&&<aside className={ui.sidebar}>
      <div className={ui.brand}><span className={ui.brandLines}>COMANDA <b>LLENA</b></span><span className={ui.brandGlyph}>C</span></div>
      <nav className={ui.sideNav}>{MAIN_NAV.map(nav)}<div className={ui.sideDivider}/>{ADMIN_NAV.map(nav)}</nav>
      <div className={ui.version}><strong>Comanda Llena</strong><span>Operación gastronómica</span></div>
    </aside>}
    <div className={ui.content}>{children}</div>

    {visible&&editor&&sector&&<aside className={ui.editorPanel}>
      <div className={ui.editorTitle}><div><span>EDITOR</span><h3>Editor de salón</h3></div><span className={ui.editorBadge}>Diseño</span></div>
      <div className={ui.editorSection}>
        <div className={ui.rangeHead}><strong>Tamaño de celdas</strong><span>{cellSize}px</span></div>
        <input className={ui.range} type="range" min="76" max="132" step="2" value={cellSize} onChange={e=>setCellSize(Number(e.target.value))}/>
        <div className={ui.rangeLabels}><span>Compacto</span><span>Grande</span></div>
      </div>
      <div className={ui.editorSection}>
        <div className={ui.counterRow}><span>Columnas</span><strong>{sector.grid_cols}</strong></div>
        <div className={ui.counterRow}><span>Filas</span><strong>{sector.grid_rows}</strong></div>
        <div className={ui.counterRow}><span>Mesas</span><strong>{tables.length}</strong></div>
      </div>
      <div className={ui.editorSection}><h4>Acciones rápidas</h4><div className={ui.quickGrid}><button onClick={()=>editTable(null)}><Icon name="plus"/>Agregar mesa</button><button onClick={()=>editSector(null)}><Icon name="plus"/>Agregar sector</button><button onClick={()=>editSector(sector)}><Icon name="edit"/>Editar sector</button></div></div>
      <button className={ui.saveSalon} disabled={saving} onClick={saveCellSize}>{saving?"Guardando…":"Guardar cambios en salón"}</button>
    </aside>}

    {dialog?.type==="openTable"&&<Modal title={`${dialog.table.table_type==="room"?"Habitación":"Mesa"} ${dialog.table.room_number||dialog.table.number}`} onClose={()=>setDialog(null)} onSave={saveOpenTable} saveLabel={saving?"Abriendo…":"Abrir mesa"}>
      <div className={ui.formGrid}><Field label="Cantidad de comensales"><input className={ui.input} type="number" min="1" max="99" value={dialog.diners} onChange={e=>setDialog({...dialog,diners:e.target.value})}/></Field><Field label="Mozo / camarero"><select className={ui.input} value={dialog.waiterId} onChange={e=>setDialog({...dialog,waiterId:e.target.value})}><option value="">Seleccionar responsable</option>{dialog.staff.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></Field><Field label="Etiqueta o descripción (opcional)" span><input className={ui.input} value={dialog.label} onChange={e=>setDialog({...dialog,label:e.target.value})} placeholder="Ej. Cumpleaños, ventana, reserva…"/></Field></div>
    </Modal>}

    {dialog?.type==="table"&&<Modal title={dialog.table?`Editar mesa ${dialog.table.number}`:"Nueva mesa"} onClose={()=>setDialog(null)} onSave={saveTable} saveLabel={saving?"Guardando…":"Guardar mesa"}>
      <div className={ui.formGrid}><Field label="Número / nombre"><input className={ui.input} value={dialog.data.number} onChange={e=>setDialog({...dialog,data:{...dialog.data,number:e.target.value}})}/></Field><Field label="Comensales"><input className={ui.input} type="number" min="1" value={dialog.data.seats} onChange={e=>setDialog({...dialog,data:{...dialog.data,seats:e.target.value}})}/></Field><Field label="Forma"><select className={ui.input} value={dialog.data.shape} onChange={e=>setDialog({...dialog,data:{...dialog.data,shape:e.target.value}})}><option value="square">Cuadrada</option><option value="round">Redonda</option><option value="rect">Rectangular</option></select></Field><Field label="Tipo"><select className={ui.input} value={dialog.data.table_type} onChange={e=>setDialog({...dialog,data:{...dialog.data,table_type:e.target.value}})}><option value="table">Mesa</option><option value="room">Room service</option><option value="counter">Mostrador</option></select></Field>{dialog.data.table_type==="room"&&<Field label="Habitación" span><input className={ui.input} value={dialog.data.room_number} onChange={e=>setDialog({...dialog,data:{...dialog.data,room_number:e.target.value}})}/></Field>}<Field label="Ancho (celdas)"><input className={ui.input} type="number" min="1" max="4" value={dialog.data.width} onChange={e=>setDialog({...dialog,data:{...dialog.data,width:e.target.value}})}/></Field><Field label="Alto (celdas)"><input className={ui.input} type="number" min="1" max="4" value={dialog.data.height} onChange={e=>setDialog({...dialog,data:{...dialog.data,height:e.target.value}})}/></Field></div>
    </Modal>}

    {dialog?.type==="sector"&&<Modal title={dialog.sector?"Editar sector":"Nuevo sector"} onClose={()=>setDialog(null)} onSave={saveSector} saveLabel={saving?"Guardando…":"Guardar cambios"}>
      <div className={ui.formGrid}><Field label="Nombre del sector" span><input className={ui.input} value={dialog.data.name} onChange={e=>setDialog({...dialog,data:{...dialog.data,name:e.target.value}})}/></Field><Field label="Tipo"><select className={ui.input} value={dialog.data.sector_type} onChange={e=>setDialog({...dialog,data:{...dialog.data,sector_type:e.target.value}})}><option value="salon">Salón</option><option value="patio">Patio</option><option value="room_service">Room Service</option><option value="sidewalk">Vereda</option><option value="bar">Bar</option><option value="custom">Personalizado</option></select></Field><Field label="Tamaño de celda"><div className={ui.rangeField}><input className={ui.range} type="range" min="76" max="132" step="2" value={dialog.data.cell_size} onChange={e=>setDialog({...dialog,data:{...dialog.data,cell_size:Number(e.target.value)}})}/><strong>{dialog.data.cell_size}px</strong></div></Field><Field label="Columnas"><input className={ui.input} type="number" min="6" max="40" value={dialog.data.grid_cols} onChange={e=>setDialog({...dialog,data:{...dialog.data,grid_cols:e.target.value}})}/></Field><Field label="Filas"><input className={ui.input} type="number" min="4" max="30" value={dialog.data.grid_rows} onChange={e=>setDialog({...dialog,data:{...dialog.data,grid_rows:e.target.value}})}/></Field></div><p className={ui.hint}>El tamaño se escala de forma proporcional: al mover la barra se modifica ancho y alto de las celdas al mismo tiempo.</p>
    </Modal>}

    {notice&&<div className={ui.notice} onAnimationEnd={()=>setNotice("")}>{notice}</div>}
  </div>;
}
