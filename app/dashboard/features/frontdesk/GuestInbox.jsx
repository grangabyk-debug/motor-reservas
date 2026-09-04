"use client"

import { useEffect, useMemo, useState } from "react"
import { loadInboxConversations, loadInboxMessages, markInboxRead } from "../../services/inbox"
import s from "./guest-inbox.module.css"

const stamp = value => value ? new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : ""
const channelLabel = value => {
  const v = String(value || "").toLowerCase()
  if (v.includes("instagram")) return "Instagram"
  if (v.includes("whatsapp")) return "WhatsApp"
  if (v.includes("email")) return "Email"
  if (v.includes("booking")) return "Booking"
  if (v.includes("telegram")) return "Telegram"
  return value || "Canal"
}
const channelKey = value => channelLabel(value).toLowerCase()

export default function GuestInbox({ propertyId, conversations: initial = [] }) {
  const [conversations, setConversations] = useState(initial)
  const [selectedId, setSelectedId] = useState("")
  const [thread, setThread] = useState({ conversation: null, messages: [] })
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => setConversations(initial), [initial])
  useEffect(() => {
    if (selectedId || !conversations.length) return
    if (typeof window !== "undefined" && window.innerWidth <= 800) return
    const first = conversations.find(c => Number(c.unread_count || 0) > 0) || conversations[0]
    if (first) setSelectedId(String(first.id))
  }, [conversations, selectedId])

  useEffect(() => {
    let alive = true
    if (!propertyId || !selectedId) {
      setThread({ conversation: null, messages: [] })
      return () => { alive = false }
    }
    setLoading(true)
    loadInboxMessages({ propertyId, conversationId: selectedId })
      .then(async result => {
        if (!alive) return
        setThread(result)
        setError("")
        if (Number(result.conversation?.unread_count || 0) > 0) {
          await markInboxRead({ propertyId, conversationId: selectedId }).catch(() => null)
          if (alive) setConversations(current => current.map(c => String(c.id) === String(selectedId) ? { ...c, unread_count: 0 } : c))
        }
      })
      .catch(e => alive && setError(e?.message || "No se pudo abrir la conversación."))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [propertyId, selectedId])

  useEffect(() => {
    const onKey = event => {
      if (event.key !== "Escape") return
      if (typeof window !== "undefined" && window.innerWidth <= 800 && selectedId) setSelectedId("")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selectedId])

  async function refresh() {
    try {
      setLoading(true)
      setConversations(await loadInboxConversations({ propertyId }))
      setError("")
    } catch (e) {
      setError(e?.message || "No se pudo actualizar la bandeja.")
    } finally {
      setLoading(false)
    }
  }

  const unread = useMemo(() => conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0), [conversations])
  const channelOptions = useMemo(() => [...new Set(conversations.map(item => channelKey(item.channel)).filter(Boolean))], [conversations])
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations.filter(c => {
      const matchesText = !q || `${c.contact_name || ""} ${c.contact_phone || ""} ${c.contact_email || ""} ${c.last_message_text || ""} ${c.channel || ""}`.toLowerCase().includes(q)
      const matchesFilter = filter === "all" || (filter === "unread" ? Number(c.unread_count || 0) > 0 : channelKey(c.channel) === filter)
      return matchesText && matchesFilter
    })
  }, [conversations, query, filter])

  const c = thread.conversation
  function replyWhatsApp() {
    const phone = String(c?.contact_phone || "").replace(/\D/g, "")
    if (phone) window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer")
  }
  function replyEmail() {
    if (c?.contact_email) window.location.href = `mailto:${encodeURIComponent(c.contact_email)}?subject=${encodeURIComponent("Tu estadía")}`
  }

  return <div className={s.page}>
    <aside className={s.listPane}>
      <header>
        <div>
          <small>MENSAJERÍA UNIFICADA</small>
          <h2>Inbox</h2>
          <p>{conversations.length} conversaciones · {unread} sin leer</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading} aria-label="Actualizar mensajes">↻</button>
      </header>

      <label className={s.search}>⌕<input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar huésped o mensaje" /></label>

      <div className={s.filters} aria-label="Filtros de mensajería">
        <button type="button" data-active={filter === "all"} onClick={() => setFilter("all")}>Todos</button>
        <button type="button" data-active={filter === "unread"} onClick={() => setFilter("unread")}>Sin leer {unread > 0 && <b>{unread}</b>}</button>
        {channelOptions.slice(0, 4).map(key => <button type="button" key={key} data-active={filter === key} onClick={() => setFilter(key)}>{key.charAt(0).toUpperCase() + key.slice(1)}</button>)}
      </div>

      {error && !c && <div className={s.error}>{error}</div>}
      <div className={s.list}>
        {visible.map(item => <button type="button" key={item.id} className={`${s.conversation} ${String(item.id) === String(selectedId) ? s.selected : ""}`} onClick={() => setSelectedId(String(item.id))}>
          <span className={s.avatar}>{String(item.contact_name || "H").trim().charAt(0).toUpperCase()}</span>
          <span className={s.preview}>
            <span><b>{item.contact_name || item.contact_phone || item.contact_email || "Contacto"}</b><em>{stamp(item.last_message_at)}</em></span>
            <small><strong>{channelLabel(item.channel)}</strong> · {item.last_message_text || "Sin mensajes"}</small>
          </span>
          {Number(item.unread_count || 0) > 0 && <i>{item.unread_count}</i>}
        </button>)}
        {!visible.length && <div className={s.empty}>No hay conversaciones que coincidan con este filtro.</div>}
      </div>
    </aside>

    <main className={`${s.thread} ${selectedId ? s.threadOpen : ""}`}>
      {c ? <>
        <header>
          <div className={s.contactHead}>
            <button type="button" className={s.back} onClick={() => setSelectedId("")} aria-label="Volver a conversaciones">‹</button>
            <span className={s.avatar}>{String(c.contact_name || "H").trim().charAt(0).toUpperCase()}</span>
            <div>
              <h3>{c.contact_name || c.contact_phone || c.contact_email || "Huésped"}</h3>
              <small><span className={s.channelPill}>{channelLabel(c.channel)}</span>{c.contact_phone ? ` · ${c.contact_phone}` : ""}{c.contact_email ? ` · ${c.contact_email}` : ""}</small>
            </div>
          </div>
          <div className={s.replyActions}>
            {c.contact_phone && <button type="button" onClick={replyWhatsApp}>WhatsApp ↗</button>}
            {c.contact_email && <button type="button" onClick={replyEmail}>Email ↗</button>}
          </div>
        </header>

        {error && <div className={s.error}>{error}</div>}
        <div className={s.messages}>
          {loading && !thread.messages.length ? <div className={s.empty}>Cargando conversación…</div> : thread.messages.map(message => <article key={message.id} className={`${s.message} ${String(message.direction || "").toLowerCase() === "outbound" ? s.outbound : s.inbound}`}>
            <small>{String(message.direction || "").toLowerCase() === "outbound" ? "Hotel" : c.contact_name || "Huésped"} · {stamp(message.occurred_at || message.created_at)}</small>
            <p>{message.text || "Mensaje sin texto"}</p>
          </article>)}
          {!loading && !thread.messages.length && <div className={s.empty}>La conversación todavía no tiene mensajes guardados.</div>}
        </div>
        <footer>
          <span><b>Canal real.</b> Las respuestas se abren en WhatsApp o email hasta que el proveedor conectado confirme envío directo desde el PMS.</span>
          <div>{c.contact_phone && <button type="button" onClick={replyWhatsApp}>Responder por WhatsApp</button>}{c.contact_email && <button type="button" onClick={replyEmail}>Responder por email</button>}</div>
        </footer>
      </> : <div className={s.blank}><span>✦</span><h3>Mensajería del huésped</h3><p>Elegí una conversación. Vas a ver el historial real y los canales disponibles sin mezclar mensajes entre propiedades.</p></div>}
    </main>
  </div>
}