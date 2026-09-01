import{ supabase }from"../../../lib/supabase"
import{ requirePropertyId }from"../data/tenant"

const tenant=id=>requirePropertyId(id)
const uuid=()=>globalThis.crypto?.randomUUID?.()||`hl-${Date.now()}-${Math.random().toString(16).slice(2)}`
async function currentUser(){const{data:{user},error}=await supabase.auth.getUser();if(error||!user)throw new Error("Tenés que iniciar sesión.");return user}

export function activeAccountingProperty(){try{return String(localStorage.getItem("hl_active_property_id")||"")}catch{return""}}

export async function loadAccountingCenter({propertyId}){
  const property=tenant(propertyId)
  const [accounts,expenses,periods,exports,ledger,documents,payments,arcaSettings,arcaRequests]=await Promise.all([
    supabase.from("hotel_chart_accounts").select("*").eq("property_id",property).order("code"),
    supabase.from("hotel_accounting_expenses").select("*").eq("property_id",property).order("occurred_on",{ascending:false}).limit(500),
    supabase.from("hotel_accounting_periods").select("*").eq("property_id",property).order("period_year",{ascending:false}).order("period_month",{ascending:false}),
    supabase.from("hotel_accounting_exports").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(100),
    supabase.from("hotel_accounting_ledger").select("*").eq("property_id",property).order("entry_date",{ascending:false}).limit(4000),
    supabase.from("hotel_finance_documents").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(500),
    supabase.from("pagos").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(1200),
    supabase.from("hotel_arca_settings").select("*").eq("property_id",property).maybeSingle(),
    supabase.from("hotel_arca_invoice_requests").select("*").eq("property_id",property).order("created_at",{ascending:false}).limit(300),
  ])
  const required=[accounts,expenses,periods,exports,ledger,documents,payments],error=required.find(x=>x.error)?.error;if(error)throw error
  return{accounts:accounts.data||[],expenses:expenses.data||[],periods:periods.data||[],exports:exports.data||[],ledger:ledger.data||[],documents:documents.data||[],payments:payments.data||[],arcaSettings:arcaSettings.error?null:arcaSettings.data||null,arcaRequests:arcaRequests.error?[]:arcaRequests.data||[]}
}

export async function saveAccountingExpense({propertyId,draft}){
  const property=tenant(propertyId),user=await currentUser(),amount=Number(draft.amount||0),tax=Math.max(0,Number(draft.tax_amount||0));if(!(amount>0))throw new Error("Ingresá un importe válido.");if(tax>amount)throw new Error("El IVA no puede superar el total del gasto.");if(!String(draft.concept||"").trim())throw new Error("Ingresá el concepto del gasto.")
  const row={property_id:property,occurred_on:draft.occurred_on||new Date().toISOString().slice(0,10),supplier_name:String(draft.supplier_name||"").trim()||null,supplier_tax_id:String(draft.supplier_tax_id||"").trim()||null,concept:String(draft.concept).trim(),category:String(draft.category||"Operativo").trim(),account_id:draft.account_id||null,amount,tax_amount:tax,currency:String(draft.currency||"ARS").toUpperCase(),payment_method:draft.payment_method||"Transferencia",document_number:String(draft.document_number||"").trim()||null,reference:String(draft.reference||"").trim()||null,status:draft.status||"posted",notes:String(draft.notes||"").trim()||null,created_by:user.id,updated_at:new Date().toISOString()}
  const query=draft.id?supabase.from("hotel_accounting_expenses").update(row).eq("id",draft.id).eq("property_id",property).select("*").single():supabase.from("hotel_accounting_expenses").insert(row).select("*").single(),{data,error}=await query;if(error)throw error;return data
}

export async function voidAccountingExpense({propertyId,id}){const property=tenant(propertyId),{data,error}=await supabase.from("hotel_accounting_expenses").update({status:"void",updated_at:new Date().toISOString()}).eq("property_id",property).eq("id",id).select("*").single();if(error)throw error;return data}

export async function closeAccountingPeriod({propertyId,year,month,notes=""}){const property=tenant(propertyId),{data,error}=await supabase.rpc("hl_close_accounting_period",{p_property_id:property,p_year:Number(year),p_month:Number(month),p_notes:notes||null});if(error)throw error;return Array.isArray(data)?data[0]:data}
export async function reopenAccountingPeriod({propertyId,year,month}){const property=tenant(propertyId),{data,error}=await supabase.rpc("hl_reopen_accounting_period",{p_property_id:property,p_year:Number(year),p_month:Number(month)});if(error)throw error;return Array.isArray(data)?data[0]:data}

export async function recordAccountingExport({propertyId,start,end,target="generic_csv",format="csv",rowsCount=0,fileName="",metadata={}}){const property=tenant(propertyId),user=await currentUser(),{data,error}=await supabase.from("hotel_accounting_exports").insert({property_id:property,period_start:start,period_end:end,target,format,rows_count:Number(rowsCount||0),file_name:fileName||null,metadata,created_by:user.id}).select("*").single();if(error)throw error;return data}

export async function issueArcaFinanceDocument({propertyId,document,reservation,arcaSettings,fiscal}){
  const property=tenant(propertyId);if(!document?.id)throw new Error("Guardá primero el documento.");if(!arcaSettings?.enabled)throw new Error("ARCA todavía no está configurado para esta propiedad.");if(document.status==="issued"&&String(document.external_ref||"").startsWith("ARCA "))throw new Error("Este documento ya fue autorizado por ARCA.")
  const receiptType=Number(fiscal.receipt_type||arcaSettings.default_receipt_type||11),amount=Number(document.total||0),tax=receiptType===11?0:Number(fiscal.vat_amount??document.tax??0),net=receiptType===11?amount:Number(fiscal.net_amount??Math.max(0,amount-tax)),vatBreakdown=receiptType===11?[]:(tax>0?[{id:Number(fiscal.vat_rate_id||5),base:net,amount:tax}]:[]),requestId=`hl-accounting-${document.id}-${receiptType}`
  const body={property_id:property,request_id:requestId,reservation_id:document.reservation_id||reservation?.id||null,finance_document_id:document.id,receipt_type:receiptType,currency:String(document.currency||"ARS").toUpperCase(),exchange_rate:Number(fiscal.exchange_rate||reservation?.tipo_cambio||1),amount,net_amount:net,vat_amount:tax,exempt_amount:Number(fiscal.exempt_amount||0),untaxed_amount:Number(fiscal.untaxed_amount||0),tribute_amount:0,tributes:[],vat_breakdown:vatBreakdown,recipient_doc_type:Number(fiscal.recipient_doc_type||99),recipient_doc_number:String(fiscal.recipient_doc_number||"0").replace(/\D/g,"")||"0",recipient_iva_condition:fiscal.recipient_iva_condition||"consumidor_final",service_from:reservation?.fecha_entrada||null,service_to:reservation?.fecha_salida||null,payment_due:reservation?.fecha_salida||null}
  const{data,error}=await supabase.functions.invoke("hotel-arca-invoice",{body});if(error){let message=error.message||"ARCA rechazó la solicitud.";try{const payload=await error.context?.json?.();message=payload?.error||message}catch{}throw new Error(message)}if(!data?.ok)throw new Error(data?.error||"ARCA no autorizó el comprobante.");return data
}

export function accountingCsv(rows=[]){
  const cols=["Fecha","Referencia","Origen","Descripción","Cuenta","Nombre cuenta","Debe","Haber","Moneda","Reserva"],escape=v=>`"${String(v??"").replaceAll('"','""')}"`,body=rows.map(r=>[r.entry_date,r.reference,r.source_type,r.description,r.account_code,r.account_name,Number(r.debit||0).toFixed(2),Number(r.credit||0).toFixed(2),r.currency,r.reservation_id||""].map(escape).join(";"));return`\ufeff${cols.map(escape).join(";")}\n${body.join("\n")}`
}
export function downloadAccountingCsv(rows,fileName="contabilidad.csv"){
  const blob=new Blob([accountingCsv(rows)],{type:"text/csv;charset=utf-8"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=fileName;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)
}
