"use client"

import{useMemo}from"react"
import useGuestProfileAutocomplete from"./useGuestProfileAutocomplete"

export default function ReservationAddRoomGuestPicker({propertyId,draft,setDraft}){
  const profileDraft=useMemo(()=>({
    full_name:draft.holderName||"",
    phone:draft.phone||"",
    email:draft.email||"",
    guest_profile_id:draft.guestProfileId||"",
  }),[draft.holderName,draft.phone,draft.email,draft.guestProfileId])
  const setProfileDraft=updater=>setDraft(current=>{
    const base={full_name:current.holderName||"",phone:current.phone||"",email:current.email||"",guest_profile_id:current.guestProfileId||""}
    const next=typeof updater==="function"?updater(base):updater
    return{...current,holderName:next.full_name??current.holderName,phone:next.phone??current.phone,email:next.email??current.email,guestProfileId:next.guest_profile_id??current.guestProfileId}
  })
  const{profileMatches,profileSearching,profileApplied,applyGuestProfile,clearAppliedProfile}=useGuestProfileAutocomplete({propertyId,draft:profileDraft,setDraft:setProfileDraft})
  const label={display:"grid",gap:5,fontSize:10.5,fontWeight:850,color:"var(--muted)"}
  const control={height:39,width:"100%",boxSizing:"border-box",border:"1px solid var(--line)",borderRadius:10,padding:"0 10px",background:"color-mix(in srgb,var(--panelSolid) 88%,transparent)",color:"var(--text)",font:"inherit",fontSize:11.5,fontWeight:760,outline:"none"}
  const set=(name,value)=>{setDraft(current=>{const next={...current,[name]:value};if(name==="holderName"&&String(value||"")!==String(current.holderName||""))next.guestProfileId="";return next});if(name==="holderName")clearAppliedProfile()}

  return <>
    <b style={{fontSize:13,fontWeight:850}}>Titular de esta habitación</b>
    <p style={{margin:"4px 0 11px",fontSize:10.5,lineHeight:1.4,color:"var(--muted)"}}>Puede ser el pasajero principal, otro huésped frecuente o una persona nueva.</p>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
      <label style={{...label,gridColumn:"1/-1"}}>Nombre y apellido<input style={control} value={draft.holderName} onChange={event=>set("holderName",event.target.value)}/></label>
      <label style={label}>Teléfono<input style={control} value={draft.phone} onChange={event=>set("phone",event.target.value)}/></label>
      <label style={label}>Email<input type="email" style={control} value={draft.email} onChange={event=>set("email",event.target.value)}/></label>
    </div>
    {profileApplied?<div style={{marginTop:9,padding:"9px 10px",border:"1px solid color-mix(in srgb,#2e9b61 30%,var(--line))",borderRadius:10,background:"color-mix(in srgb,#2e9b61 7%,var(--panelSolid))",color:"#26794d",fontSize:10,fontWeight:850}}>✓ Huésped frecuente vinculado: <b>{profileApplied}</b></div>:String(draft.holderName||"").trim().length>=3?<div style={{marginTop:9,padding:10,border:"1px solid color-mix(in srgb,var(--accent) 22%,var(--line))",borderRadius:10,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10,alignItems:"center"}}><span><b style={{display:"block",fontSize:10.5}}>Huésped frecuente / histórico</b><small style={{display:"block",marginTop:2,fontSize:9.2,color:"var(--muted)"}}>Buscamos en el Guestbook mientras escribís.</small></span><small style={{fontSize:9,color:"var(--muted)"}}>{profileSearching?"Buscando…":profileMatches.length?`${profileMatches.length} coincidencia${profileMatches.length===1?"":"s"}`:"Sin coincidencias"}</small></div>
      {profileMatches.length?<div style={{display:"grid",gap:6,marginTop:8}}>{profileMatches.map(profile=><button type="button" key={profile.id} onClick={()=>applyGuestProfile(profile)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"8px 9px",border:"1px solid var(--line)",borderRadius:9,background:"var(--panelSolid)",color:"var(--text)",font:"inherit",textAlign:"left",cursor:"pointer"}}><span style={{minWidth:0}}><b style={{display:"block",fontSize:10.5}}>{profile.full_name}</b><small style={{display:"block",marginTop:2,fontSize:9,color:"var(--muted)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{[profile.document_number?`${profile.document_type||"Documento"} ${profile.document_number}`:"",profile.email||profile.phone||""].filter(Boolean).join(" · ")||"Datos guardados"}</small></span><strong style={{flex:"0 0 auto",fontSize:9.3,color:"var(--accent)"}}>Usar datos</strong></button>)}</div>:null}
    </div>:null}
  </>
}
