"use client"

import{useEffect,useState}from"react"
import{supabase}from"../../../../lib/supabase"
import{defaultRecipientDocType}from"./reservationInvoiceDocument"

const clean=value=>String(value||"").trim()
const isLead=row=>String(row?.relationship||"").toLowerCase()==="titular"||String(row?.role||"").toLowerCase()==="primary"

export default function useInvoiceRecipientOptions({open,reservation,selected,setBillingName,setBillingEmail,setBillingPhone,setBillingTaxId,setBillingDocType,setBillingAddress}){
  const[recipientOptions,setRecipientOptions]=useState([])
  const[recipientKey,setRecipientKey]=useState("")

  function applyRecipient(row){
    if(!row)return
    setRecipientKey(row.key)
    setBillingName(row.name||"")
    setBillingEmail(row.email||"")
    setBillingPhone(row.phone||"")
    setBillingTaxId(row.taxId||"")
    setBillingDocType(row.docType||defaultRecipientDocType("consumidor_final",row.taxId||""))
    setBillingAddress(row.address||"")
  }

  function chooseRecipient(key){
    const row=recipientOptions.find(option=>option.key===key)
    if(row)applyRecipient(row)
  }

  useEffect(()=>{
    if(!open||!reservation?.id||!reservation?.property_id||!selected){setRecipientOptions([]);setRecipientKey("");return}
    let cancelled=false
    ;(async()=>{
      try{
        const[guestRes,linkRes]=await Promise.all([
          supabase.from("hotel_reservation_guests").select("id,room_id,role,full_name,email,phone,document_number,cuil,address,city,province,country,relationship,sort_order,checked_out_at").eq("property_id",reservation.property_id).eq("reservation_id",Number(reservation.id)).order("sort_order"),
          supabase.from("reservas").select("partner_id").eq("property_id",reservation.property_id).eq("id",Number(reservation.id)).maybeSingle(),
        ])
        if(guestRes.error)throw guestRes.error
        if(linkRes.error)throw linkRes.error

        const allGuests=guestRes.data||[]
        let guests=selected.room_id?allGuests.filter(row=>Number(row.room_id)===Number(selected.room_id)):allGuests.filter(row=>String(row.role||"").toLowerCase()==="primary")
        if(!guests.length&&!selected.room_id)guests=allGuests.slice(0,1)
        guests=guests.slice().sort((a,b)=>(isLead(a)?0:1)-(isLead(b)?0:1)||(Number(a.sort_order)||0)-(Number(b.sort_order)||0))

        const guestOptions=guests.filter(row=>clean(row.full_name)).map(row=>{
          const taxId=clean(row.cuil||row.document_number)
          return{
            key:"guest:"+row.id,type:"guest",label:clean(row.full_name),subtitle:selected.room_id?selected.label:"Huésped principal",
            name:clean(row.full_name),email:clean(row.email),phone:clean(row.phone),taxId,
            docType:clean(row.cuil)?"cuil":defaultRecipientDocType("consumidor_final",taxId),
            address:[row.address,row.city,row.province,row.country].filter(Boolean).join(", "),
          }
        })

        let companyOptions=[]
        const partnerId=linkRes.data?.partner_id
        if(partnerId){
          const partnerRes=await supabase.from("hotel_partners").select("id,kind,name,tax_id,email,phone,active").eq("property_id",reservation.property_id).eq("id",partnerId).maybeSingle()
          if(partnerRes.error)throw partnerRes.error
          const p=partnerRes.data
          if(p&&p.active!==false&&clean(p.name)){
            const taxId=clean(p.tax_id)
            companyOptions=[{key:"partner:"+p.id,type:"company",label:clean(p.name),subtitle:String(p.kind||"").toLowerCase()==="agency"?"Agencia vinculada":"Empresa vinculada",name:clean(p.name),email:clean(p.email),phone:clean(p.phone),taxId,docType:defaultRecipientDocType("responsable_inscripto",taxId),address:""}]
          }
        }else if(["company","agency"].includes(String(selected.payer_type||"").toLowerCase())&&clean(selected.payer_name)){
          companyOptions=[{key:"folio-company:"+selected.id,type:"company",label:clean(selected.payer_name),subtitle:String(selected.payer_type).toLowerCase()==="agency"?"Agencia del folio":"Empresa del folio",name:clean(selected.payer_name),email:"",phone:"",taxId:"",docType:"cuit",address:""}]
        }

        if(cancelled)return
        const options=[...guestOptions,...companyOptions]
        setRecipientOptions(options)
        const preferred=(selected.room_id?guestOptions[0]:null)||companyOptions[0]||guestOptions[0]||null
        if(preferred)applyRecipient(preferred)
        else setRecipientKey("")
      }catch{if(!cancelled){setRecipientOptions([]);setRecipientKey("")}}
    })()
    return()=>{cancelled=true}
  },[open,reservation?.id,reservation?.property_id,selected?.id,selected?.room_id,selected?.payer_type,selected?.payer_name])

  return{recipientOptions,recipientKey,chooseRecipient}
}
