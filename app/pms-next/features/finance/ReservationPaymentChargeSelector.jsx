"use client"

const money=(value,currency="ARS")=>new Intl.NumberFormat("es-AR",{style:"currency",currency:currency||"ARS",maximumFractionDigits:2}).format(Number(value)||0)
const head={display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,padding:"11px 13px",borderBottom:"1px solid var(--line)",background:"color-mix(in srgb,var(--bg) 28%,var(--panelSolid))"}
const headText={display:"grid",gap:3},headButton={height:31,border:"1px solid color-mix(in srgb,var(--accent) 24%,var(--line))",borderRadius:9,padding:"0 10px",background:"color-mix(in srgb,var(--accent) 5%,var(--panelSolid))",color:"var(--accent)",font:"inherit",fontSize:9.5,fontWeight:900,cursor:"pointer"}
const rowBase={display:"grid",gridTemplateColumns:"24px minmax(0,1fr) auto",gap:9,alignItems:"center",padding:"10px 13px",borderBottom:"1px solid var(--line)",cursor:"pointer",transition:"background .15s,border-color .15s"}
const checkStyle={width:17,height:17,accentColor:"var(--accent)",cursor:"pointer"}
const details={display:"grid",gap:2,minWidth:0},muted={fontSize:9.5,color:"var(--muted)",fontStyle:"normal",lineHeight:1.35}
const foot={display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,padding:"10px 13px",background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))",fontSize:10}

export default function ReservationPaymentChargeSelector({lines=[],selectedIds,onToggle,onToggleAll,selectedTotal=0,currency="ARS"}){
  const unpaid=lines.filter(line=>Number(line.remaining)>.009),allSelected=unpaid.length>0&&unpaid.every(line=>selectedIds?.has(String(line.id)))
  return <section aria-label="Seleccionar cargos a cobrar">
    <header style={head}><div style={headText}><b style={{fontSize:11}}>¿Qué querés cobrar?</b><small style={muted}>Seleccioná alojamiento, extras o cualquier combinación. Los importes son finales e incluyen IVA cuando corresponde.</small></div>{unpaid.length?<button type="button" style={headButton} onClick={onToggleAll}>{allSelected?"Quitar selección":"Seleccionar todo"}</button>:null}</header>
    <div>{lines.map(line=>{const id=String(line.id),settled=Number(line.remaining)<=.009,checked=selectedIds?.has(id)&&!settled;return <label key={id} style={{...rowBase,background:checked?"color-mix(in srgb,var(--accent) 6%,var(--panelSolid))":"transparent",opacity:settled?0.62:1,cursor:settled?"default":"pointer"}}>
      <input type="checkbox" style={checkStyle} checked={checked} disabled={settled} onChange={()=>onToggle?.(id)}/>
      <span style={details}><b style={{fontSize:10.5}}>{line.name}</b><small style={muted}>{line.detail||"Cargo de la estadía"}</small><em style={{...muted,color:settled?"var(--green)":"var(--muted)",fontWeight:750}}>{Number(line.paid)>0?(settled?`Saldado · ${money(line.paid,currency)}`:`Pagado ${money(line.paid,currency)} · pendiente ${money(line.remaining,currency)}`):`Precio final · ${money(line.amount,currency)}`}</em></span>
      <strong style={{fontSize:10.5,whiteSpace:"nowrap",color:settled?"var(--green)":"var(--text)"}}>{settled?"Saldado":money(line.remaining,currency)}</strong>
    </label>})}</div>
    <footer style={foot}><span style={{color:"var(--muted)",fontWeight:750}}>{selectedIds?.size||0} cargo{selectedIds?.size===1?"":"s"} seleccionado{selectedIds?.size===1?"":"s"}</span><b style={{color:"var(--accent)",fontSize:11}}>A cobrar · {money(selectedTotal,currency)}</b></footer>
  </section>
}
