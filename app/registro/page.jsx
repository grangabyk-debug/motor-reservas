import HospitalityShell from "../components/hospitality/HospitalityShell"
import SignupForm from "./SignupForm"

export const metadata={title:"Crear cuenta | Habitación Llena",description:"Creá tu hotel en Habitación Llena Hospitality Operating System.",robots:{index:true,follow:true}}

export default function RegistroPage(){return <HospitalityShell backHref="/" eyebrow="CREAR CUENTA" title="Tu hotel, listo para entrar." copy="Abrí tu espacio de trabajo y empezá con una propiedad aislada, segura y preparada para sumar al equipo."><SignupForm/></HospitalityShell>}
