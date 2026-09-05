export default function PmsIcon({name,size=17,className=""}){
  const common={width:size,height:size,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round","aria-hidden":"true",className}
  if(name==="sun")return <svg {...common}><circle cx="12" cy="12" r="3.5"/><path d="M12 2.5v2M12 19.5v2M4.5 4.5l1.4 1.4M18.1 18.1l1.4 1.4M2.5 12h2M19.5 12h2M4.5 19.5l1.4-1.4M18.1 5.9l1.4-1.4"/></svg>
  if(name==="moon")return <svg {...common}><path d="M20.3 15.2A8.4 8.4 0 0 1 8.8 3.7a8.5 8.5 0 1 0 11.5 11.5Z"/></svg>
  if(name==="bell")return <svg {...common}><path d="M18 8.7a6 6 0 0 0-12 0c0 7-2.5 7-2.5 8.8h17C20.5 15.7 18 15.7 18 8.7Z"/><path d="M9.6 20a2.7 2.7 0 0 0 4.8 0"/><path d="M15.2 6.2c.7.8 1.1 1.8 1.1 2.9" opacity=".55"/></svg>
  if(name==="quote")return <svg {...common}><path d="M6 2.8h8.6L19 7.2v14H6a2 2 0 0 1-2-2V4.8a2 2 0 0 1 2-2Z"/><path d="M14 2.8v5h5"/><path d="M8 11h7M8 15h4"/><path d="M15.8 13.2v4.2M17.4 14.1c-.4-.6-2.7-.8-2.7.4 0 1.4 2.8.7 2.8 2 0 1.1-2.3 1-2.9.4"/></svg>
  if(name==="filter")return <svg {...common}><path d="M3.5 5h17l-6.6 7.4v5.3l-3.8 1.8v-7.1L3.5 5Z"/><path d="M7.2 8h9.6" opacity=".5"/></svg>
  if(name==="refresh")return <svg {...common}><path d="M19.5 7.6A8 8 0 0 0 6.3 5.2L4.5 7"/><path d="M4.5 3.8V7H7.7"/><path d="M4.5 16.4a8 8 0 0 0 13.2 2.4l1.8-1.8"/><path d="M19.5 20.2V17h-3.2"/></svg>
  if(name==="sliders")return <svg {...common}><path d="M4 6h6M14 6h6M4 12h2M10 12h10M4 18h9M17 18h3"/><circle cx="12" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="15" cy="18" r="2"/></svg>
  return <svg {...common}><circle cx="12" cy="12" r="8"/></svg>
}
