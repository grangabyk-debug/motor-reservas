"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { supabase } from "../../../lib/supabase"
import s from "./stay.module.css"

const ACTIONS = [
  { kind: "towels", icon: "🧺", title: "Pedir toallas", text: "Habitación" },
  { kind: "pillows", icon: "🛏️", title: "Pedir almohadas", text: "Habitación" },
  { kind: "cleaning", icon: "✨", title: "Solicitar limpieza", text: "Habitación" },
  { kind: "maintenance", icon: "🛠️", title: "Reportar un problema", text: "Mantenimiento" },
  { kind: "late_checkout", icon: "🕒", title: "Late check-out", text: "Requiere aprobación" },
  { kind: "other", icon: "💬", title: "Otro pedido", text: "Recepción" },
]

const STATUS = { open: "Recibido", in_progress: "En proceso", resolved: "Resuelto", cancelled: "Cancelado" }
const DEMO = {
  ok: true,
  hotel: { name: "Hotel Demo Aurora", city: "Buenos Aires", motto: "Tu estadía, más simple", welcome: "Estamos para hacerte la estadía más fácil. Pedí, consultá y encontrá todo desde acá." },
  guest: { name: "Gabriel" },
  stay: { number: "AUR-2058", arrival: "2026-09-09", departure: "2026-09-12", status: "alojado", room: { name: "205", type: "Doble Superior" }, late_checkout_confirmed: false },
  guide: {
    wifi_name: "Aurora_Huespedes", wifi_password: "aurora205", contact_whatsapp: "5491100000000", checkin_time: "14:00", checkout_time: "10:00",
    sections: [
      { title: "Desayuno", description: "Todos los días de 7:00 a 10:30 en planta baja.", icon: "☕" },
      { title: "Piscina", description: "Abierta de 9:00 a 20:00. Toallas disponibles en recepción.", icon: "🏊" },
      { title: "Recepción", description: "Disponible las 24 horas para ayudarte.", icon: "🛎️" },
    ],
    house_rules: [{ title: "Horario de descanso", description: "Te pedimos mantener bajo el volumen desde las 23:00." }],
    useful_links: [
      { title: "Café Martínez", description: "Café · a 2 cuadras", url: "https://www.google.com/maps/search/?api=1&query=Cafe+Martinez+Buenos+Aires", icon: "☕" },
      { title: "Parque cercano", description: "Paseo · a 6 minutos", url: "https://www.google.com/maps/search/?api=1&query=parque+Buenos+Aires", icon: "🌳" },
      { title: "Farmacia", description: "Abierta 24 h", url: "https://www.google.com/maps/search/?api=1&query=farmacia+Buenos+Aires", icon: "✚" },
    ],
  },
  account: { currency: "ARS", total: 245000, paid: 200000, balance: 45000 },
  booked_services: [], requests: [], portal: { valid_until: "2026-09-13T03:00:00Z" },
}

const money = (value, currency = "ARS") => new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(value) || 0)
const prettyDate = (value) => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)).replace(".", "") : "—"
const prettyDateTime = (value) => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)).replace(".", "") : "—"

function Section({ id, title, subtitle, children, action }) {
  return <section id={id} className={s.section}><header><div><h2>{title}</h2>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</header>{children}</section>
}

function normalizeSections(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 10).map((item, index) => typeof item === "string"
    ? { title: item, description: "", icon: "•" }
    : { title: item?.title || item?.name || `Información ${index + 1}`, description: item?.description || item?.text || item?.detail || "", icon: item?.icon || "⌂" })
}

function normalizeLinks(value) {
  if (!Array.isArray(value)) return []
  return value.slice(0, 10).map((item, index) => typeof item === "string"
    ? { title: item, description: "", url: "", icon: "📍" }
    : {
        title: item?.title || item?.name || `Lugar ${index + 1}`,
        description: item?.description || item?.text || item?.detail || item?.distance || "",
        url: item?.url || item?.href || item?.link || item?.maps_url || "",
        icon: item?.icon || "📍",
      }).filter((item) => item.title)
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
  const houseRules = useMemo(() => normalizeSections(data?.guide?.house_rules), [data])
  const nearbyPlaces = useMemo(() => normalizeLinks(data?.guide?.nearby_places?.length ? data.guide.nearby_places : data?.guide?.useful_links), [data])
  const firstName = String(data?.guest?.name || "Huésped").trim().split(/\s+/)[0]

  async function copy(value, key) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(""), 1600) } catch {}
  }

  function jump(id) {
    if (typeof document === "undefined") return
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function goHome() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
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
  const maintenanceAction = ACTIONS.find((action) => action.kind === "maintenance")
  const lateAction = ACTIONS.find((action) => action.kind === "late_checkout")
  const otherAction = ACTIONS.find((action) => action.kind === "other")
  const openRequests = (data?.requests || []).filter((request) => !["resolved", "cancelled"].includes(request.status)).length

  return <main className={s.shell}>
    <div className={s.phone}>
      <header className={s.hero}>
        <div className={s.statusBar}><span>{data?.hotel?.city || "Tu estadía"}</span><span>● ● ●</span></div>
        <div className={s.brandRow}>
          <div className={s.logo}>{data?.hotel?.logo ? <img src={data.hotel.logo} alt="" /> : <span>{String(data?.hotel?.name || "H")[0]}</span>}</div>
          <div><small>Bienvenido a</small><strong>{data?.hotel?.name || "Habitación Llena"}</strong></div>
          <em>{demo ? "DEMO" : "ACTIVA"}</em>
        </div>

        <div className={s.welcome}>
          <span>Hola, {firstName} 👋</span>
          <h1>¿En qué te podemos ayudar?</h1>
          <p>{data?.hotel?.welcome || data?.hotel?.motto || "Todo lo que necesitás durante tu estadía, desde el celular."}</p>
        </div>

        <div className={s.stayPill}>
          <span><i>⌂</i><b>Hab. {data?.stay?.room?.name || "—"}</b><small>{data?.stay?.room?.type || ""}</small></span>
          <span><i>◷</i><b>{prettyDate(data?.stay?.arrival)} → {prettyDate(data?.stay?.departure)}</b><small>Salida {data?.guide?.checkout_time || "—"}</small></span>
        </div>
      </header>

      <div className={s.content}>
        <div className={s.appGrid} aria-label="Accesos rápidos">
          <button type="button" onClick={() => jump("mi-estadia")}><i>🏨</i><strong>Mi estadía</strong><small>Reserva y cuenta</small></button>
          <button type="button" onClick={() => jump("pedidos")}><i>🛎️</i><strong>Pedir algo</strong><small>Toallas, limpieza y más</small></button>
          <button type="button" onClick={() => openAction(maintenanceAction)}><i>🛠️</i><strong>Reportar</strong><small>Algo no funciona</small></button>
          <button type="button" onClick={() => openAction(lateAction)} disabled={data?.stay?.late_checkout_confirmed}><i>🕒</i><strong>{data?.stay?.late_checkout_confirmed ? "Late confirmado" : "Late check-out"}</strong><small>{data?.stay?.late_checkout_confirmed ? "Ya fue aprobado" : "Solicitar horario"}</small></button>
          <button type="button" onClick={() => jump("guia")}><i>ℹ️</i><strong>Info útil</strong><small>Horarios y servicios</small></button>
          <button type="button" onClick={() => jump("cerca")}><i>📍</i><strong>Cerca de acá</strong><small>Recomendados del hotel</small></button>
        </div>

        {openRequests > 0 ? <button type="button" className={s.liveBanner} onClick={() => jump("mis-pedidos")}><span>●</span><div><strong>{openRequests === 1 ? "Tenés 1 pedido en curso" : `Tenés ${openRequests} pedidos en curso`}</strong><small>Ver estado de tus solicitudes</small></div><b>›</b></button> : null}

        <Section id="wifi" title="Wi‑Fi" subtitle="Conectate en un toque">
          <div className={s.wifiCard}>
            <div><span>⌁</span><div><small>Red</small><strong>{data?.guide?.wifi_name || "Consultar en recepción"}</strong></div></div>
            <button type="button" disabled={!wifiReady} onClick={() => copy(data?.guide?.wifi_password, "wifi")}><small>Contraseña</small><strong>{data?.guide?.wifi_password || "No configurada"}</strong><em>{copied === "wifi" ? "✓ Copiada" : data?.guide?.wifi_password ? "Tocar para copiar" : ""}</em></button>
          </div>
        </Section>

        <Section id="pedidos" title="¿Necesitás algo?" subtitle="Mandalo directo al equipo del hotel">
          <div className={s.actions}>{ACTIONS.map((action) => <button type="button" key={action.kind} onClick={() => openAction(action)} disabled={action.kind === "late_checkout" && data?.stay?.late_checkout_confirmed}><i>{action.icon}</i><strong>{action.kind === "late_checkout" && data?.stay?.late_checkout_confirmed ? "Late check-out confirmado" : action.title}</strong><small>{action.text}</small><b>›</b></button>)}</div>
        </Section>

        <Section id="mi-estadia" title="Mi estadía" subtitle="Sólo visible desde tu enlace" action={<span className={s.privateBadge}>Privado</span>}>
          <div className={s.reservationCard}>
            <div className={s.reservationTop}><span><small>Reserva</small><strong>{data?.stay?.number || "—"}</strong></span><span><small>Habitación</small><strong>{data?.stay?.room?.name || "—"}</strong></span><span><small>Check-out</small><strong>{data?.guide?.checkout_time || "—"}</strong></span></div>
            <div className={s.account}>
              <div><small>Total estadía</small><strong>{money(data?.account?.total, currency)}</strong></div>
              <div><small>Pagado</small><strong>{money(data?.account?.paid, currency)}</strong></div>
              <div className={Number(data?.account?.balance) > 0 ? s.pending : s.paid}><small>{Number(data?.account?.balance) > 0 ? "Saldo pendiente" : "Cuenta al día"}</small><strong>{money(data?.account?.balance, currency)}</strong></div>
            </div>
          </div>
        </Section>

        <Section id="guia" title="Guía del hotel" subtitle="Lo importante, sin buscar ni llamar">
          {guideSections.length || houseRules.length ? <div className={s.infoGrid}>
            {[...guideSections, ...houseRules].slice(0, 10).map((section, index) => <article key={`${section.title}-${index}`}><span>{section.icon || "⌂"}</span><div><strong>{section.title}</strong>{section.description ? <p>{section.description}</p> : null}</div></article>)}
          </div> : <div className={s.empty}>El hotel todavía no cargó información adicional.</div>}
        </Section>

        <Section id="cerca" title="Cerca de acá" subtitle="Lugares recomendados por el hotel">
          {nearbyPlaces.length ? <div className={s.nearbyGrid}>{nearbyPlaces.map((place, index) => place.url
            ? <a key={`${place.title}-${index}`} href={place.url} target="_blank" rel="noreferrer"><i>{place.icon}</i><div><strong>{place.title}</strong><small>{place.description || "Abrir ubicación"}</small></div><b>↗</b></a>
            : <article key={`${place.title}-${index}`}><i>{place.icon}</i><div><strong>{place.title}</strong><small>{place.description}</small></div></article>)}</div>
            : <div className={s.empty}>El hotel todavía no cargó lugares recomendados.</div>}
        </Section>

        <Section id="mis-pedidos" title="Mis pedidos" subtitle="Seguimiento en tiempo real">
          {(data?.requests || []).length ? <div className={s.requestList}>{data.requests.slice(0, 8).map((request) => <article key={request.id}><span className={s.requestIcon}>{request.kind === "maintenance" ? "🛠️" : request.kind === "late_checkout" ? "🕒" : "✓"}</span><div><strong>{request.title}</strong><small>{request.area === "reception" ? "Recepción" : request.area === "maintenance" ? "Mantenimiento" : request.area === "housekeeping" ? "Habitación" : request.area || "Hotel"} · {prettyDateTime(request.created_at)}</small></div><em data-status={request.status}>{STATUS[request.status] || request.status}</em></article>)}</div> : <div className={s.empty}>Todavía no hiciste pedidos desde este portal.</div>}
        </Section>

        <Section id="ayuda" title="¿Preferís hablar con alguien?" subtitle="Recepción también está disponible">
          <div className={s.helpCard}>
            <div><span>💬</span><div><strong>Estamos para ayudarte</strong><small>Consultas, recomendaciones o cualquier otra cosa.</small></div></div>
            <div className={s.helpButtons}>{whatsapp ? <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer">WhatsApp</a> : null}<button type="button" onClick={() => openAction(otherAction)}>Escribir a recepción</button></div>
          </div>
        </Section>

        <footer className={s.footer}>Acceso privado de tu estadía · válido hasta {prettyDateTime(data?.portal?.valid_until)}.</footer>
      </div>

      <nav className={s.dock} aria-label="Navegación del portal">
        <button type="button" onClick={goHome}><i>⌂</i><span>Inicio</span></button>
        <button type="button" onClick={() => jump("pedidos")}><i>🛎</i><span>Pedidos</span></button>
        <button type="button" onClick={() => jump("guia")}><i>ℹ</i><span>Info</span></button>
        <button type="button" onClick={() => jump("ayuda")}><i>◉</i><span>Ayuda</span></button>
      </nav>
    </div>

    {selected ? <div className={s.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setSelected(null) }}><form className={s.sheet} onSubmit={submitRequest}><div className={s.sheetHandle} /><button type="button" className={s.sheetClose} onClick={() => !sending && setSelected(null)}>×</button><span className={s.sheetIcon}>{selected.icon}</span><small>{selected.text}</small><h2>{selected.title}</h2>{selected.kind === "late_checkout" ? <p>Decinos hasta qué hora te gustaría quedarte. Recepción revisará disponibilidad y posibles cargos antes de confirmar.</p> : selected.kind === "maintenance" ? <p>Contanos qué está fallando. El pedido se enviará asociado a tu habitación.</p> : <p>Podés agregar un detalle para que el equipo sepa exactamente qué necesitás.</p>}<textarea value={detail} onChange={(event) => setDetail(event.target.value)} maxLength={1000} placeholder={selected.kind === "late_checkout" ? "Ej: si es posible, hasta las 14:00" : selected.kind === "maintenance" ? "Ej: el aire prende pero no enfría" : "Detalle opcional"} rows={4} />{notice ? <div className={s.notice}>{notice}</div> : null}<button className={s.send} type="submit" disabled={sending}>{sending ? "Enviando…" : selected.kind === "late_checkout" ? "Enviar solicitud a recepción" : "Enviar pedido"}</button>{selected.kind === "late_checkout" ? <small className={s.disclaimer}>Enviar la solicitud no modifica tu horario de salida hasta que el hotel la apruebe.</small> : null}</form></div> : null}
  </main>
}
