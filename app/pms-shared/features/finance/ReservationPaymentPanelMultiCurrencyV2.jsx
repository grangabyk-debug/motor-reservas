"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { supabase } from "../../../../lib/supabase"
import { convertCurrency, pricingFromSettings } from "../../core/currency"
import ReservationPaymentChargeSelector from "./ReservationPaymentChargeSelector"
import { allocatePaymentParts, buildChargeLines, paidTotal, roundMoney, selectedBalance, validPayment } from "./paymentChargeUtils"
import s from "./cashActions.module.css"

const RESERVATION_SELECT = "id,numero_reserva,nombre_huesped,fecha_entrada,fecha_salida,precio_total,subtotal,moneda,estado,partner_id"
const METHODS = ["Efectivo", "Transferencia bancaria", "Tarjeta de débito", "Tarjeta de crédito", "Billetera virtual / QR", "Cuenta corriente", "Voucher / Agencia", "Cheque", "Otro"]
const CURRENCIES = ["ARS", "USD"]
const INVALID_PAYMENT_STATES = new Set(["anulado", "cancelado", "void", "rechazado", "cancelled"])

const normalize = value => String(value || "").trim().toLowerCase()
const normalizeCurrency = value => String(value || "ARS").toUpperCase() === "USD" ? "USD" : "ARS"
const isCash = method => normalize(method).includes("efect") || normalize(method) === "cash"
const isAccountCurrent = method => normalize(method) === "cuenta corriente"
const paymentMethods = METHODS.filter(item => !isAccountCurrent(item))
const localIso = date => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
const dueDateFor = partner => {
  const text = String(partner?.billing_terms || "").toLowerCase()
  const days = text.includes("contado") ? 0 : Math.max(0, Number(text.match(/\d+/)?.[0] || 30))
  const date = new Date(); date.setDate(date.getDate() + days); return localIso(date)
}
const numberValue = value => Math.max(0, Number(String(value ?? "").replace(",", ".")) || 0)
const money = (value, currency = "ARS") => new Intl.NumberFormat("es-AR", { style: "currency", currency: normalizeCurrency(currency), maximumFractionDigits: 2 }).format(Number(value) || 0)
const fmtDate = value => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : "—"

function SearchReservations({ propertyId, onSelect }) {
  const [query, setQuery] = useState("")
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const term = query.trim().replace(/[,%()]/g, " ")
        let request = supabase.from("reservas").select(RESERVATION_SELECT).eq("property_id", propertyId).neq("estado", "cancelada").order("created_at", { ascending: false }).limit(12)
        if (term.length >= 2) request = request.or(`nombre_huesped.ilike.%${term}%,numero_reserva.ilike.%${term}%`)
        const reservationRes = await request
        if (reservationRes.error) throw reservationRes.error
        const reservations = reservationRes.data || []
        const ids = reservations.map(row => row.id)
        let payments = []
        if (ids.length) {
          const paymentRes = await supabase.from("pagos").select("reserva_id,monto,estado,refunded_amount").eq("property_id", propertyId).in("reserva_id", ids)
          if (paymentRes.error) throw paymentRes.error
          payments = paymentRes.data || []
        }
        const paidByReservation = new Map()
        for (const payment of payments) {
          if (INVALID_PAYMENT_STATES.has(normalize(payment.estado))) continue
          const id = Number(payment.reserva_id)
          const net = Math.max(0, Number(payment.monto || 0) - Number(payment.refunded_amount || 0))
          paidByReservation.set(id, (paidByReservation.get(id) || 0) + net)
        }
        if (!cancelled) {
          setRows(reservations.map(row => ({ ...row, pending: Math.max(0, Number(row.precio_total || 0) - (paidByReservation.get(Number(row.id)) || 0)) })))
        }
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 220)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query, propertyId])

  return <div className={s.searchBox}>
    <input className={s.searchInput} value={query} onChange={event => setQuery(event.target.value)} autoFocus placeholder="Buscar huésped o número de reserva…" />
    <div className={s.results}>
      {loading ? <div className={s.empty}>Buscando reservas…</div> : rows.length ? rows.map(row => <button key={row.id} type="button" className={s.result} disabled={row.pending <= 0} onClick={() => onSelect(row.id)}>
        <span><b>{row.nombre_huesped}</b><small>{row.numero_reserva || `Reserva ${row.id}`} · {fmtDate(row.fecha_entrada)} → {fmtDate(row.fecha_salida)}</small></span>
        <strong>{row.pending > 0 ? `Pendiente ${money(row.pending, row.moneda)}` : "Pagada"}</strong>
      </button>) : <div className={s.empty}>No hay reservas para mostrar.</div>}
    </div>
  </div>
}

export default function ReservationPaymentPanelMultiCurrencyV2({ propertyId, reservationId, session, onClose, onSaved }) {
  const [reservation, setReservation] = useState(null)
  const [payments, setPayments] = useState([])
  const [folioItems, setFolioItems] = useState([])
  const [allocations, setAllocations] = useState([])
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [method, setMethod] = useState("Efectivo")
  const [paymentCurrency, setPaymentCurrency] = useState("ARS")
  const [amount, setAmount] = useState("")
  const [reference, setReference] = useState("")
  const [note, setNote] = useState("")
  const [split, setSplit] = useState(false)
  const [parts, setParts] = useState([])
  const [cashReceived, setCashReceived] = useState("")
  const [propertySettings, setPropertySettings] = useState({})
  const [automaticFx, setAutomaticFx] = useState(null)
  const [partners, setPartners] = useState([])
  const [receivables, setReceivables] = useState([])
  const [accountPartnerId, setAccountPartnerId] = useState("")
  const [accountDueAt, setAccountDueAt] = useState("")

  const pricing = pricingFromSettings(propertySettings)
  const fxRate = pricing.fxMode === "manual" ? Number(pricing.manualUsdArs || 0) : Number(automaticFx?.rate || 0)
  const fxSource = pricing.fxMode === "manual" ? "Manual" : automaticFx?.source || "BCRA"
  const fxAsOf = pricing.fxMode === "manual" ? new Date().toISOString().slice(0, 10) : automaticFx?.asOf || new Date().toISOString().slice(0, 10)
  const reservationCurrency = normalizeCurrency(reservation?.moneda)

  useEffect(() => {
    if (!propertyId) return
    let cancelled = false
    ;(async () => {
      try {
        const [settingsRes, partnerRes, receivableRes] = await Promise.all([
          supabase.from("property_settings").select("settings").eq("property_id", propertyId).maybeSingle(),
          supabase.from("hotel_partners").select("id,kind,name,tax_id,credit_limit,billing_terms,negotiated_rate_label,active").eq("property_id", propertyId).eq("active", true).order("name"),
          supabase.from("hotel_finance_documents").select("id,partner_id,status,currency,balance,due_at,billing_mode").eq("property_id", propertyId).in("status", ["issued", "partial"]).gt("balance", 0),
        ])
        if (!cancelled && !settingsRes.error) setPropertySettings(settingsRes.data?.settings || {})
        if (!cancelled && !partnerRes.error) setPartners(partnerRes.data || [])
        if (!cancelled && !receivableRes.error) setReceivables(receivableRes.data || [])
        const response = await fetch("/api/hotel/exchange-rate", { cache: "no-store" })
        const json = await response.json()
        if (!cancelled && response.ok) setAutomaticFx(json)
      } catch {
        if (!cancelled) setAutomaticFx(null)
      }
    })()
    return () => { cancelled = true }
  }, [propertyId])

  const toReservation = useCallback((value, fromCurrency) => {
    const from = normalizeCurrency(fromCurrency)
    if (from === reservationCurrency) return roundMoney(value)
    const converted = convertCurrency(value, from, reservationCurrency, fxRate)
    return converted == null ? null : roundMoney(converted)
  }, [reservationCurrency, fxRate])

  const fromReservation = useCallback((value, toCurrency) => {
    const to = normalizeCurrency(toCurrency)
    if (to === reservationCurrency) return roundMoney(value)
    const converted = convertCurrency(value, reservationCurrency, to, fxRate)
    return converted == null ? null : roundMoney(converted)
  }, [reservationCurrency, fxRate])

  const loadReservation = useCallback(async id => {
    if (!propertyId || !id) return
    setLoading(true)
    setError("")
    try {
      const ensured = await supabase.rpc("hl_ensure_reservation_folios", { p_reservation_id: Number(id) })
      if (ensured.error) throw ensured.error
      const [reservationRes, paymentRes, itemRes, allocationRes] = await Promise.all([
        supabase.from("reservas").select(RESERVATION_SELECT).eq("property_id", propertyId).eq("id", Number(id)).single(),
        supabase.from("pagos").select("id,reserva_id,monto,metodo,moneda,payment_currency,payment_amount,fx_rate,fx_source,fx_as_of,estado,refunded_amount,created_at").eq("property_id", propertyId).eq("reserva_id", Number(id)).order("created_at", { ascending: false }),
        supabase.from("hotel_folio_items").select("id,folio_id,source_type,description,detail,service_date,total,currency,status,created_at").eq("property_id", propertyId).eq("reservation_id", Number(id)).eq("status", "active").order("created_at", { ascending: true }),
        supabase.from("hotel_folio_item_payment_allocations").select("folio_item_id,payment_id,amount").eq("property_id", propertyId).eq("reservation_id", Number(id)),
      ])
      if (reservationRes.error) throw reservationRes.error
      if (paymentRes.error) throw paymentRes.error
      if (itemRes.error) throw itemRes.error
      if (allocationRes.error) throw allocationRes.error

      const row = reservationRes.data
      const pays = paymentRes.data || []
      const items = itemRes.data || []
      const itemAllocations = allocationRes.data || []
      const lines = buildChargeLines(items, itemAllocations, pays, row.precio_total)
      const selectable = new Set(lines.filter(line => line.remaining > .009).map(line => String(line.id)))
      const selectedDue = selectedBalance(lines, selectable)
      const code = normalizeCurrency(row.moneda)

      setReservation(row)
      setAccountPartnerId(row.partner_id || "")
      setPayments(pays)
      setFolioItems(items)
      setAllocations(itemAllocations)
      setSelectedIds(selectable)
      setPaymentCurrency(code)
      setAmount(selectedDue ? String(selectedDue) : "")
      setReference("")
      setNote("")
      setSplit(false)
      setParts([])
      setCashReceived("")
      const linkedPartner = partners.find(partner => String(partner.id) === String(row.partner_id || ""))
      setAccountDueAt(linkedPartner ? dueDateFor(linkedPartner) : "")
    } catch (err) {
      setError(err?.message || "No se pudo cargar la reserva para cobrar.")
    } finally {
      setLoading(false)
    }
  }, [propertyId, partners])

  useEffect(() => {
    setReservation(null)
    setPayments([])
    setFolioItems([])
    setAllocations([])
    setSelectedIds(new Set())
    setError("")
    if (reservationId) loadReservation(reservationId)
  }, [reservationId, loadReservation])

  const paid = useMemo(() => paidTotal(payments), [payments])
  const accountPartner = useMemo(() => partners.find(row => String(row.id) === String(accountPartnerId)) || null, [partners, accountPartnerId])
  const accountExposure = useMemo(() => receivables.filter(row => String(row.partner_id) === String(accountPartnerId) && normalizeCurrency(row.currency) === reservationCurrency).reduce((sum, row) => sum + Math.max(0, Number(row.balance) || 0), 0), [receivables, accountPartnerId, reservationCurrency])
  const accountAvailable = accountPartner && Number(accountPartner.credit_limit) > 0 ? Math.max(0, Number(accountPartner.credit_limit) - accountExposure) : null
  const total = Number(reservation?.precio_total || 0)
  const pending = Math.max(0, total - paid)
  const lines = useMemo(() => buildChargeLines(folioItems, allocations, payments, total), [folioItems, allocations, payments, total])
  const selectedDue = useMemo(() => selectedBalance(lines, selectedIds), [lines, selectedIds])
  const selectedLines = useMemo(() => lines.filter(line => selectedIds.has(String(line.id))), [lines, selectedIds])

  const accountMode = !split && isAccountCurrent(method)
  const paymentAmount = accountMode ? selectedDue : numberValue(amount)
  const rawSingleApplied = reservation ? toReservation(paymentAmount, paymentCurrency) : 0
  const roundingTolerance = reservationCurrency === "ARS" && paymentCurrency === "USD" ? Math.max(.011, fxRate / 200) : .011
  const singleApplied = rawSingleApplied != null && Math.abs(rawSingleApplied - selectedDue) <= roundingTolerance ? roundMoney(selectedDue) : rawSingleApplied
  const singleFxReady = accountMode || paymentCurrency === reservationCurrency || fxRate > 0
  const singleValid = accountMode ? Boolean(accountPartnerId && accountDueAt && selectedDue > .009) : singleFxReady && Number(singleApplied) > 0 && Number(singleApplied) <= selectedDue + .011

  const resolvedParts = useMemo(() => {
    if (!split || !reservation || !parts.length) return []
    let used = 0
    return parts.map((part, index) => {
      const code = normalizeCurrency(part.currency)
      const last = index === parts.length - 1
      if (last) {
        const applied = roundMoney(Math.max(0, selectedDue - used))
        const physical = fromReservation(applied, code)
        return { ...part, currency: code, amount: physical == null ? 0 : physical, applied }
      }
      const physical = numberValue(part.amount)
      const applied = toReservation(physical, code)
      if (applied != null) used = roundMoney(used + applied)
      return { ...part, currency: code, amount: physical, applied: applied == null ? 0 : applied }
    })
  }, [split, reservation, parts, selectedDue, toReservation, fromReservation])

  const splitTotal = roundMoney(resolvedParts.reduce((sum, part) => sum + Number(part.applied || 0), 0))
  const splitValid = split && resolvedParts.length >= 2 && resolvedParts.every(part => part.method && part.amount > 0 && part.applied > 0 && (part.currency === reservationCurrency || fxRate > 0)) && new Set(resolvedParts.map(part => part.method)).size === resolvedParts.length && Math.abs(splitTotal - selectedDue) < .011
  const cashPart = split ? resolvedParts.find(part => isCash(part.method)) : isCash(method) ? { currency: paymentCurrency, amount: paymentAmount, applied: singleApplied } : null
  const cashTarget = Number(cashPart?.amount || 0)
  const received = numberValue(cashReceived)
  const cashValid = !cashPart || !cashReceived || received >= cashTarget
  const change = Math.max(0, received - cashTarget)

  function applySelection(next) {
    const due = selectedBalance(lines, next)
    setSelectedIds(next)
    const physical = accountMode ? due : fromReservation(due, paymentCurrency)
    setAmount(physical == null ? "" : String(physical || ""))
    setCashReceived("")
    setError("")
  }

  function toggleCharge(id) {
    const next = new Set(selectedIds)
    next.has(String(id)) ? next.delete(String(id)) : next.add(String(id))
    applySelection(next)
  }

  function toggleAllCharges() {
    const unpaidIds = lines.filter(line => line.remaining > .009).map(line => String(line.id))
    const allSelected = unpaidIds.length && unpaidIds.every(id => selectedIds.has(id))
    applySelection(allSelected ? new Set() : new Set(unpaidIds))
  }

  function changeSingleCurrency(code) {
    const next = normalizeCurrency(code)
    setPaymentCurrency(next)
    const physical = fromReservation(selectedDue, next)
    setAmount(physical == null ? "" : String(physical || ""))
    setCashReceived("")
  }

  function enableSplit() {
    if (selectedDue <= 0) return
    const firstMethod = isAccountCurrent(method) ? "Efectivo" : (method || "Efectivo")
    const secondMethod = paymentMethods.find(item => item !== firstMethod) || "Transferencia bancaria"
    const halfApplied = roundMoney(selectedDue / 2)
    const halfPhysical = fromReservation(halfApplied, paymentCurrency)
    setParts([
      { method: firstMethod, currency: paymentCurrency, amount: halfPhysical == null ? 0 : halfPhysical },
      { method: secondMethod, currency: reservationCurrency, amount: 0 },
    ])
    setSplit(true)
    setCashReceived("")
  }

  function disableSplit() {
    setSplit(false)
    setParts([])
    const physical = fromReservation(selectedDue, paymentCurrency)
    setAmount(physical == null ? "" : String(physical || ""))
    setCashReceived("")
  }

  function updatePart(index, patch) {
    setParts(current => current.map((part, i) => i === index ? { ...part, ...patch } : part))
    setCashReceived("")
  }

  function addPart() {
    setParts(current => {
      if (current.length >= 4) return current
      const used = new Set(current.map(part => part.method))
      const nextMethod = paymentMethods.find(item => !used.has(item))
      if (!nextMethod) return current
      return [...current.slice(0, -1), { method: nextMethod, currency: reservationCurrency, amount: 0 }, current[current.length - 1]]
    })
  }

  function removePart(index) {
    setParts(current => current.length <= 2 ? current : current.filter((_, i) => i !== index))
    setCashReceived("")
  }

  async function save() {
    if (!reservation || saving) return
    setSaving(true)
    setError("")
    try {
      if (selectedDue <= 0) throw new Error("Seleccioná al menos un cargo pendiente para cobrar.")
      if (accountMode) {
        if (!accountPartnerId) throw new Error("Elegí la empresa o agencia que asumirá la cuenta corriente.")
        if (!accountDueAt) throw new Error("Elegí el vencimiento de la cuenta corriente.")
        const allocationRows = allocatePaymentParts(lines, selectedIds, [selectedDue])[0] || []
        const { data: accountResult, error: accountError } = await supabase.rpc("hl_charge_to_partner_account_atomic", {
          p_reservation_id: Number(reservation.id),
          p_partner_id: accountPartnerId,
          p_charge_allocations: allocationRows,
          p_due_at: accountDueAt,
          p_note: note.trim() || null,
        })
        if (accountError) throw accountError
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("hl:pms-payment-updated", { detail: { reservationId: Number(reservation.id), paymentIds: [Number(accountResult?.payment_id)].filter(Number.isFinite) } }))
          window.dispatchEvent(new CustomEvent("hl:pms-data-updated", { detail: { propertyId, tables: ["pagos", "hotel_finance_documents", "hotel_partners", "hotel_folios"] } }))
          window.dispatchEvent(new CustomEvent("hl:pms-toast", { detail: { title: "Pasado a cuenta corriente", message: `${reservation.nombre_huesped} · ${money(selectedDue, reservationCurrency)} a ${accountResult?.partner_name || accountPartner?.name || "empresa"} · vence ${accountResult?.due_at || accountDueAt}.` } }))
        }
        onSaved?.({ payment: { id: accountResult?.payment_id, metodo: "Cuenta corriente", monto: selectedDue, moneda: reservationCurrency }, payments: [], reservation: { ...reservation, partner_id: accountPartnerId }, account: accountResult })
        return
      }
      const finalParts = split ? resolvedParts : [{ method, currency: paymentCurrency, amount: paymentAmount, applied: roundMoney(singleApplied || 0) }]
      if (split && !splitValid) throw new Error("El pago dividido debe completar exactamente los cargos seleccionados y usar medios diferentes.")
      if (!split && !singleValid) throw new Error(`El pago no puede superar ${money(selectedDue, reservationCurrency)}.`)
      if (finalParts.some(part => isCash(part.method)) && !session) throw new Error("Para cobrar en efectivo primero tenés que abrir la caja del turno.")
      if (!cashValid) throw new Error(`El efectivo recibido es menor al importe a cobrar. Faltan ${money(cashTarget - received, cashPart.currency)}.`)

      const userRes = await supabase.auth.getUser()
      if (userRes.error) throw userRes.error
      const user = userRes.data?.user
      if (!user) throw new Error("No se pudo identificar al usuario actual.")

      const allocationRows = allocatePaymentParts(lines, selectedIds, finalParts.map(part => part.applied))
      const chargeLabel = selectedLines.map(line => line.name).join(" + ")
      const payloads = finalParts.map((part, index) => {
        const cross = normalizeCurrency(part.currency) !== reservationCurrency
        const actualCurrency = normalizeCurrency(part.currency)
        const cashLabel = isCash(part.method) && cashReceived ? `Recibido ${money(received, actualCurrency)} · vuelto ${money(Math.max(0, received - part.amount), actualCurrency)}` : null
        return {
          user_id: user.id,
          created_by: user.id,
          property_id: propertyId,
          reserva_id: Number(reservation.id),
          monto: roundMoney(part.applied),
          metodo: part.method,
          moneda: reservationCurrency,
          payment_currency: actualCurrency,
          payment_amount: roundMoney(part.amount),
          fx_rate: cross ? fxRate : 1,
          fx_source: cross ? fxSource : "Misma moneda",
          fx_as_of: cross ? fxAsOf : null,
          estado: "confirmado",
          source: "manual",
          provider: null,
          referencia: reference.trim() || null,
          charge_allocations: allocationRows[index],
          nota: [note.trim() || `Cobro desde Caja diaria · ${reservation.numero_reserva || reservation.id}`, `Cargos: ${chargeLabel}`, cross ? `Recibido ${money(part.amount, actualCurrency)} · aplica ${money(part.applied, reservationCurrency)} · TC ${fxRate}` : null, cashLabel].filter(Boolean).join(" · "),
        }
      })

      const insertRes = await supabase.from("pagos").insert(payloads).select("id,reserva_id,monto,metodo,moneda,payment_currency,payment_amount,fx_rate,estado,created_at")
      if (insertRes.error) throw insertRes.error
      const savedPayments = insertRes.data || []
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("hl:pms-payment-updated", { detail: { reservationId: Number(reservation.id), paymentIds: savedPayments.map(row => row.id) } }))
        window.dispatchEvent(new CustomEvent("hl:pms-toast", { detail: { title: split ? "Pago dividido registrado" : "Pago registrado", message: `${reservation.nombre_huesped} · ${finalParts.map(part => `${part.method} ${money(part.amount, part.currency)}`).join(" + ")}.` } }))
      }
      onSaved?.({ payment: savedPayments[0], payments: savedPayments, reservation })
    } catch (err) {
      setError(err?.message || "No se pudo registrar el pago.")
    } finally {
      setSaving(false)
    }
  }

  const fxCaption = fxRate > 0 ? `1 USD = ${money(fxRate, "ARS")} · ${fxSource}${fxAsOf ? ` · ${fxAsOf}` : ""}` : "Cotización USD/ARS no disponible"

  return <div className={s.overlay} role="dialog" aria-modal="true" aria-label="Cobrar reserva">
    <section className={`${s.panel} ${s.panelWide}`}>
      <header className={s.panelHeader}>
        <div><small>CAJA DIARIA · COBRO MULTIMONEDA</small><h2>{reservation ? `Cobrar a ${reservation.nombre_huesped}` : "Cobrar una reserva"}</h2><p>{reservation ? `Reserva ${reservation.numero_reserva || reservation.id} · saldo contable en ${reservationCurrency}` : "Buscá al huésped o la reserva."}</p></div>
        <button type="button" className={s.close} onClick={onClose}>×</button>
      </header>
      <div className={s.body}>
        {error ? <div className={s.alert}>{error}</div> : null}
        {!reservation ? <SearchReservations propertyId={propertyId} onSelect={loadReservation} /> : loading ? <div className={s.empty}>Cargando cuenta…</div> : <>
          <div className={s.account}>
            <div className={s.accountHeader}><div><b>{reservation.nombre_huesped}</b><small>Reserva {reservation.numero_reserva || reservation.id} · {fmtDate(reservation.fecha_entrada)} → {fmtDate(reservation.fecha_salida)}</small></div><strong>{money(total, reservationCurrency)}</strong></div>
            <ReservationPaymentChargeSelector lines={lines} selectedIds={selectedIds} onToggle={toggleCharge} onToggleAll={toggleAllCharges} selectedTotal={selectedDue} currency={reservationCurrency} />
          </div>

          <div className={s.moneyHero}>
            <article><span>Total</span><b>{money(total, reservationCurrency)}</b><small>Cuenta completa</small></article>
            <article className={s.paid}><span>Pagado</span><b>{money(paid, reservationCurrency)}</b><small>{payments.filter(validPayment).length} pago{payments.filter(validPayment).length === 1 ? "" : "s"}</small></article>
            <article className={s.due}><span>Pendiente</span><b>{money(pending, reservationCurrency)}</b><small>Saldo de la reserva</small></article>
          </div>

          {pending > 0 ? <>
            <p className={s.hint}><b>Moneda de la reserva: {reservationCurrency}.</b> {fxCaption}. Podés recibir ARS o USD y el saldo queda siempre en la moneda original.</p>
            <div className={s.footer} style={{ justifyContent: "space-between", marginTop: 0, marginBottom: 12, paddingTop: 0, borderTop: 0 }}>
              <b style={{ fontSize: 11 }}>{split ? "Pago dividido" : "Un medio de pago"}</b>
              {!accountMode ? <button type="button" className={s.secondary} onClick={split ? disableSplit : enableSplit}>{split ? "Usar un solo medio" : "Dividir pago"}</button> : <span style={{fontSize:10,color:"var(--muted)"}}>No ingresa dinero a Caja</span>}
            </div>

            {!split ? <div className={s.formGrid}>
              <label className={s.field}><span>Medio de pago</span><select value={method} onChange={event => { const next=event.target.value; setMethod(next); setCashReceived(""); if(isAccountCurrent(next)){setPaymentCurrency(reservationCurrency);setAmount(String(selectedDue||""));const linked=partners.find(row=>String(row.id)===String(accountPartnerId||reservation?.partner_id||""));if(linked){setAccountPartnerId(linked.id);setAccountDueAt(dueDateFor(linked))}} }}>{METHODS.map(item => <option key={item}>{item}</option>)}</select></label>
              {accountMode ? <>
                <label className={s.field}><span>Empresa / cuenta corriente</span><select value={accountPartnerId} onChange={event=>{const id=event.target.value;setAccountPartnerId(id);const selectedPartner=partners.find(row=>String(row.id)===String(id));setAccountDueAt(selectedPartner?dueDateFor(selectedPartner):"")}}><option value="">Elegir empresa o agencia</option>{partners.map(row=><option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
                <label className={s.field}><span>Importe a cuenta</span><input value={money(selectedDue,reservationCurrency)} readOnly/><small>Se saldan los cargos seleccionados en la reserva y nace una cuenta por cobrar.</small></label>
                <label className={s.field}><span>Vencimiento</span><input type="date" value={accountDueAt} onChange={event=>setAccountDueAt(event.target.value)}/></label>
                {accountPartner ? <div className={`${s.field} ${s.fieldFull}`} style={{padding:11,border:"1px solid color-mix(in srgb,var(--accent) 18%,var(--line))",borderRadius:12,background:"color-mix(in srgb,var(--accent) 4%,var(--panelSolid))"}}><span>{accountPartner.name}</span><b style={{fontSize:11}}>{accountPartner.billing_terms||"Sin condición de pago"} · saldo actual {money(accountExposure,reservationCurrency)}{accountAvailable!=null?` · crédito disponible ${money(accountAvailable,reservationCurrency)}`:""}</b><small style={{color:"var(--muted)"}}>{accountPartner.negotiated_rate_label||"Cuenta comercial"}</small></div> : null}
                <label className={`${s.field} ${s.fieldFull}`}><span>Nota</span><input value={note} onChange={event => setNote(event.target.value)} placeholder="Opcional · referencia interna de la empresa" /></label>
              </> : <>
                <label className={s.field}><span>Moneda recibida</span><select value={paymentCurrency} onChange={event => changeSingleCurrency(event.target.value)}>{CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></label>
                <label className={s.field}><span>Importe recibido ({paymentCurrency})</span><input type="number" min="0.01" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /><div className={s.quickAmount}><button type="button" onClick={() => { const value = fromReservation(selectedDue, paymentCurrency); setAmount(value == null ? "" : String(value)) }}>Cobrar selección completa</button></div>{paymentCurrency !== reservationCurrency && singleApplied ? <small>Aplica {money(singleApplied, reservationCurrency)} a la reserva.</small> : null}</label>
                <label className={s.field}><span>Referencia</span><input value={reference} onChange={event => setReference(event.target.value)} placeholder="Banco, billetera, cupón…" /></label>
                <label className={`${s.field} ${s.fieldFull}`}><span>Nota</span><input value={note} onChange={event => setNote(event.target.value)} placeholder="Opcional" /></label>
              </>}
            </div> : <div style={{ display: "grid", gap: 10 }}>
              {resolvedParts.map((part, index) => {
                const auto = index === resolvedParts.length - 1
                return <div key={index} className={s.formGrid} style={{ padding: 10, border: "1px solid var(--line)", borderRadius: 12 }}>
                  <label className={s.field}><span>Medio {index + 1}</span><select value={parts[index]?.method || part.method} onChange={event => updatePart(index, { method: event.target.value })}>{paymentMethods.map(item => <option key={item}>{item}</option>)}</select></label>
                  <label className={s.field}><span>Moneda</span><select value={parts[index]?.currency || part.currency} onChange={event => updatePart(index, { currency: event.target.value })}>{CURRENCIES.map(code => <option key={code}>{code}</option>)}</select></label>
                  {auto ? <div className={s.field}><span>Resto automático</span><b>{money(part.amount, part.currency)}</b><small>Aplica {money(part.applied, reservationCurrency)}</small></div> : <label className={s.field}><span>Importe recibido</span><input type="number" min="0.01" step="0.01" value={parts[index]?.amount ?? ""} onChange={event => updatePart(index, { amount: event.target.value })} />{part.currency !== reservationCurrency ? <small>Aplica {money(part.applied, reservationCurrency)}</small> : null}</label>}
                  {parts.length > 2 ? <div className={s.field}><span>&nbsp;</span><button type="button" className={s.secondary} onClick={() => removePart(index)}>Quitar</button></div> : null}
                </div>
              })}
              {parts.length < 4 ? <button type="button" className={s.secondary} onClick={addPart}>+ Agregar otro medio</button> : null}
              <p className={s.hint}>{splitValid ? `Pago completo · ${money(splitTotal, reservationCurrency)}` : `La suma debe completar ${money(selectedDue, reservationCurrency)}.`}</p>
              <div className={s.formGrid}><label className={s.field}><span>Referencia</span><input value={reference} onChange={event => setReference(event.target.value)} /></label><label className={s.field}><span>Nota</span><input value={note} onChange={event => setNote(event.target.value)} /></label></div>
            </div>}

            {accountMode ? <p className={s.hint}><b>Cuenta corriente no es un ingreso de caja.</b> La reserva queda saldada por la empresa/agencia y el importe pasa a Empresas y cuentas como deuda pendiente.</p> : null}
            {cashPart ? <div style={{ marginTop: 12 }} className={s.formGrid}>
              <label className={s.field}><span>Efectivo recibido ({cashPart.currency})</span><input type="number" min="0" step="0.01" value={cashReceived} onChange={event => setCashReceived(event.target.value)} placeholder={String(cashTarget)} /></label>
              <div className={s.field}><span>Vuelto</span><b>{cashReceived ? money(change, cashPart.currency) : "—"}</b><small>Parte en efectivo: {money(cashTarget, cashPart.currency)}</small></div>
            </div> : null}
            {cashPart && !session ? <p className={s.hint}>La caja está cerrada. Abrila antes de registrar un cobro en efectivo.</p> : null}
          </> : <p className={s.hint}>La cuenta está saldada.</p>}

          <div className={s.footer}>
            <button type="button" className={s.secondary} onClick={() => setReservation(null)}>Cambiar reserva</button>
            <button type="button" className={s.secondary} onClick={onClose}>Cancelar</button>
            <button type="button" className={s.save} disabled={saving || pending <= 0 || selectedDue <= 0 || (split ? !splitValid : !singleValid) || !cashValid} onClick={save}>{saving ? "Registrando…" : accountMode ? "Pasar a cuenta corriente" : split ? "Registrar pago dividido" : "Registrar pago"}</button>
          </div>
        </>}
      </div>
    </section>
  </div>
}
