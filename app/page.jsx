import MarketingHome from "./marketing/MarketingHome"

export const metadata={
  title:"Habitación Llena | PMS hotelero y Hospitality Operating System",
  description:"PMS hotelero para gestionar reservas, huéspedes, habitaciones, housekeeping, tarifas, revenue y venta directa desde una sola operación.",
  keywords:["PMS hotelero","software hotelero","sistema para hoteles","motor de reservas","housekeeping hotel","revenue management hotel"],
  alternates:{canonical:"https://www.habitacionllena.com/"},
  openGraph:{title:"Habitación Llena · Hospitality Operating System",description:"El sistema hotelero que llena habitaciones y libera a recepción.",type:"website"},
}

export default function Home(){return <MarketingHome/>}
