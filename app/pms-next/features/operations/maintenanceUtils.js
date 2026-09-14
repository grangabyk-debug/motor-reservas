import{isoDate}from"../../core/formatters"

export const STATUS={open:"Abierta",assigned:"Asignada",in_progress:"En proceso",waiting_parts:"Esperando repuesto",waiting_vendor:"Esperando proveedor",resolved:"Resuelta",verified:"Verificada",closed:"Cerrada"}
export const PRIORITY={low:"Baja",normal:"Normal",high:"Alta",urgent:"Urgente"}
export const TERMINAL=new Set(["resolved","verified","closed","done","cancelled"])
export const money=value=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(Number(value||0))
export const dateLabel=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value)):"Sin fecha"
export const dateTime=value=>value?new Intl.DateTimeFormat("es-AR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value)):""
export const today=()=>isoDate()
export const addDays=(value,days)=>{const d=new Date(`${value}T12:00:00`);d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
export const roomName=(rooms,id)=>rooms.find(r=>String(r.id)===String(id))?.nombre||"General"
export const staffName=(staff,id)=>staff.find(x=>String(x.user_id)===String(id))?.profile?.full_name||staff.find(x=>String(x.user_id)===String(id))?.role||"Sin asignar"
export const ticketTotal=t=>Number(t.labor_cost||0)+Number(t.material_cost||0)+Number(t.external_cost||0)
export const statusTone=status=>TERMINAL.has(status)?"ok":status==="waiting_parts"||status==="waiting_vendor"?"warn":status==="in_progress"?"info":status==="assigned"?"violet":"neutral"
export const priorityTone=p=>p==="urgent"?"danger":p==="high"?"warn":p==="low"?"muted":"neutral"
