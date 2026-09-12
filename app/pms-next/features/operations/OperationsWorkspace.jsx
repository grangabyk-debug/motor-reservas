"use client"

import MaintenancePremium from"./MaintenancePremium"
import OperationsWorkspaceLegacy from"./OperationsWorkspaceLegacy"
import useOperationsData from"./useOperationsData"

const premiumPolish=`
[data-maintenance-premium]{font-size:14px;color:var(--text,#172033)}
[data-maintenance-premium] *{box-sizing:border-box}
[data-maintenance-premium] header p,[data-maintenance-premium] .maintenance-explainer{display:none!important}
[data-maintenance-premium] button,[data-maintenance-premium] input,[data-maintenance-premium] select,[data-maintenance-premium] textarea{font-size:13px!important}
[data-maintenance-premium] button{min-height:38px}
[data-maintenance-premium] small{font-size:11px!important;line-height:1.35}
[data-maintenance-premium] p,[data-maintenance-premium] label,[data-maintenance-premium] span{line-height:1.4}
[data-maintenance-premium] input,[data-maintenance-premium] select{min-height:40px}
[data-maintenance-premium] textarea{font-size:14px!important}
[data-maintenance-premium] nav{background:color-mix(in srgb,var(--panelSolid,#fff) 76%,transparent)!important;backdrop-filter:blur(22px) saturate(145%);-webkit-backdrop-filter:blur(22px) saturate(145%);border:1px solid color-mix(in srgb,var(--line,#dfe5ed) 78%,transparent)!important;box-shadow:0 14px 36px rgba(61,48,122,.08),inset 0 1px rgba(255,255,255,.65)!important}
[data-maintenance-premium] nav button[data-active="true"]{background:linear-gradient(135deg,#6252dc,#7868f1)!important;color:#fff!important;box-shadow:0 8px 22px rgba(98,82,220,.26),inset 0 1px rgba(255,255,255,.22)!important}
[data-maintenance-premium] article,[data-maintenance-premium] section{scroll-margin-top:84px}
[data-maintenance-premium] button:focus-visible,[data-maintenance-premium] input:focus-visible,[data-maintenance-premium] select:focus-visible,[data-maintenance-premium] textarea:focus-visible{outline:3px solid rgba(98,82,220,.22);outline-offset:2px}
@media(max-width:850px){[data-maintenance-premium]{font-size:15px}[data-maintenance-premium] button{min-height:42px}[data-maintenance-premium] input,[data-maintenance-premium] select,[data-maintenance-premium] textarea{font-size:16px!important}}
`

function MaintenanceContext({propertyId}){
  const data=useOperationsData(propertyId)
  if(data.loading)return <section style={{padding:24,fontSize:15,fontWeight:700}}>Cargando Mantenimiento…</section>
  return <div data-maintenance-premium><style>{premiumPolish}</style><MaintenancePremium propertyId={propertyId} rooms={data.rooms||[]} reservations={data.reservations||[]} resources={[]}/></div>
}

export default function OperationsWorkspace(props){
  if(props.initialTab==="maintenance")return <MaintenanceContext propertyId={props.propertyId}/>
  return <OperationsWorkspaceLegacy {...props}/>
}
