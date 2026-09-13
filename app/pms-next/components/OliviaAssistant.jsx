"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "../../../lib/supabase"
import styles from "./OliviaAssistant.module.css"
import { OLIVIA_SIZE, OLIVIA_PALETTE_B64, OLIVIA_INDEX_B64 } from "./oliviaAvatarData"

const STARTERS = [
  "¿Cómo viene la ocupación hoy?",
  "¿Qué requiere atención ahora?",
  "¿Cómo creo una reserva?",
  "¿Qué puedo mejorar para vender más?",
]

const ACTION_LABELS = {
  create_guest_request: "Registrar petición",
  create_maintenance_ticket: "Crear mantenimiento",
}

const STATUS_LABELS = {
  proposed: "Pendiente de aprobación",
  approved: "Aprobada",
  rejected: "Rechazada",
  executed: "Ejecutada",
  failed: "Falló la ejecución",
}

let oliviaPixelCache = null

function decodeBase64Bytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function getOliviaPixels() {
  if (oliviaPixelCache) return oliviaPixelCache
  const palette = decodeBase64Bytes(OLIVIA_PALETTE_B64)
  const indexes = decodeBase64Bytes(OLIVIA_INDEX_B64)
  const rgba = new Uint8ClampedArray(OLIVIA_SIZE * OLIVIA_SIZE * 4)
  for (let i = 0; i < indexes.length; i += 1) {
    const paletteOffset = indexes[i] * 4
    const pixelOffset = i * 4
    rgba[pixelOffset] = palette[paletteOffset]
    rgba[pixelOffset + 1] = palette[paletteOffset + 1]
    rgba[pixelOffset + 2] = palette[paletteOffset + 2]
    rgba[pixelOffset + 3] = palette[paletteOffset + 3]
  }
  oliviaPixelCache = rgba
  return rgba
}

function greeting(propertyName) {
  const property = String(propertyName || "tu alojamiento").trim()
  return `Hola, soy OlivIA. Estoy para ayudarte con ${property}: puedo leer la operación de hoy, explicarte cómo usar Habitación Llena y preparar acciones para que las apruebes.`
}

function OliviaWordmark() {
  return <><span>Oliv</span><span className={styles.aiAccent}>IA</span></>
}

function paintFallback(canvas) {
  const ctx = canvas?.getContext?.("2d")
  if (!ctx) return
  canvas.width = OLIVIA_SIZE
  canvas.height = OLIVIA_SIZE
  ctx.clearRect(0, 0, OLIVIA_SIZE, OLIVIA_SIZE)
  ctx.fillStyle = "#f2e8f8"
  ctx.beginPath()
  ctx.arc(48, 48, 46, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = "#7c3aed"
  ctx.font = "700 28px system-ui, sans-serif"
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("IA", 48, 49)
}

function OliviaPhoto({ className = "", alt = "" }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext?.("2d")
    if (!canvas || !ctx) return
    try {
      canvas.width = OLIVIA_SIZE
      canvas.height = OLIVIA_SIZE
      ctx.clearRect(0, 0, OLIVIA_SIZE, OLIVIA_SIZE)
      ctx.putImageData(new ImageData(new Uint8ClampedArray(getOliviaPixels()), OLIVIA_SIZE, OLIVIA_SIZE), 0, 0)
    } catch (error) {
      console.error("OlivIA avatar render failed", error)
      paintFallback(canvas)
    }
  }, [])
  return <canvas ref={canvasRef} className={className} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : "true"} />
}

function actionSummary(action) {
  const payload = action?.payload || {}
  const parts = []
  if (payload.reservation_id) parts.push(payload.reservation_number ? `Reserva ${payload.reservation_number}` : `Reserva ${payload.reservation_id}`)
  if (payload.room_id) parts.push(`Habitación ${payload.room_name || `#${payload.room_id}`}`)
  if (payload.priority) parts.push(`Prioridad ${payload.priority}`)
  return parts.join(" · ")
}

function ActionCard({ action, busy, error, onApprove, onReject, onExecute }) {
  if (!action?.id) return null
  const payload = action.payload || {}
  const status = String(action.status || "proposed")
  const statusColor = status === "executed" ? "#207a4f" : status === "rejected" || status === "failed" ? "#a04444" : status === "approved" ? "#7a5b16" : "#5f4a7d"
  const detail = payload.detail || payload.description || ""
  const executionError = action?.execution_result?.error

  return (
    <div style={{ marginTop: 8, width: "min(100%, 295px)", border: "1px solid rgba(74,55,96,.16)", borderRadius: 14, background: "#fff", boxShadow: "0 6px 18px rgba(42,52,66,.07)", overflow: "hidden" }}>
      <div style={{ padding: "10px 11px 8px", background: "linear-gradient(135deg,#faf7ff,#fffaf4)" }}>
        <small style={{ display: "block", color: "#7b6d88", fontSize: 9, fontWeight: 800, letterSpacing: ".08em" }}>ACCIÓN PROPUESTA</small>
        <strong style={{ display: "block", marginTop: 3, color: "#2f3542", fontSize: 12.5 }}>{ACTION_LABELS[action.action_type] || "Acción operativa"}</strong>
        <div style={{ marginTop: 5, color: "#3f4857", fontSize: 11.5, fontWeight: 750 }}>{payload.title || "Sin título"}</div>
        {detail ? <p style={{ margin: "4px 0 0", color: "#69717d", fontSize: 10.5, lineHeight: 1.4 }}>{detail}</p> : null}
        {actionSummary(action) ? <small style={{ display: "block", marginTop: 6, color: "#8b8f97", fontSize: 9.5 }}>{actionSummary(action)}</small> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "8px 10px", borderTop: "1px solid rgba(74,55,96,.09)" }}>
        <span style={{ color: statusColor, fontSize: 9.5, fontWeight: 800 }}>{STATUS_LABELS[status] || status}</span>
        <div style={{ display: "flex", gap: 5 }}>
          {status === "proposed" ? <>
            <button type="button" disabled={busy} onClick={onReject} style={{ padding: "6px 8px", border: "1px solid #e2d8d8", borderRadius: 8, background: "#fff", color: "#915252", font: "inherit", fontSize: 9.5, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? .55 : 1 }}>Rechazar</button>
            <button type="button" disabled={busy} onClick={onApprove} style={{ padding: "6px 9px", border: 0, borderRadius: 8, background: "#584078", color: "#fff", font: "inherit", fontSize: 9.5, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? .55 : 1 }}>Aprobar</button>
          </> : null}
          {status === "approved" ? <button type="button" disabled={busy} onClick={onExecute} style={{ padding: "6px 9px", border: 0, borderRadius: 8, background: "#243a57", color: "#fff", font: "inherit", fontSize: 9.5, fontWeight: 800, cursor: busy ? "default" : "pointer", opacity: busy ? .55 : 1 }}>{busy ? "Ejecutando…" : "Ejecutar"}</button> : null}
        </div>
      </div>
      {error || executionError ? <div style={{ padding: "0 10px 8px", color: "#a04444", fontSize: 9.5 }}>{error || executionError}</div> : null}
      {status === "executed" ? <div style={{ padding: "0 10px 9px", color: "#52705f", fontSize: 9.5 }}>Listo. La acción quedó registrada y auditada en el PMS.</div> : null}
    </div>
  )
}

export default function OliviaAssistant({ propertyId, propertyName, context, onHide }) {
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [actionBusy, setActionBusy] = useState("")
  const [messages, setMessages] = useState(() => [{ id: "welcome", role: "assistant", text: greeting(propertyName) }])
  const endRef = useRef(null)

  useEffect(() => {
    setMessages([{ id: `welcome-${propertyId || "default"}`, role: "assistant", text: greeting(propertyName) }])
    setInput("")
    setSending(false)
    setActionBusy("")
  }, [propertyId, propertyName])

  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, open, sending])

  function patchActionMessage(messageId, action, actionError = "") {
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, action, actionError } : message))
  }

  async function reviewAction(messageId, action, approve) {
    if (!action?.id || actionBusy) return
    setActionBusy(`${action.id}:${approve ? "approve" : "reject"}`)
    patchActionMessage(messageId, action, "")
    try {
      const { data, error } = await supabase.rpc("hl_olivia_approve_action", {
        p_property_id: propertyId,
        p_action_id: action.id,
        p_approve: approve,
      })
      if (error) throw error
      patchActionMessage(messageId, data || action, "")
    } catch (error) {
      patchActionMessage(messageId, action, error?.message || "No pude revisar esta acción.")
    } finally {
      setActionBusy("")
    }
  }

  async function executeAction(messageId, action) {
    if (!action?.id || actionBusy) return
    setActionBusy(`${action.id}:execute`)
    patchActionMessage(messageId, action, "")
    try {
      const { data, error } = await supabase.rpc("hl_olivia_execute_action", {
        p_property_id: propertyId,
        p_action_id: action.id,
      })
      if (error) throw error
      const executed = data || action
      patchActionMessage(messageId, executed, "")
      if (executed?.status === "executed") {
        setMessages((current) => [...current, {
          id: `done-${Date.now()}`,
          role: "assistant",
          text: "Listo, ya quedó hecho y registrado en el PMS. ¿Necesitás que te ayude con algo más?",
        }])
      }
    } catch (error) {
      patchActionMessage(messageId, action, error?.message || "No pude ejecutar esta acción.")
    } finally {
      setActionBusy("")
    }
  }

  async function ask(rawQuestion) {
    const question = String(rawQuestion || "").trim()
    if (!question || sending) return

    const history = messages.filter((message) => !message.error).slice(-8).map((message) => ({ role: message.role, text: message.text }))
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: question }])
    setInput("")
    setSending(true)

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      const accessToken = sessionData?.session?.access_token
      if (!accessToken || !propertyId) throw new Error("Tu sesión del PMS no está disponible. Volvé a iniciar sesión.")

      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ propertyId, question, context, history }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No pude responder en este momento.")

      setMessages((current) => [...current, {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        text: data?.answer || "No pude generar una respuesta en este momento.",
        action: data?.action || null,
        actionError: "",
      }])
    } catch (error) {
      setMessages((current) => [...current, {
        id: `error-${Date.now()}`,
        role: "assistant",
        text: error?.message || "No pude conectarme. Probá de nuevo en unos segundos.",
        error: true,
      }])
    } finally {
      setSending(false)
    }
  }

  function submit(event) {
    event.preventDefault()
    ask(input)
  }

  function openAssistant() {
    setOpen(true)
    setNudge(false)
  }

  return (
    <div className={styles.root}>
      {open ? (
        <section className={styles.panel} aria-label="OlivIA, asistente de Habitación Llena">
          <header className={styles.header}>
            <div className={styles.identity}>
              <span className={styles.avatar} aria-hidden="true"><OliviaPhoto className={styles.avatarImage} /></span>
              <span><small>ASISTENTE DEL PMS</small><strong><OliviaWordmark /></strong><em><i /> En línea</em></span>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.hideButton} onClick={onHide} title="Ocultar OlivIA de este dashboard">Ocultar</button>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Minimizar OlivIA">×</button>
            </div>
          </header>

          <div className={styles.messages} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`${styles.messageRow} ${styles[message.role]}`}>
                {message.role === "assistant" ? <span className={styles.miniAvatar} aria-hidden="true"><OliviaPhoto className={styles.miniAvatarImage} /></span> : null}
                <div style={{ maxWidth: "82%" }}>
                  <div className={`${styles.bubble} ${message.error ? styles.errorBubble : ""}`} style={{ maxWidth: "100%" }}>{message.text}</div>
                  {message.action ? <ActionCard
                    action={message.action}
                    busy={actionBusy.startsWith(`${message.action.id}:`)}
                    error={message.actionError}
                    onApprove={() => reviewAction(message.id, message.action, true)}
                    onReject={() => reviewAction(message.id, message.action, false)}
                    onExecute={() => executeAction(message.id, message.action)}
                  /> : null}
                </div>
              </div>
            ))}

            {messages.length === 1 ? <div className={styles.starters}>{STARTERS.map((starter) => <button type="button" key={starter} onClick={() => ask(starter)}>{starter}</button>)}</div> : null}
            {sending ? <div className={`${styles.messageRow} ${styles.assistant}`}><span className={styles.miniAvatar} aria-hidden="true"><OliviaPhoto className={styles.miniAvatarImage} /></span><div className={`${styles.bubble} ${styles.typing}`} aria-label="OlivIA está escribiendo"><i /> <i /> <i /></div></div> : null}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <textarea rows={1} value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (input.trim() && !sending) ask(input) } }} placeholder="Preguntale algo o pedile una acción…" aria-label="Pregunta para OlivIA" />
            <button type="submit" disabled={!input.trim() || sending} aria-label="Enviar pregunta">↑</button>
          </form>
          <footer>OlivIA puede preparar acciones. Nada se ejecuta sin aprobación humana explícita.</footer>
        </section>
      ) : null}

      {!open && nudge ? <div className={styles.nudge} role="status"><button type="button" className={styles.nudgeOpen} onClick={openAssistant} aria-label="Abrir OlivIA"><span>Hola, soy <OliviaWordmark /></span><small>¿En qué puedo ayudarte?</small></button><button type="button" className={styles.nudgeClose} onClick={() => setNudge(false)} aria-label="Cerrar saludo de OlivIA">×</button></div> : null}
      {!open ? <button type="button" className={styles.launcher} onClick={openAssistant} aria-label="Abrir OlivIA" aria-expanded={open} title="OlivIA · Asistente hotelero"><OliviaPhoto className={styles.launcherImage} alt="OlivIA" /><span className={styles.onlineDot} aria-hidden="true" /></button> : null}
    </div>
  )
}
