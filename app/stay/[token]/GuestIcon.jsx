"use client"

const common={viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:1.8,strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":true}

export const CONTENT_ICON_ALIASES={
  "☕":"coffee","🏊":"pool","🏨":"hotel","📍":"pin","🛏️":"bed","🛎️":"bell","🛎":"bell","🛠️":"tools","🕒":"clock","✨":"sparkles","💬":"message","🧺":"towels","🚗":"car","🍽️":"restaurant","🍴":"restaurant","🅿️":"car","📶":"wifi","ℹ️":"info","⌂":"home","◷":"clock","⌁":"wifi"
}

export function resolveGuestIcon(value,fallback="info"){
  const raw=String(value||"").trim()
  if(CONTENT_ICON_ALIASES[raw])return CONTENT_ICON_ALIASES[raw]
  const normalized=raw.toLowerCase().replace(/[_\s]+/g,"-")
  const known=new Set(["hotel","bell","tools","clock","info","pin","towels","bed","cleaning","sparkles","message","home","wifi","lock","globe","coffee","pool","car","restaurant","calendar","check","help","room","external","chevron-right","chevron-down","signal","wallet","key","spa","taxi"])
  return known.has(normalized)?normalized:fallback
}

export default function GuestIcon({name,size=22,className="",strokeWidth=1.8}){
  const n=resolveGuestIcon(name,"info"),props={...common,width:size,height:size,strokeWidth,className}
  if(n==="hotel")return <svg {...props}><path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5V21"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M3 21h18"/></svg>
  if(n==="bell")return <svg {...props}><path d="M5 10.5A7 7 0 0 1 19 10.5V15l1.5 2H3.5L5 15z"/><path d="M9.5 20h5"/><path d="M12 3V2"/></svg>
  if(n==="tools")return <svg {...props}><path d="M14.5 6.5a4 4 0 0 0-5-5l2.2 2.2-2.8 2.8-2.2-2.2a4 4 0 0 0 5 5L19 16.6a2.1 2.1 0 0 1-3 3L8.7 12.3"/><path d="m5 20 5.2-5.2"/></svg>
  if(n==="clock")return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
  if(n==="info")return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
  if(n==="pin")return <svg {...props}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.4"/></svg>
  if(n==="towels")return <svg {...props}><path d="M5 5.5A2.5 2.5 0 0 1 7.5 3h9A2.5 2.5 0 0 1 19 5.5V19H8a3 3 0 0 1-3-3z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>
  if(n==="bed")return <svg {...props}><path d="M3 18V9M21 18v-6a3 3 0 0 0-3-3H9v6"/><path d="M3 15h18M5 9h4v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2Z"/></svg>
  if(n==="cleaning")return <svg {...props}><path d="m14 3 1.2 3.2L18 7.5l-2.8 1.3L14 12l-1.2-3.2L10 7.5l2.8-1.3z"/><path d="m7 11 .9 2.1L10 14l-2.1.9L7 17l-.9-2.1L4 14l2.1-.9z"/><path d="M14 17h6M17 14v6"/></svg>
  if(n==="sparkles")return <svg {...props}><path d="m12 2 1.5 4.3L18 8l-4.5 1.7L12 14l-1.5-4.3L6 8l4.5-1.7z"/><path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>
  if(n==="message")return <svg {...props}><path d="M20 15a4 4 0 0 1-4 4H8l-5 3 1.5-4A7.5 7.5 0 0 1 4 6a4 4 0 0 1 4-1h8a4 4 0 0 1 4 4z"/><path d="M8 11h8M8 14h5"/></svg>
  if(n==="home")return <svg {...props}><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>
  if(n==="wifi")return <svg {...props}><path d="M5 10a10 10 0 0 1 14 0M8 13a6 6 0 0 1 8 0M10.8 16a2 2 0 0 1 2.4 0"/><circle cx="12" cy="19" r=".7" fill="currentColor" stroke="none"/></svg>
  if(n==="lock")return <svg {...props}><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>
  if(n==="globe")return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
  if(n==="coffee")return <svg {...props}><path d="M5 8h11v6a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5z"/><path d="M16 10h2a2.5 2.5 0 0 1 0 5h-2M8 4v2M12 3v3"/></svg>
  if(n==="pool")return <svg {...props}><path d="M4 9h16M8 9V5h5a3 3 0 0 1 3 3v1M5 14c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 5 0M5 18c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 5 0"/></svg>
  if(n==="car")return <svg {...props}><path d="M4 16v-5l2-5h12l2 5v5"/><path d="M3 12h18M6 16h.01M18 16h.01M6 19v2M18 19v2"/><path d="M7 12l1-3h8l1 3"/></svg>
  if(n==="restaurant")return <svg {...props}><path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4"/></svg>
  if(n==="calendar")return <svg {...props}><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01"/></svg>
  if(n==="check")return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>
  if(n==="help")return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.4 1-1.4 2M12 17h.01"/></svg>
  if(n==="room")return <svg {...props}><rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h5"/><circle cx="16" cy="17" r=".7" fill="currentColor" stroke="none"/></svg>
  if(n==="external")return <svg {...props}><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>
  if(n==="chevron-right")return <svg {...props}><path d="m9 6 6 6-6 6"/></svg>
  if(n==="chevron-down")return <svg {...props}><path d="m7 9 5 5 5-5"/></svg>
  if(n==="signal")return <svg {...props}><path d="M4 17h2v3H4zM9 13h2v7H9zM14 9h2v11h-2zM19 5h2v15h-2z"/></svg>
  if(n==="wallet")return <svg {...props}><path d="M4 6a3 3 0 0 1 3-3h10v4H7a3 3 0 0 0 0 6h13v7H6a2 2 0 0 1-2-2z"/><path d="M16 10h4v6h-4a3 3 0 0 1 0-6Z"/></svg>
  if(n==="key")return <svg {...props}><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l2 2M17 6l2 2"/></svg>
  if(n==="spa")return <svg {...props}><path d="M12 21c0-5 3-8 8-9 0 5-3 8-8 9ZM12 21c0-5-3-8-8-9 0 5 3 8 8 9ZM12 17c-3-4-3-8 0-12 3 4 3 8 0 12Z"/></svg>
  if(n==="taxi")return <svg {...props}><path d="M4 16v-5l2-4h12l2 4v5M3 12h18M6 16h.01M18 16h.01M8 7V4h8v3M6 19v2M18 19v2"/></svg>
  return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>
}
