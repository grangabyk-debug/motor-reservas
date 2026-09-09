"use client"

import GuestPortalRuntime from"./GuestPortalRuntime"
import p from"./premium.module.css"

export default function PremiumStyleWrapper(){return <div className={p.premium}><GuestPortalRuntime/></div>}
