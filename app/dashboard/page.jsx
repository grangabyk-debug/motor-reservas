import HotelOSV2 from"./HotelOSV2"
import StaticCaretGuard from"../components/StaticCaretGuard"
import MercadoPagoOAuthBridge from"./components/MercadoPagoOAuthBridge"
import"./pms-unified.css"
import"./pms-unified-modules.css"
import"./simple-interaction-v2.css"
import"./planning-ui.css"
import"./app-simple-mode.css"

export default function DashboardPage(){
  return <><StaticCaretGuard/><MercadoPagoOAuthBridge/><div className="hlHotelgest"><HotelOSV2/></div></>
}
