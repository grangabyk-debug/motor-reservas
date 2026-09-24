const text=value=>String(value??"").trim()
const same=(a,b)=>text(a).toLocaleLowerCase("es")===text(b).toLocaleLowerCase("es")
const hasIdentity=guest=>Boolean(guest?.guest_profile_id||text(guest?.email)||text(guest?.phone)||text(guest?.document_number)||guest?.birth_date)

export const isGroupPrimaryPlaceholder=(guest,groupName,isGroup)=>Boolean(
  isGroup&&guest?.role==="primary"&&(
    !text(guest?.full_name)||
    (same(guest?.full_name,groupName)&&!hasIdentity(guest))
  )
)
