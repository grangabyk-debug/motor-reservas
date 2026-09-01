"use client"

import{REGIONAL_COUNTRIES,SUPPORTED_CURRENCIES,commerceRegion,regionalPatch,regionalProviderLabel,regionalProviderState}from"../../core/regionalCommerce"
import s from"./regional-commerce.module.css"

const LOCALES=["es-AR","pt-BR","es-CL","es-CO","es-PE","es-UY","es-MX","es-ES","en-US","es"]
const TIMEZONES=["America/Argentina/Buenos_Aires","America/Sao_Paulo","America/Santiago","America/Bogota","America/Lima","America/Montevideo","America/Mexico_City","Europe/Madrid","America/New_York","UTC"]

function Provider({name,provider,ops}){const state=regionalProviderState(provider,ops),label=regionalProviderLabel(provider,ops);return <article className={s.provider} data-state={state}><div><b>{name}</b><small>{label}</small></div><span>{state==="available"?"DISPONIBLE":state==="region"?"OTRA REGIÓN":"SEGÚN PAÍS"}</span></article>}

export default function RegionalCommerceSettings({ops={},canManage,onChange}){
  const region=commerceRegion(ops)
  const setRegion=patch=>onChange?.({region:{...(ops.region||{}),...patch}})
  const changeCountry=country=>onChange?.(regionalPatch(country,ops))
  return <section className={s.card}>
    <header><div><small>REGIÓN & COMERCIO</small><h3>{region.name}</h3><p>Moneda, zona horaria y proveedores se adaptan a la propiedad sin mezclar reglas locales con la capa internacional.</p></div><span>{region.country==="AR"?"ARGENTINA FIRST":"GLOBAL READY"}</span></header>
    <div className={s.fields}>
      <label>País<select disabled={!canManage} value={region.country} onChange={e=>changeCountry(e.target.value)}>{REGIONAL_COUNTRIES.map(item=><option key={item.country} value={item.country}>{item.name}</option>)}</select></label>
      <label>Moneda base<select disabled={!canManage} value={region.currency} onChange={e=>onChange?.({currency:e.target.value})}>{SUPPORTED_CURRENCIES.map(currency=><option key={currency}>{currency}</option>)}</select></label>
      <label>Locale<select disabled={!canManage} value={region.locale} onChange={e=>setRegion({locale:e.target.value})}>{LOCALES.map(locale=><option key={locale}>{locale}</option>)}</select></label>
      <label>Zona horaria<select disabled={!canManage} value={region.timezone} onChange={e=>setRegion({timezone:e.target.value})}>{TIMEZONES.map(zone=><option key={zone}>{zone}</option>)}</select></label>
    </div>
    <div className={s.providers}><Provider name="Mercado Pago" provider="mercadopago" ops={ops}/><Provider name="Stripe" provider="stripe" ops={ops}/><Provider name="ARCA" provider="arca" ops={ops}/></div>
    <footer><div><small>COBROS</small><b>{region.payments.includes("mercadopago")?"Mercado Pago":region.payments.includes("stripe")?"Stripe":"Proveedor según país"}</b></div><div><small>FISCAL</small><b>{region.country==="AR"?"ARCA":"Proveedor fiscal local"}</b></div><p>Elegir región prepara el comportamiento del PMS. No conecta cuentas ni almacena credenciales del proveedor.</p></footer>
  </section>
}
