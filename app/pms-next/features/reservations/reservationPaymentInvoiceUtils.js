export const validPayment=row=>!["anulado","cancelado","void","rechazado","cancelled"].includes(String(row?.estado||"").toLowerCase())

export const netPayment=row=>validPayment(row)?Math.max(0,Number(row?.monto||0)-Number(row?.refunded_amount||0)):0

export const paymentCurrency=row=>String(row?.payment_currency||row?.moneda||"ARS").toUpperCase()

export const paymentPhysicalNet=row=>{
  const accountingGross=Math.max(0,Number(row?.monto||0))
  const accountingNet=netPayment(row)
  const physicalGross=Math.max(0,Number(row?.payment_amount??row?.monto)||0)
  return accountingGross>0?physicalGross*Math.min(1,accountingNet/accountingGross):physicalGross
}

export const allocatedPhysicalAmount=(payment,allocationAmount)=>{
  const accountingNet=netPayment(payment)
  const physicalNet=paymentPhysicalNet(payment)
  const allocated=Math.max(0,Number(allocationAmount)||0)
  return accountingNet>0?physicalNet*Math.min(1,allocated/accountingNet):0
}
