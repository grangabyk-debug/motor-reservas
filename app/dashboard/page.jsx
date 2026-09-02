import HotelOSV2 from"./HotelOSV2"
import StaticCaretGuard from"../components/StaticCaretGuard"
import MercadoPagoOAuthBridge from"./components/MercadoPagoOAuthBridge"
import PWAInstaller from"./components/PWAInstaller"
import DashboardChrome from"./components/DashboardChrome"
import"./pms-unified.css"
import"./pms-unified-modules.css"
import"./simple-interaction-v2.css"
import"./planning-ui.css"
import"./app-simple-mode.css"
import"./app-minimal-v2.css"
import"./app-interaction-polish.css"
import"./mobile-reservation-flow.css"
import"./global-chrome.css"
import"./pms-dark-theme-safe.css"
import"./pms-premium-restyle.css"
import"./pms-responsive.css"
import"./pms-flyout-clarity.css"
import"./pms-dark-complete.css"

export const metadata={
  title:"Habitación Llena",
  description:"PMS hotelero para recepción, reservas, habitaciones y operación diaria.",
  manifest:"/manifest.webmanifest",
  icons:{icon:"/pwa-icon-192.svg",apple:"/logo-habitacion-llena.png"},
  appleWebApp:{capable:true,title:"Habitación Llena",statusBarStyle:"default"}
}

export const viewport={themeColor:"#ffffff"}

export default function DashboardPage(){
  return <><StaticCaretGuard/><MercadoPagoOAuthBridge/><div className="hlHotelgest"><DashboardChrome><HotelOSV2/></DashboardChrome></div><PWAInstaller/></>
}
