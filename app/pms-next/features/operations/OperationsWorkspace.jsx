"use client"

import MaintenancePremium from"./MaintenancePremium"
import OperationsWorkspaceLegacy from"./OperationsWorkspaceLegacy"
import useOperationsData from"./useOperationsData"

const premiumPolish=`
[data-maintenance-premium]{font-size:14px;color:var(--text,#172033)}
[data-maintenance-premium]>div{align-content:start!important}
[data-maintenance-premium] *{box-sizing:border-box}
[data-maintenance-premium] button,[data-maintenance-premium] input,[data-maintenance-premium] select,[data-maintenance-premium] textarea{font-size:13px!important}
[data-maintenance-premium] button{min-height:40px}
[data-maintenance-premium] small{font-size:11px!important;line-height:1.35}
[data-maintenance-premium] p{font-size:12px!important;line-height:1.45}
[data-maintenance-premium] span,[data-maintenance-premium] em,[data-maintenance-premium] label,[data-maintenance-premium] footer{font-size:max(10px,.82em)!important;line-height:1.4}
[data-maintenance-premium] aside b{font-size:12px!important}
[data-maintenance-premium] button footer b{font-size:10px!important}
[data-maintenance-premium] input,[data-maintenance-premium] select{min-height:40px}
[data-maintenance-premium] textarea{font-size:14px!important}
[data-maintenance-premium] nav{min-height:0!important;height:auto!important;padding:7px!important;align-items:center!important;background:color-mix(in srgb,var(--panelSolid,#fff) 78%,transparent)!important;backdrop-filter:blur(24px) saturate(150%);-webkit-backdrop-filter:blur(24px) saturate(150%);border:1px solid color-mix(in srgb,var(--line,#dfe5ed) 78%,transparent)!important;box-shadow:0 14px 36px rgba(61,48,122,.08),inset 0 1px rgba(255,255,255,.65)!important}
[data-maintenance-premium] nav button[data-active="true"]{background:linear-gradient(135deg,#6252dc,#7868f1)!important;color:#fff!important;box-shadow:0 8px 22px rgba(98,82,220,.26),inset 0 1px rgba(255,255,255,.22)!important}
[data-maintenance-premium] article,[data-maintenance-premium] section{scroll-margin-top:84px}
[data-maintenance-premium] button:focus-visible,[data-maintenance-premium] input:focus-visible,[data-maintenance-premium] select:focus-visible,[data-maintenance-premium] textarea:focus-visible{outline:3px solid rgba(98,82,220,.22);outline-offset:2px}
[data-maintenance-premium] label[style] input{width:min(360px,38vw);height:40px;border:1px solid var(--lineStrong,#dfe5ed);border-radius:12px;background:var(--panelSolid,#fff);color:var(--text,#172033);outline:none}
[data-theme="dark"] [data-maintenance-premium]>div{background:radial-gradient(circle at top right,rgba(118,101,230,.16),transparent 28%),#111522!important;color:#eef2ff!important}
[data-theme="dark"] [data-maintenance-premium] section,[data-theme="dark"] [data-maintenance-premium] article,[data-theme="dark"] [data-maintenance-premium] nav,[data-theme="dark"] [data-maintenance-premium] aside{border-color:rgba(151,163,194,.2)!important;color:#eef2ff}
[data-theme="dark"] [data-maintenance-premium] input,[data-theme="dark"] [data-maintenance-premium] select,[data-theme="dark"] [data-maintenance-premium] textarea{background:#171d2c!important;color:#eef2ff!important;border-color:rgba(151,163,194,.25)!important}
@media(max-width:850px){[data-maintenance-premium]{font-size:15px}[data-maintenance-premium] button{min-height:44px}[data-maintenance-premium] input,[data-maintenance-premium] select,[data-maintenance-premium] textarea{font-size:16px!important}[data-maintenance-premium] label[style] input{width:100%}}
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
