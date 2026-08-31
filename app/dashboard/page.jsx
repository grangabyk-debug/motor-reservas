import HotelOSV2 from "./HotelOSV2"
import StaticCaretGuard from "../components/StaticCaretGuard"
import readability from "./readability.module.css"

export default function DashboardPage(){
  return <><StaticCaretGuard/><div className={readability.readable}><HotelOSV2/></div></>
}
