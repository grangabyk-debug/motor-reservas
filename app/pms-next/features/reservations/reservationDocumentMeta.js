export const DOC_LABELS={invoice:"Factura",credit_note:"Nota de crédito",debit_note:"Nota de débito",receipt:"Recibo",proforma:"Proforma",folio:"Folio"}
export const TAX_LABELS={consumidor_final:"Consumidor final",responsable_inscripto:"Responsable inscripto",monotributo:"Monotributo",exento:"Exento",cliente_exterior:"Cliente del exterior",no_categorizado:"No categorizado",no_alcanzado:"IVA no alcanzado"}
export const STATUS_LABELS={draft:"Borrador",issued:"Emitida",void:"Anulada",cancelled:"Cancelada",paid:"Pagada",partial:"Pago parcial"}
export const SALE_LABELS={contado:"Contado",cuenta_corriente:"Cuenta corriente"}
export const A_VARIANT_LABELS={cbu:"PAGO EN CBU INFORMADA",retention:"OPERACIÓN SUJETA A RETENCIÓN"}
export const docLabel=doc=>DOC_LABELS[doc?.document_type]||"Documento"
export const docNumber=doc=>doc?.number||"Sin numerar"
export const nextType=doc=>doc?.document_type==="invoice"?"credit_note":doc?.document_type==="credit_note"?"debit_note":null
export const nextLabel=type=>type==="credit_note"?"Nota de crédito":"Nota de débito"
export const rowTotal=row=>{const quantity=Math.max(0,Number(row?.quantity)||0),unit=Math.max(0,Number(row?.unit_price)||0),rate=Math.max(0,Number(row?.tax_rate)||0);return Number.isFinite(Number(row?.total))?Number(row.total):quantity*unit*(1+rate/100)}
