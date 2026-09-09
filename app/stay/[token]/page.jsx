"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"
import s from "./stay.module.css"

const ACTIONS = [
  { kind: "towels", icon: "🧺", title: "Pedir toallas", text: "Housekeeping" },
  { kind: "pillows", icon: "🛏️", title: "Pedir almohadas", text: "Housekeeping" },
  { kind: "cleaning", icon: "✨", title: "Solicitar limpieza", text: "Housekeeping" },
  { kind: "maintenance", icon: "🛠️", title: "Algo no funciona", text: "Mantenimiento" },
  { kind: "late_checkout", icon: "🕒", title: "Pedir late check-out", text: "Requiere aprobación" },
  { kind: "other", icon: "💬", title: "Otro pedido", text: "Recepción" },
]

const STATUS = { open: "Recibido", in_progress: "En proceso", resolved: "Resuelto", cancelled: "Cancelado" }
const DEMO = {
  ok: true,
  hotel: { name: "Hotel Demo Aurora", city: "Buenos Aires", motto: "Tu estadía, más simple", welcome: "Todo lo que necesitás durante tu estadía, desde el celular." },
  guest: { name: "Martina" },
  stay: { number: "AUR-2058", arrival: "2026-09-09", departure: "2026-09-12", status: "alojado", room: { name: "205", type: "Doble Superior" }, late_checkout_confirmed: false },
  guide: { wifi_name: "Aurora_Huespedes", wifi_password: "aurora205", contact_whatsapp: "5491100000000", checkin_time: "14:00", checkout_time: "10:00", sections: [{ title: "Desayuno", description: "De 7:00 a 10:30 en planta baja." }, { title: "Piscina", description: "Abierta de 9:00 a 20:00." }], house_rules: [], useful_links: [] },
  account: { currency: "ARS", total: 245000, paid: 200000, balance: 45000 },
  booked_services: [], requests: [], portal: { valid_until: "2026-09-13T03:00:00Z" },
}

const money = (value, currency = "ARS") => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0)
const prettyDate = (value) => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)).replace(".", "") : "—"
const prettyDateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "") : "—"

function Section({ title, children, action }) {
  return <section className={s.section}><header><h2>{title}</h2>{action}</header>{children}</section>
}

function normalizeSections(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 8).map((item, index) => typeof item === "string" ? { title: item, description: "" } : { title: item?.title || item?.name || `Información ${index + 1}`, description: item?.description || item?.text || item?.detail || "" })
}

export default function StayPortalPage() {
  const params = useParams()
  const token = String(params?.token || "")
  const demo = token === "demo"
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState("")
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState("")
  const [copied, setCopied] = useState("")

  async function load() {
    if (!token) return
    setLoading(true)
    setError("")
    if (demo) { setData(DEMO); setLoading(false); return }
    const { data: snapshot, error: rpcError } = await supabase.rpc("hl_guest_stay_portal_snapshot", { p_token: token })
    if (rpcError) setError("No pudimos abrir tu portal en este momento.")
    else if (!snapshot?.ok) setError(snapshot?.error === "access_expired" ? "Este acceso ya venció porque la estadía terminó o el hotel lo desactivó." : "El enlace no es válido.")
    else setData(snapshot)
    setLoading(false)
  }

  useEffect(() => { load() }, [token])

  const guideSections = useMemo(() => normalizeSections(data?.guide?.sections), [data])
  const firstName = String(data?.guest?.name || "Huésped").trim().split(/\s+/)[0]

  async function copy(value, key) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(""), 1600) } catch {}
  }

  function openAction(action) {
    setSelected(action)
    setDetail("")
    setNotice("")
  }

  async function submitRequest(event) {
    event.preventDefault()
    if (!selected || sending) return
    if (selected.kind === "maintenance" && !detail.trim()) { setNotice("Contanos brevemente qué no funciona."); return }
    setSending(true)
    setNotice("")
    if (demo) {
      const fake = { id: `demo-${Date.now()}`, kind: selected.kind, title: selected.title, status: "open", area: selected.text, created_at: new Date().toISOString() }
      setData((current) => ({ ...current, requests: [fake, ...(current.requests || [])] }))
      setNotice(selected.kind === "late_checkout" ? "Solicitud enviada a Recepción. Tu horario de salida no cambia hasta que el hotel la apruebe." : "Pedido enviado. El equipo del hotel ya puede verlo.")
      setSending(false)
      setTimeout(() => setSelected(null), 1100)
      return
    }
    const { data: result, error: rpcError } = await supabase.rpc("hl_guest_stay_portal_request", { p_token: token, p_kind: selected.kind, p_detail: detail.trim() || null })
    if (rpcError || !result?.ok) setNotice("No pudimos enviar el pedido. Probá de nuevo o contactá a recepción.")
    else {
      setNotice(result.already_open ? "Ese pedido ya está abierto y el hotel lo tiene registrado." : selected.kind === "late_checkout" ? "Solicitud enviada a Recepción. Tu salida no cambia hasta que la aprueben." : "Pedido enviado. El equipo del hotel ya puede verlo.")
      await load()
      setTimeout(() => setSelected(null), 1200)
    }
    setSending(false)
  }

  if (loading) return <main className={s.shell}><div className={s.loading}><span />Preparando tu estadía…</div></main>
  if (error) return <main className={s.shell}><section className={s.expired}><div>⌛</div><h1>Portal no disponible</h1><p>{error}</p><small>Si seguís alojado, pedí un enlace nuevo en recepción.</small></section></main>

  const wifiReady = data?.guide?.wifi_name || data?.guide?.wifi_password
  const whatsapp = String(data?.guide?.contact_whatsapp || "").replace(/\D/g, "")
  const currency = data?.account?.currency || "ARS"

  return <main className={s.shell}>
    <div className={s.phone}>
      <header className={s.hero}>
        <div className={s.brandRow}>
          <div className={s.logo}>{data?.hotel?.logo ? <img src={data.hotel.logo} alt="" /> : <span>{String(data?.hotel?.name || "H")[0]}</span>}</div>
          <div><small>{data?.hotel?.city || "Tu hotel"}</small><strong>{data?.hotel?.name || "Habitación Llena"}</strong></div>
          {demo ? <em>PROTOTIPO</em> : <em>ESTADÍA ACTIVA</em>}
        </div>
        <div className={s.welcome}><span>Hola, {firstName} 👋</span><h1>Todo para tu estadía</h1><p>{data?.hotel?.welcome || data?.hotel?.motto || "Información y pedidos del hotel, en un solo lugar."}</p></div>
        <div className={s.stayCard}>
          <div><small>Habitación</small><strong>{data?.stay?.room?.name || "—"}</strong><span>{data?.stay?.room?.type || ""}</span></div>
          <div><small>Tu estadía</small><strong>{prettyDate(data?.stay?.arrival)} → {prettyDate(data?.stay?.departure)}</strong><span>Check-out {data?.guide?.checkout_time || "—"}</span></div>
        </div>
      </header>

      <div className={s.content}>
        <Section title="Wi‑Fi">
          <div className={s.wifiCard}>
            <div><span>⌁</span><div><small>Red</small><strong>{data?.guide?.wifi_name || "Consultar en recepción"}</strong></div></div>
            <button type="button" disabled={!wifiReady} onClick={() => copy(data?.guide?.wifi_password, "wifi")}><small>Clave</small><strong>{data?.guide?.wifi_password || "No configurada"}</strong><em>{copied === "wifi" ? "✓ Copiada" : data?.guide?.wifi_password ? "Tocar para copiar" : ""}</em></button>
          </div>
        </Section>

        <Section title="¿Qué necesitás?">
          <div className={s.actions}>{ACTIONS.map((action) => <button type="button" key={action.kind} onClick={() => openAction(action)} disabled={action.kind === "late_checkout" && data?.stay?.late_checkout_confirmed}><i>{action.icon}</i><strong>{action.kind === "late_checkout" && data?.stay?.late_checkout_confirmed ? "Late check-out confirmado" : action.title}</strong><small>{action.text}</small></button>)}</div>
        </Section>

        <Section title="Mi cuenta" action={<span className={s.privateBadge}>Sólo tu reserva</span>}>
          <div className={s.account}>
            <div><small>Total estadía</small><strong>{money(data?.account?.total, currency)}</strong></div>
            <div><small>Pagado</small><strong>{money(data?.account?.paid, currency)}</strong></div>
            <div className={Number(data?.account?.balance) > 0 ? s.pending : s.paid}><small>{Number(data?.account?.balance) > 0 ? "Saldo pendiente" : "Cuenta al día"}</small><strong>{money(data?.account?.balance, currency)}</strong></div>
          </div>
        </Section>

        {guideSections.length ? <Section title="Información del hotel"><div className={s.infoGrid}>{guideSections.map((section, index) => <article key={`${section.title}-${index}`}><span>⌂</span><div><strong>{section.title}</strong>{section.description ? <p>{section.description}</p> : null}</div></article>)}</div></Section> : null}

        <Section title="Mis pedidos">
          {(data?.requests || []).length ? <div className={s.requestList}>{data.requests.slice(0, 8).map((request) => <article key={request.id}><span className={s.requestIcon}>{request.kind === "maintenance" ? "🛠️" : request.kind === "late_checkout" ? "🕒" : "✓"}</span><div><strong>{request.title}</strong><small>{request.area === "reception" ? "Recepción" : request.area === "maintenance" ? "Mantenimiento" : request.area === "housekeeping" ? "Housekeeping" : request.area || "Hotel"} · {prettyDateTime(request.created_at)}</small></div><em data-status={request.status}>{STATUS[request.status] || request.status}</em></article>)}</div> : <div className={s.empty}>Todavía no hiciste pedidos desde este portal.</div>}
        </Section>

        <Section title="Datos útiles">
          <div className={s.useful}>
            <span><small>Check-in</small><strong>{data?.guide?.checkin_time || "—"}</strong></span>
            <span><small>Check-out</small><strong>{data?.guide?.checkout_time || "—"}</strong></span>
            <span><small>Reserva</small><strong>{data?.stay?.number || "—"}</strong></span>
          </div>
          {whatsapp ? <a className={s.contact} href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">💬 Hablar con recepción por WhatsApp</a> : null}
        </Section>

        <footer className={s.footer}>Este portal pertenece únicamente a tu estadía y vence automáticamente. Acceso válido hasta {prettyDateTime(data?.portal?.valid_until)}.</footer>
      </div>
    </div>

    {selected ? <div className={s.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setSelected(null) }}><form className={s.sheet} onSubmit={submitRequest}><button type="button" className={s.sheetClose} onClick={() => !sending && setSelected(null)}>×</button><span className={s.sheetIcon}>{selected.icon}</span><small>{selected.text}</small><h2>{selected.title}</h2>{selected.kind === "late_checkout" ? <p>Decinos hasta qué hora te gustaría quedarte. Recepción revisará disponibilidad y posibles cargos antes de confirmar.</p> : selected.kind === "maintenance" ? <p>Contanos qué está fallando. El pedido se enviará asociado a tu habitación.</p> : <p>Podés agregar un detalle para que el equipo sepa exactamente qué necesitás.</p>}<textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={1000} placeholder={selected.kind === "late_checkout" ? "Ej: si es posible, hasta las 14:00" : selected.kind === "maintenance" ? "Ej: el aire prende pero no enfría" : "Detalle opcional"} rows={4} />{notice ? <div className={s.notice}>{notice}</div> : null}<button className={s.send} type="submit" disabled={sending}>{sending ? "Enviando…" : selected.kind === "late_checkout" ? "Enviar solicitud a recepción" : "Enviar pedido"}</button>{selected.kind === "late_checkout" ? <small className={s.disclaimer}>Enviar la solicitud no modifica tu horario de salida hasta que el hotel la apruebe.</small> : null}</form></div> : null}
  </main>
}
