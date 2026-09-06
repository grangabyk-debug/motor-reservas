"use client"

import{useEffect,useState}from"react"
import s from"./channelManager.module.css"

const DEFAULT_SYNC={availability:true,rates:true,restrictions:true,reservations:true}

export default function ChannelConnectDrawer({otas,connection,initialProvider,roomTypes,saving,onClose,onSave}){
  const existingProvider=connection?.provider||initialProvider||otas[0]?.name||""
  const[form,setForm]=useState({provider:existingProvider,account_ref:connection?.account_ref||"",external_property_id:connection?.external_property_id||"",rate_adjustment:Number(connection?.diagnostics?.rate_adjustment||0),sync:{...DEFAULT_SYNC,...(connection?.diagnostics?.sync||{})},mappings:{}})
  useEffect(()=>{const next={};for(const type of roomTypes){const found=type.mapping;next[type.id]=found?.external_id||""}setForm(value=>({...value,mappings:next}))},[roomTypes])
  const patch=values=>setForm(current=>({...current,...values}))
  const providerLocked=Boolean(connection)
  return <div className={s.backdrop} onMouseDown={e=>e.target===e.currentTarget&&onClose()}><aside className={s.drawer} onMouseDown={e=>e.stopPropagation()}>
    <header className={s.drawerHead}><div><small>CHANNEL MANAGER</small><h2>{connection?`Configurar ${connection.provider}`:"Agregar un canal"}</h2><p>Prepará la conexión, mapeá categorías y definí qué debe sincronizarse. Las credenciales nunca se guardan en campos visibles.</p></div><button className={s.close} onClick={onClose} aria-label="Cerrar">×</button></header>
    <div className={s.drawerBody}>
      <Section title="1 · Canal" subtitle="Elegí la OTA que querés preparar."><div className={s.providerGrid}>{otas.map(ota=><button type="button" key={ota.id} className={s.provider} data-selected={form.provider===ota.name} disabled={providerLocked&&form.provider!==ota.name} onClick={()=>!providerLocked&&patch({provider:ota.name})}><i>{ota.mark}</i><b>{ota.name}</b></button>)}</div></Section>
      <Section title="2 · Identificación" subtitle="Datos no secretos que permiten reconocer la propiedad del otro lado."><div className={s.formGrid}><Field label="ID de propiedad en el canal"><input value={form.external_property_id} onChange={e=>patch({external_property_id:e.target.value})} placeholder="Ej. hotel-12345"/></Field><Field label="Referencia de cuenta"><input value={form.account_ref} onChange={e=>patch({account_ref:e.target.value})} placeholder="Ej. cuenta comercial / partner ID"/></Field><Field label="Ajuste sobre tarifa base (%)"><input type="number" min="-90" max="500" step="0.5" value={form.rate_adjustment} onChange={e=>patch({rate_adjustment:e.target.value})}/></Field><Field label="Entorno"><select value="sandbox" disabled><option value="sandbox">Configuración / prueba</option></select></Field></div><div className={s.security}><span>✓</span><div><b>Credenciales aisladas</b><small>Usuario, contraseña, tokens o claves del canal deben entrar por el conector seguro del proveedor. Esta pantalla sólo guarda referencias y reglas operativas.</small></div></div></Section>
      <Section title="3 · Sincronización" subtitle="Definí qué información podrá viajar cuando el conector quede autorizado."><div className={s.syncGrid}>{[["availability","Disponibilidad","Cupos y cierres de venta"],["rates","Tarifas","Precios por fecha"],["restrictions","Restricciones","Mínima estadía y cierres"],["reservations","Reservas","Altas y cambios del canal"]].map(([key,title,text])=><div className={s.syncItem} key={key}><div><b>{title}</b><small>{text}</small></div><Switch checked={form.sync[key]} onChange={()=>patch({sync:{...form.sync,[key]:!form.sync[key]}})}/></div>)}</div></Section>
      <Section title="4 · Mapeo de categorías" subtitle="Relacioná cada tipo de Habitación Llena con el código o ID que usa la OTA.">{roomTypes.length?roomTypes.map(type=><div className={s.mapping} key={type.id}><div><b>{type.name}</b><small>{type.code||"Sin código interno"} · {type.capacity||1} pers.</small></div><input value={form.mappings[type.id]||""} onChange={e=>patch({mappings:{...form.mappings,[type.id]:e.target.value}})} placeholder={`Código ${form.provider}`}/></div>):<div className={s.empty}>Primero configurá al menos un tipo de habitación.</div>}</Section>
    </div>
    <footer className={s.drawerFooter}><span>Queda en “En configuración” hasta autorizar el conector real.</span><div><button onClick={onClose}>Cancelar</button><button className={s.primary} disabled={saving||!form.provider} onClick={()=>onSave(form)}>{saving?"Guardando…":"Guardar configuración"}</button></div></footer>
  </aside></div>
}

function Section({title,subtitle,children}){return <section className={s.section}><header><h3>{title}</h3><p>{subtitle}</p></header>{children}</section>}
function Field({label,children}){return <label className={s.field}><span>{label}</span>{children}</label>}
function Switch({checked,onChange}){return <button type="button" role="switch" aria-checked={checked} className={s.switch} data-on={checked} onClick={onChange}><i/></button>}
