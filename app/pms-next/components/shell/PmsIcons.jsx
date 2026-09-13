export default function PmsIcon({name,size=17,className=""}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",className}
  if(name==="sun")return <svg {...common}><circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4"/></svg>
  if(name==="moon")return <svg {...common}><path d="M20.3 15.2A8.4 8.4 0 0 1 8.8 3.7a8.5 8.5 0 1 0 11.5 11.5Z"/></svg>
  if(name==="bell")return <svg {...common}><path d="M18 8.7a6 6 0 0 0-12 0c0 7-2.5 7-2.5 8.8h17C20.5 15.7 18 15.7 18 8.7Z"/><path d="M9.6 20a2.7 2.7 0 0 0 4.8 0"/></svg>
  if(name==="quote")return <svg {...common}><path d="M6 2.8h8.6L19 7.2v14H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z"/><path d="M14 2.8v5h5M8 11h7M8 15h4"/></svg>
  if(name==="filter")return <svg {...common}><path d="M3.5 5h17l-6.6 7.4v5.3l-3.8 1.8v-7.1L3.5 5Z"/></svg>
  if(name==="refresh")return <svg {...common}><path d="M19.5 7.6A8 8 0 0 0 6.3 5.2L4.5 7M4.5 3.8V7H7.7M4.5 16.4a8 8 0 0 0 13.2 2.4l1.8-1.8M19.5 20.2V17h-3.2"/></svg>
  if(name==="sliders")return <svg {...common}><path d="M4 6h6M14 6h6M4 12h2M10 12h10M4 18h9M17 18h3"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="15" cy="18" r="2"/></svg>
  const paths={
    grid:<><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/></>,
    calendar:<><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M7.5 3v4M16.5 3v4M3.5 9h17M7 13h3M14 13h3M7 17h3"/></>,
    booking:<><path d="M5 4.5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z"/><path d="M7 9h10M7 13h7M7 17h4"/></>,
    guest:<><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20c.7-4 3-6 6.5-6s5.8 2 6.5 6"/></>,
    message:<><path d="M4 4.5h16v11H9l-5 4v-15Z"/><path d="M8 9h8M8 12h5"/></>,
    tasks:<><path d="M9 5h11M9 12h11M9 19h11"/><path d="m4 5 1.4 1.4L7.8 4M4 12l1.4 1.4L7.8 11M4 19l1.4 1.4L7.8 18"/></>,
    request:<><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5"/><path d="M12 7v5l3 2M16 3.5h4.5V8"/></>,
    clean:<><path d="M8 3h8l-1 5H9L8 3ZM10 8l-2 12M14 8l2 12M6 20h12"/></>,
    wrench:<><path d="M14.4 5.2a4.5 4.5 0 0 0-5.6 5.6L3.5 16.1a2 2 0 0 0 2.8 2.8l5.3-5.3a4.5 4.5 0 0 0 5.6-5.6l-2.6 2.6-2.2-2.2 2-3.2Z"/></>,
    inventory:<><path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="m4 7v10l8 4 8-4V7M12 11v10"/></>,
    services:<><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="8.5"/></>,
    rates:<><path d="M5 19V9M12 19V5M19 19v-7"/><path d="m4 7 5-3 5 3 6-4"/></>,
    cash:<><rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="12" cy="12" r="3"/><path d="M7 8H5v2M17 16h2v-2"/></>,
    activity:<><path d="M3 12h4l2-5 4 10 2-5h6"/></>,
    link:<><path d="M10 13.5 8.5 15a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0M14 10.5 15.5 9a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0M8.5 15.5l7-7"/></>,
    growth:<><path d="M4 18 9 13l3 3 8-9"/><path d="M15 7h5v5"/></>,
    report:<><path d="M5 20V10M10 20V4M15 20v-7M20 20V7"/></>,
    team:<><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.3"/><path d="M3.5 20c.6-4 2.5-6 5.5-6s4.9 2 5.5 6M14 15c3.5-.4 5.7 1.2 6.5 4.5"/></>,
    settings:<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.8-1L14.4 3h-4.8l-.4 3.1a7 7 0 0 0-1.8 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.8 1l.4 3.1h4.8l.4-3.1a7 7 0 0 0 1.8-1l2.4 1 2-3.4L19 13a7 7 0 0 0 0-1Z"/></>,
    help:<><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.6 2.1c-1 .6-1.4 1.1-1.4 2.2M12 17h.01"/></>,
  }
  return <svg {...common}>{paths[name]||<circle cx="12" cy="12" r="8"/>}</svg>
}