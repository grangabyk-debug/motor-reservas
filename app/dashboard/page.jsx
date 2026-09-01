import HotelOSV2 from"./HotelOSV2"
import StaticCaretGuard from"../components/StaticCaretGuard"
import MercadoPagoOAuthBridge from"./components/MercadoPagoOAuthBridge"
import readability from"./readability.module.css"
import design from"./dashboard-design.module.css"
import"./planning-stage-now.css"
import"./dashboard-stage-now.css"
import"./module-stage-now.css"

export default function DashboardPage(){
  return <><StaticCaretGuard/><MercadoPagoOAuthBridge/><div className={`hlStageNow ${readability.readable} ${design.system}`}><HotelOSV2/></div></>
}
