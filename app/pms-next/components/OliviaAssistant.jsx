"use client"

import { useEffect, useRef, useState } from "react"
import styles from "./OliviaAssistant.module.css"

const STARTERS = [
  "¿Cómo viene la ocupación hoy?",
  "¿Qué requiere atención ahora?",
  "¿Cómo creo una reserva?",
  "¿Qué puedo mejorar para vender más?",
]

import { OLIVIA_SIZE, OLIVIA_PALETTE_B64, OLIVIA_INDEX_B64 } from "./oliviaAvatarData"

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
  return `Hola, soy OlivIA. Estoy para ayudarte con ${property}: puedo leer la operación de hoy, explicarte cómo usar Habitación Llena y sugerirte próximos pasos.`
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
      const pixels = getOliviaPixels()
      ctx.clearRect(0, 0, OLIVIA_SIZE, OLIVIA_SIZE)
      ctx.putImageData(new ImageData(new Uint8ClampedArray(pixels), OLIVIA_SIZE, OLIVIA_SIZE), 0, 0)
    } catch (error) {
      console.error("OlivIA avatar render failed", error)
      paintFallback(canvas)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : "true"}
    />
  )
}

export default function OliviaAssistant({ propertyId, propertyName, context, onHide }) {
  const [open, setOpen] = useState(false)
  const [nudge, setNudge] = useState(true)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState(() => [
    { id: "welcome", role: "assistant", text: greeting(propertyName) },
  ])
  const endRef = useRef(null)

  useEffect(() => {
    setMessages([{ id: `welcome-${propertyId || "default"}`, role: "assistant", text: greeting(propertyName) }])
    setInput("")
    setSending(false)
  }, [propertyId, propertyName])

  useEffect(() => {
    if (!open) return
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, open, sending])

  async function ask(rawQuestion) {
    const question = String(rawQuestion || "").trim()
    if (!question || sending) return

    const history = messages
      .filter((message) => !message.error)
      .slice(-8)
      .map((message) => ({ role: message.role, text: message.text }))

    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: question }])
    setInput("")
    setSending(true)

    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, context, history }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data?.error || "No pude responder en este momento.")

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: data?.answer || "No pude generar una respuesta en este momento.",
        },
      ])
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `error-${Date.now()}`,
          role: "assistant",
          text: error?.message || "No pude conectarme. Probá de nuevo en unos segundos.",
          error: true,
        },
      ])
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
              <span className={styles.avatar} aria-hidden="true">
                <OliviaPhoto className={styles.avatarImage} />
              </span>
              <span>
                <small>ASISTENTE DEL PMS</small>
                <strong><OliviaWordmark /></strong>
                <em><i /> En línea</em>
              </span>
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.hideButton} onClick={onHide} title="Ocultar OlivIA de este dashboard">Ocultar</button>
              <button type="button" className={styles.closeButton} onClick={() => setOpen(false)} aria-label="Minimizar OlivIA">×</button>
            </div>
          </header>

          <div className={styles.messages} aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={`${styles.messageRow} ${styles[message.role]}`}>
                {message.role === "assistant" ? (
                  <span className={styles.miniAvatar} aria-hidden="true"><OliviaPhoto className={styles.miniAvatarImage} /></span>
                ) : null}
                <div className={`${styles.bubble} ${message.error ? styles.errorBubble : ""}`}>{message.text}</div>
              </div>
            ))}

            {messages.length === 1 ? (
              <div className={styles.starters}>
                {STARTERS.map((starter) => (
                  <button type="button" key={starter} onClick={() => ask(starter)}>{starter}</button>
                ))}
              </div>
            ) : null}

            {sending ? (
              <div className={`${styles.messageRow} ${styles.assistant}`}>
                <span className={styles.miniAvatar} aria-hidden="true"><OliviaPhoto className={styles.miniAvatarImage} /></span>
                <div className={`${styles.bubble} ${styles.typing}`} aria-label="OlivIA está escribiendo"><i /> <i /> <i /></div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault()
                  if (input.trim() && !sending) ask(input)
                }
              }}
              placeholder="Preguntale algo sobre tu hotel…"
              aria-label="Pregunta para OlivIA"
            />
            <button type="submit" disabled={!input.trim() || sending} aria-label="Enviar pregunta">↑</button>
          </form>
          <footer>Lee el contexto operativo disponible en tu PMS. Las recomendaciones no ejecutan cambios por sí solas.</footer>
        </section>
      ) : null}

      {!open && nudge ? (
        <div className={styles.nudge} role="status">
          <button type="button" className={styles.nudgeOpen} onClick={openAssistant} aria-label="Abrir OlivIA">
            <span>Hola, soy <OliviaWordmark /></span>
            <small>¿En qué puedo ayudarte?</small>
          </button>
          <button type="button" className={styles.nudgeClose} onClick={() => setNudge(false)} aria-label="Cerrar saludo de OlivIA">×</button>
        </div>
      ) : null}

      {!open ? (
        <button
          type="button"
          className={styles.launcher}
          onClick={openAssistant}
          aria-label="Abrir OlivIA"
          aria-expanded={open}
          title="OlivIA · Asistente hotelero"
        >
          <OliviaPhoto className={styles.launcherImage} alt="OlivIA" />
          <span className={styles.onlineDot} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  )
}
