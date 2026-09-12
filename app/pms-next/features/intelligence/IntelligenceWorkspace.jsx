"use client"

import AnalyticsOverview from"./AnalyticsOverview"
import useIntelligenceData from"./useIntelligenceData"

const polish=`
[data-intelligence] header p{display:none!important}
[data-intelligence] button{min-height:38px;font-size:12px!important}
[data-intelligence] small{font-size:11px!important;line-height:1.35}
[data-intelligence] table{font-size:12px}
[data-intelligence] th,[data-intelligence] td{font-size:11px!important}
[data-intelligence] select,[data-intelligence] input{min-height:38px;font-size:13px!important}
[data-intelligence] main{border-radius:22px;overflow:hidden}
[data-intelligence] nav,[data-intelligence] section{scroll-margin-top:82px}
[data-theme="dark"] [data-intelligence] main{background:radial-gradient(circle at top right,rgba(118,101,230,.15),transparent 30%),#111522!important;color:#edf1fb!important}
[data-theme="dark"] [data-intelligence] article,[data-theme="dark"] [data-intelligence] section{border-color:rgba(151,163,194,.2)!important;color:#edf1fb}
[data-theme="dark"] [data-intelligence] table,[data-theme="dark"] [data-intelligence] thead,[data-theme="dark"] [data-intelligence] tbody,[data-theme="dark"] [data-intelligence] tr,[data-theme="dark"] [data-intelligence] td,[data-theme="dark"] [data-intelligence] th{color:#edf1fb!important;border-color:rgba(151,163,194,.15)!important}
@media(max-width:760px){[data-intelligence] button{min-height:42px}[data-intelligence] select,[data-intelligence] input{font-size:16px!important}}
`

export default function IntelligenceWorkspace({propertyId,property}){
  const data=useIntelligenceData(propertyId),role=property?.role||"member",canManage=["owner","manager"].includes(role)
  if(data.loading)return <section style={{padding:24,fontSize:15,fontWeight:750}}>Cargando Inteligencia…</section>
  if(data.error)return <section style={{padding:24}}><div style={{padding:14,borderRadius:14,background:"rgba(229,72,77,.1)",color:"#b42343",fontWeight:750}}>{data.error}</div></section>
  return <section data-intelligence><style>{polish}</style><AnalyticsOverview rooms={data.rooms} reservations={data.reservations} payments={data.payments} blocks={data.blocks} snapshots={data.snapshots} channelCosts={data.channelCosts} settings={property||{}} canManageChannelCosts={canManage} onSaveChannelCost={data.saveChannelCost}/></section>
}
