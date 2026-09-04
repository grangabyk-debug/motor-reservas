import HotelOSV2 from"./HotelOSV2"
import StaticCaretGuard from"../components/StaticCaretGuard"
import MercadoPagoOAuthBridge from"./components/MercadoPagoOAuthBridge"
import PWAInstaller from"./components/PWAInstaller"
import"./hotelgest-rebuild.css"

export const metadata={
  title:"Habitación Llena",
  description:"PMS hotelero para recepción, reservas, habitaciones y operación diaria.",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/pwa-icon-192.svg",apple:"/logo-habitacion-llena.png"},
  appleWebApp:{capable:true,title:"Habitación Llena",statusBarStyle:"default"}
}

export const viewport={themeColor:"#f4f5f6"}

export default function DashboardPage(){
  return <><StaticCaretGuard/><MercadoPagoOAuthBridge/><div className="hlHotelgestRebuild"><HotelOSV2/></div><PWAInstaller/></>
}
