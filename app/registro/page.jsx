export const metadata={title:"Habitación Llena | Registros pausados",robots:{index:false,follow:false}}

export default function RegistroPage(){
  return <main style={page}>
    <section style={card}>
      <div style={brand}>HABITACIÓN LLENA</div>
      <h1 style={title}>Estamos trabajando<br/>en una nueva versión.</h1>
      <p style={text}>Los nuevos registros están temporalmente pausados mientras terminamos las mejoras.</p>
      <div style={line}/>
      <small style={small}>Volvemos pronto.</small>
    </section>
  </main>
}

const page={minHeight:"100dvh",display:"grid",placeItems:"center",padding:24,background:"radial-gradient(circle at 14% 10%,rgba(18,100,214,.22),transparent 34%),radial-gradient(circle at 88% 86%,rgba(245,164,0,.13),transparent 30%),#081426",color:"#fff",fontFamily:'Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}
const card={width:"min(620px,100%)",textAlign:"center",padding:"clamp(34px,7vw,60px) clamp(22px,6vw,50px)",borderRadius:30,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.055)",boxShadow:"0 30px 90px rgba(0,0,0,.34)"}
const brand={display:"inline-flex",padding:"8px 12px",borderRadius:999,border:"1px solid rgba(255,255,255,.12)",background:"rgba(255,255,255,.06)",fontSize:11,fontWeight:900,letterSpacing:".12em",color:"rgba(255,255,255,.74)",marginBottom:24}
const title={margin:0,fontSize:"clamp(38px,8vw,64px)",lineHeight:.98,letterSpacing:"-.05em",fontWeight:950}
const text={margin:"24px auto 0",maxWidth:450,fontSize:"clamp(16px,3.7vw,19px)",lineHeight:1.55,color:"rgba(255,255,255,.66)"}
const line={width:46,height:4,margin:"30px auto 0",borderRadius:999,background:"linear-gradient(90deg,#1264d6,#f5a400)"}
const small={display:"block",marginTop:18,color:"rgba(255,255,255,.42)",fontSize:13}
