import HotelOSV2 from"./HotelOSV2"
import StaticCaretGuard from"../components/StaticCaretGuard"
import MercadoPagoOAuthBridge from"./components/MercadoPagoOAuthBridge"
import readability from"./readability.module.css"
import design from"./dashboard-design.module.css"

export default function DashboardPage(){
  return <><StaticCaretGuard/><MercadoPagoOAuthBridge/><div className={`${readability.readable} ${design.system}`}><HotelOSV2/></div></>
}
