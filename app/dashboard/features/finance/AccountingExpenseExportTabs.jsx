"use client"

import{money}from"../../core/formatters"
import s from"./accounting-premium.module.css"

function Empty({title,text}){return <div className={s.empty}><b>{title}</b><span>{text}</span></div>}

export function ExpensesTab({expenses,accounts,bounds,canManage,onNew,onEdit,onVoid}){const rows=expenses.filter(x=>String(x.occurred_on)>=bounds.start&&String(x.occurred_on)<=bounds.end);return <section><div className={s.sectionTitle}><div><small>GASTOS Y PROVEEDORES</small><h3>El margen necesita también el lado de los costos</h3></div>{canManage&&<button type="button" className={s.primary} onClick={onNew}>＋ Gasto</button>}</div><div className={s.tableWrap}><table><thead><tr><th>Fecha</th><th>Proveedor</th><th>Concepto</th><th>Categoría / cuenta</th><th>IVA</th><th>Total</th><th>Medio</th><th/></tr></thead><tbody>{rows.map(e=>{const account=accounts.find(a=>a.id===e.account_id);return <tr key={e.id} data-void={e.status==="void"}><td>{e.occurred_on}</td><td><b>{e.supplier_name||"Sin proveedor"}</b><small>{e.supplier_tax_id||e.document_number||""}</small></td><td>{e.concept}</td><td>{e.category}<small>{account?`${account.code} · ${account.name}`:"Cuenta operativa"}</small></td><td>{money(e.tax_amount,e.currency)}</td><td><b>{money(e.amount,e.currency)}</b></td><td>{e.payment_method}</td><td><div className={s.actions}>{canManage&&e.status!=="void"&&<button type="button" onClick={()=>onEdit(e)}>Editar</button>}{canManage&&e.status!=="void"&&<button type="button" onClick={()=>onVoid(e)}>Anular</button>}</div></td></tr>})}</tbody></table>{!rows.length&&<Empty title="Sin gastos en este período" text="Cargá proveedores, impuestos y método de pago para alimentar el CFO."/>}</div></section>}

const TARGETS=[
  ["generic_csv","CSV / Excel","Archivo universal del libro diario para estudio contable o planilla."],
  ["tango","Tango Gestión","Archivo de importación preparado para mapear cuentas y asientos; no simula API."],
  ["xubio","Xubio","Exportación para importación contable. La conexión API queda sujeta a credenciales reales."],
  ["contabilium","Contabilium","Archivo contable del período con referencias y cuentas."],
  ["colppy","Colppy","Libro diario exportable para adaptación al formato de importación."],
  ["bejerman","Bejerman","Asientos exportables para parametrización del estudio contable."]
]
export function ExportsTab({exports,bounds,busy,onExport}){return <section><div className={s.sectionTitle}><div><small>EXPORTACIÓN CONTABLE</small><h3>Llevá el período sin reescribir movimientos</h3></div></div><div className={s.exportGrid}>{TARGETS.map(([id,name,text])=><article key={id}><div><span>{name.slice(0,2).toUpperCase()}</span><h4>{name}</h4></div><p>{text}</p><button type="button" disabled={busy==="export"} onClick={()=>onExport(id)}>Exportar período</button></article>)}</div><div className={s.note}><b>Sin falsas integraciones.</b> Hoy estos conectores generan un archivo trazable. Una sincronización directa por API se habilita solamente cuando exista documentación, credenciales y validación real del proveedor.</div><div className={s.exportHistory}><h4>Historial</h4>{exports.slice(0,12).map(x=><div key={x.id}><span>{new Date(x.created_at).toLocaleString("es-AR")} · {x.target}</span><b>{x.rows_count} líneas</b></div>)}{!exports.length&&<Empty title="Todavía no hay exportaciones" text={`${bounds.start} → ${bounds.end}`}/>}</div></section>}
