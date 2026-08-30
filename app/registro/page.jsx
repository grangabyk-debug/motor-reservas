import Link from "next/link"
import HospitalityShell from "../components/hospitality/HospitalityShell"
import ui from "./registro.module.css"

export const metadata={title:"Habitación Llena | Acceso anticipado",description:"Acceso anticipado a Habitación Llena Hospitality Operating System.",robots:{index:true,follow:true}}

export default function RegistroPage(){return <HospitalityShell eyebrow="ACCESO ANTICIPADO" title="Estamos preparando algo que se sienta a la altura de tu hotel." copy="La nueva generación de Habitación Llena está entrando en su etapa de onboarding. Los registros automáticos permanecen pausados mientras terminamos la experiencia completa."><section className={ui.card}><div className={ui.note}><small>PRÓXIMA APERTURA</small><h2>Hospitality Operating System</h2><p>PMS, Command Center, Guest CRM, Revenue Intelligence, Housekeeping, Web Check-in y motor directo dentro de una sola operación.</p></div><div className={ui.actions}><Link href="/preview/pms-next" className={ui.primary}>Ver la experiencia</Link><Link href="/login" className={ui.secondary}>Ya tengo acceso</Link></div><p className={ui.small}>No vamos a abrir altas masivas hasta que el onboarding y los flujos críticos estén al nivel del producto.</p></section></HospitalityShell>}
