"use client"

import PremiumPortalClient from"./PremiumPortalClient"
import p from"./premium.module.css"

export default function PremiumStyleWrapper(){return <div className={p.premium}><PremiumPortalClient/></div>}
