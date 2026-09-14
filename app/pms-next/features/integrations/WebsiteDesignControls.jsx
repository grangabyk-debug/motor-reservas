"use client"

import v from"./websiteDesignControls.module.css"
import{templates}from"./BookingEngineStudioBits"

const byId=id=>templates.find(item=>item.id===id)||templates[0]

export function DesignActions({draft,engine,saving,onSaveDraft,onPublish,onPreview,siteUrl,draftSavedAt}){
  const selected=byId(draft?.template),published=byId(engine?.template),changed=selected.id!==published.id||draft?.primary_color!==engine?.primary_color||draft?.accent_color!==engine?.accent_color||draft?.booking_message!==engine?.booking_message
  return <section className={v.actions} style={{"--design-primary":selected.primary,"--design-accent":selected.accent}}>
    <div className={v.selection}>
      <span className={changed?v.pendingDot:v.liveDot}/>
      <div><small>{changed?"CAMBIOS DE DISEÑO SIN PUBLICAR":"DISEÑO PUBLICADO"}</small><b>{selected.name}</b><p>{selected.help} · {selected.font}</p></div>
      <div className={v.palette} title="Paleta base de la plantilla"><i style={{background:selected.primary}}/><i style={{background:selected.accent}}/></div>
    </div>
    <div className={v.actionCopy}><b>{changed?(draftSavedAt?"Borrador guardado. Falta aplicarlo al sitio.":"La vista previa ya cambió, pero el sitio público todavía no."):"Este es el diseño que actualmente ve el huésped."}</b><span>“Ver sitio publicado” siempre abre la última versión aplicada. Usá la vista previa completa para revisar el borrador actual.</span>{changed?<em>Publicado ahora: {published.name}</em>:null}</div>
    <div className={v.buttons}>
      <button type="button" onClick={onPreview}>Vista previa completa</button>
      <button type="button" disabled={saving} onClick={onSaveDraft}>{saving?"Guardando…":"Guardar borrador"}</button>
      <button type="button" className={v.apply} disabled={saving} onClick={onPublish}>{saving?"Aplicando…":"Aplicar al sitio"}</button>
      {siteUrl?<a href={siteUrl} target="_blank" rel="noreferrer">Ver sitio publicado ↗</a>:null}
    </div>
  </section>
}

export function FullPreviewShell({template,onClose,children}){const selected=byId(template);return <div className={v.overlay} role="dialog" aria-modal="true" aria-label="Vista previa completa del sitio" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={v.dialog}><header><div><small>VISTA PREVIA DEL BORRADOR</small><b>{selected.name}</b><span>Esto todavía no modifica la web pública.</span></div><button type="button" onClick={onClose} aria-label="Cerrar vista previa">×</button></header><div className={v.previewBody}>{children}</div></div></div>}
